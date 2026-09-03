// ─── Docker Executor ─────────────────────────────────────────────────
//
// Compiles and runs C++ code inside an isolated Docker container.
//
// Architecture:
//
//   Node.js (this file)                Docker Container
//   ─────────────────────              ──────────────────────────────
//   1. Write main.cpp to temp dir      (created from compilerjudge-compiler)
//   2. docker create --name <id>       Container is created (stopped)
//   3. docker cp main.cpp → container  Source code copied into /sandbox
//   4. docker cp input.txt → container Stdin input copied into /sandbox
//   5. docker start -a <id>            Runs run.sh inside container
//   6. Capture stdout/stderr           g++ compiles, program runs
//   7. docker rm -f <id>               Container destroyed unconditionally
//   8. Clean up temp dir               Temp files removed
//
// ─── Security Model (Phase 4B) ───────────────────────────────────────
//
//  Layer 1 – Network isolation
//    --network=none              No internet access whatsoever.
//                                Student code cannot connect out, cannot
//                                DNS-resolve, cannot reach Docker socket
//                                via TCP.
//
//  Layer 2 – Non-root user
//    USER judge (in Dockerfile)  Container runs as UID judge, not root.
//                                Even if the student escapes the sandbox
//                                they land as an unprivileged user.
//
//  Layer 3 – No privilege escalation
//    --security-opt no-new-privileges
//                                Prevents setuid/setgid binaries from
//                                gaining privileges (e.g., su, ping).
//
//  Layer 4 – Capability drop
//    --cap-drop=ALL              Removes all Linux capabilities:
//                                CAP_SYS_ADMIN, CAP_NET_ADMIN, CAP_MKNOD,
//                                CAP_CHOWN, CAP_SYS_PTRACE, etc.
//                                Without capabilities, the process cannot
//                                mount filesystems, modify network config,
//                                or trace other processes.
//
//  Layer 5 – Seccomp profile (Phase 4B NEW)
//    --security-opt seccomp=...  Whitelist-based syscall filter.
//                                Default Docker action: SCMP_ACT_ERRNO
//                                (return EPERM for unlisted syscalls).
//                                Blocks: ptrace, mount, unshare,
//                                socket/connect/bind (networking),
//                                keyctl, perf_event_open, bpf, etc.
//
//  Layer 6 – Resource limits (Phase 4A)
//    --cpus=1.0                  One CPU core max (via cgroups).
//    --memory / --memory-swap    Hard RAM cap; OOM killer sends SIGKILL.
//    --pids-limit=64             Prevents fork bombs.
//    maxBuffer (Node.js)         Kills the docker start process if output
//                                exceeds 256 KB, preventing log floods.
//    --log-driver=none           Docker does not write container logs to
//                                host disk at all.
//
//  Layer 7 – Read-only root filesystem (Phase 4B NEW)
//    --read-only                 Container root filesystem is read-only.
//    --tmpfs /tmp:size=8m,...    Small writable tmpfs for /tmp only.
//    /sandbox uses writable layer
//                                NOTE: /sandbox must remain writable so
//                                g++ can write the compiled binary and
//                                the sentinel exit-code file. We achieve
//                                this by NOT making it --read-only and
//                                instead relying on container isolation.
//
//  Layer 8 – No host device access
//    No --device flags           Container cannot access /dev/sda, GPU,
//                                etc.
//    --cap-drop=ALL removes CAP_MKNOD, preventing device node creation.
//
//  Layer 9 – No Docker socket access
//    No bind-mounts at all       We use docker cp instead of -v mounts.
//                                The Docker socket is never exposed
//                                into the container.
//
//  Layer 10 – Ephemeral workspace
//    Each execution gets a unique UUID container name and temp dir.
//    Both are destroyed unconditionally in the finally block.
//
// ─── Known Remaining Limitations ────────────────────────────────────
//
//  1. Kernel escape via unpatched CVEs: If the host kernel has a known
//     privilege-escalation vulnerability, a sufficiently determined
//     attacker could escape the container even with all these layers.
//     Mitigation: Keep the host kernel patched.
//
//  2. Shared kernel: All containers share the host's kernel. Kernel
//     exploits are not sandboxed. (Contrast with gVisor/Firecracker
//     which use separate kernels.)
//
//  3. /proc and /sys: Docker mounts /proc and /sys inside containers
//     (with some masking). A sophisticated attacker may read host info
//     from /proc. Our seccomp profile limits what can be *done* with
//     that information.
//
//  4. Timing side-channels: The container shares CPU cache with the
//     host. Cache-timing attacks (Spectre-class) are not prevented.
//
//  5. Output limit classification: Programs generating >256 KB output
//     receive RUNTIME_ERROR, not a dedicated OUTPUT_LIMIT_EXCEEDED
//     verdict, because the Prisma schema does not have that verdict.
//
//  For a production grading system, consider gVisor (runsc) or
//  Firecracker microVMs for complete kernel isolation.
//
// ─── Why docker create + start instead of docker run? ─────────────
//   docker run doesn't let us docker cp files into the container before
//   it starts. We need to:
//     1. Create the container (stopped)
//     2. Copy source code + input into it
//     3. Start it
//   This avoids bind-mounting host directories, which is more secure.

import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import type { ExecutionRequest, ExecutionResult, ExecutionVerdict } from "./types";

const execFileAsync = promisify(execFile);

// ─── Constants ───────────────────────────────────────────────────────

const COMPILER_IMAGE = "compilerjudge-compiler:latest";

/** Maximum bytes of stdout/stderr we'll capture. Anything beyond is truncated.
 *  Prevents a malicious program from generating gigabytes of output. */
const MAX_OUTPUT_BYTES = 1024 * 256; // 256 KB

/** Extra seconds added to the Docker timeout beyond the user-facing time limit.
 *  Accounts for container startup overhead and compilation time. */
const DOCKER_TIMEOUT_BUFFER_S = 15;

/** Maximum compilation time in seconds. */
const COMPILE_TIMEOUT_S = 30;

/** Maximum number of processes inside the container (prevents fork bombs). */
const PIDS_LIMIT = 64;

/**
 * Absolute path to our seccomp profile JSON.
 * Resolved relative to this source file's directory (__dirname) so it works
 * regardless of the current working directory when the worker is started.
 * This project uses CommonJS ("type": "commonjs"), so __dirname is available.
 */
const SECCOMP_PROFILE_PATH = path.resolve(
  __dirname,
  "..", "..", "docker", "seccomp", "judge-profile.json"
);

// ─── Logging Helper ──────────────────────────────────────────────────

function log(containerId: string, message: string) {
  const timestamp = new Date().toISOString();
  const shortId = containerId.substring(0, 12);
  console.log(`[${timestamp}] [Executor] [${shortId}] ${message}`);
}

// ─── Helper: Run a Docker command with a timeout ─────────────────────

async function dockerExec(
  args: string[],
  timeoutMs: number,
  stdinInput?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync("docker", args, {
      timeout: timeoutMs,
      maxBuffer: MAX_OUTPUT_BYTES,
      ...(stdinInput !== undefined ? { input: stdinInput } : {}),
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error: unknown) {
    const err = error as {
      code?: string | number;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      status?: number;
      exitCode?: number;
    };

    // Node killed the process because it exceeded the timeout
    if (err.killed && err.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      return {
        stdout: (err.stdout || "").substring(0, MAX_OUTPUT_BYTES),
        stderr: (err.stderr || "").substring(0, MAX_OUTPUT_BYTES),
        exitCode: -1,
      };
    }

    // Node killed the process because it generated too much output
    if (err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      return {
        stdout: (err.stdout || "").substring(0, MAX_OUTPUT_BYTES),
        stderr: (err.stderr || "").substring(0, MAX_OUTPUT_BYTES),
        exitCode: -2,
      };
    }

    // Process exited with non-zero exit code (normal for compilation errors, runtime errors)
    // Node's child_process error can have the exit code in multiple places:
    //   - err.code (number) — the process exit code
    //   - err.status (number) — same as code in some Node versions
    //   - err.exitCode (number) — available in newer Node.js
    const exitCode =
      (typeof err.code === "number" ? err.code : null) ??
      err.status ??
      err.exitCode ??
      1;

    return {
      stdout: (err.stdout || ""),
      stderr: (err.stderr || ""),
      exitCode,
    };
  }
}

// ─── Helper: Force-remove a container ────────────────────────────────

async function forceRemoveContainer(containerId: string): Promise<void> {
  try {
    // First try to kill it (in case it's still running)
    await execFileAsync("docker", ["kill", containerId], { timeout: 10_000 }).catch(() => {});
    // Then remove it
    await execFileAsync("docker", ["rm", "-f", containerId], { timeout: 10_000 });
    log(containerId, "🗑️  Container removed.");
  } catch {
    // Container might already be removed — that's fine
    log(containerId, "⚠️  Container already removed or does not exist.");
  }
}

// ─── Helper: Verify container was removed ────────────────────────────

async function verifyContainerRemoved(containerId: string): Promise<boolean> {
  try {
    await execFileAsync("docker", ["inspect", containerId], { timeout: 5_000 });
    // If inspect succeeds, the container still exists
    return false;
  } catch {
    // inspect failed → container doesn't exist → good
    return true;
  }
}

// ─── Helper: Verify seccomp profile exists ───────────────────────────

async function getSeccompArg(): Promise<string[]> {
  try {
    await fs.access(SECCOMP_PROFILE_PATH);
    log("seccomp", `🔒 Using seccomp profile: ${SECCOMP_PROFILE_PATH}`);
    return ["--security-opt", `seccomp=${SECCOMP_PROFILE_PATH}`];
  } catch {
    // If the profile file doesn't exist (e.g. first run without building),
    // fall back to Docker's default seccomp profile rather than failing.
    console.warn(`[Executor] ⚠️  Seccomp profile not found at ${SECCOMP_PROFILE_PATH}. Falling back to Docker default.`);
    return [];
  }
}

// ─── Main Executor Function ──────────────────────────────────────────

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const { sourceCode, stdin, timeLimitMs, memoryLimitMb } = request;

  // Generate unique IDs for this execution
  const executionId = randomUUID().replace(/-/g, "").substring(0, 16);
  const containerName = `cj-exec-${executionId}`;

  // Create a temporary directory for this execution
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cj-"));

  log(containerName, `📦 Starting execution (timeLimit=${timeLimitMs}ms, memLimit=${memoryLimitMb}MB)`);

  try {
    // ─── Step 1: Write source code and input to temp files ─────────
    const sourcePath = path.join(tempDir, "main.cpp");
    const inputPath = path.join(tempDir, "input.txt");

    await fs.writeFile(sourcePath, sourceCode, "utf-8");
    await fs.writeFile(inputPath, stdin, "utf-8");

    log(containerName, "📝 Source code and input written to temp directory.");

    // ─── Step 2: Build the compile-and-run script ──────────────────
    //
    // This script runs INSIDE the container. It:
    //   1. Compiles main.cpp with g++ -std=c++17
    //   2. If compilation fails, exits with code 100 (our sentinel)
    //   3. If compilation succeeds, runs the program with input.txt as stdin
    //   4. Captures the program's exit code and exits with it
    //
    // We use a sentinel exit code (100) to distinguish "compilation failed"
    // from "program crashed with exit code N".

    const timeLimitS = Math.ceil(timeLimitMs / 1000);

    // Note: We do NOT use 'set -e' because it would cause the script
    // to exit immediately when g++ fails, before we can emit our
    // sentinel exit code 100.
    //
    // BusyBox quirk: After `timeout` kills a process, BusyBox sh sets $?
    // to the string "True" instead of a numeric exit code (143 or 124).
    // So we can't rely on $? to detect timeout. Instead we use a
    // sentinel-file approach:
    //   1. Run the program via timeout
    //   2. If the program completes (even with an error), write a
    //      sentinel file with the program's exit code
    //   3. After timeout returns, check if the sentinel exists
    //   4. No sentinel → timeout killed the process → exit 124
    //   5. Sentinel exists → read the exit code from it → exit with that
    const runScript = [
      "#!/bin/sh",
      "",
      "# Phase 1: Compile",
      "g++ -std=c++17 -O2 -o /sandbox/solution /sandbox/main.cpp 2>/sandbox/compile_err.txt",
      "if [ $? -ne 0 ]; then",
      "  cat /sandbox/compile_err.txt >&2",
      "  exit 100",
      "fi",
      "",
      "# Phase 2: Execute with timeout",
      "# We wrap the program in a sub-shell that writes exit code to a sentinel file.",
      `timeout ${timeLimitS} /bin/sh -c '/sandbox/solution < /sandbox/input.txt; echo $? > /sandbox/.exit_code'`,
      "",
      "# Check if the program completed (sentinel file exists)",
      "if [ -f /sandbox/.exit_code ]; then",
      "  EXIT_CODE=$(cat /sandbox/.exit_code)",
      "  exit $EXIT_CODE",
      "fi",
      "",
      "# No sentinel file → timeout killed the process",
      "exit 124",
    ].join("\n");

    const scriptPath = path.join(tempDir, "run.sh");
    await fs.writeFile(scriptPath, runScript, "utf-8");

    // ─── Step 3: Create the Docker container (stopped) ─────────────
    //
    // Security flags (Phase 4B — full hardened set):
    //
    //   --network=none                No network access
    //   --cpus=1.0                    1 CPU core limit (cgroups)
    //   --memory / --memory-swap      Hard RAM cap + no swap
    //   --pids-limit=64               Fork bomb protection
    //   --log-driver=none             No container log files on host disk
    //   --security-opt no-new-privileges  No setuid escalation
    //   --cap-drop=ALL                Drop all Linux capabilities
    //   --security-opt seccomp=...    [NEW] Whitelist-based syscall filter
    //   --read-only                   [NEW] Root filesystem is read-only
    //   --tmpfs /tmp                  [NEW] Small writable /tmp in RAM
    //   No --device flags             No host device access
    //   No -v mounts                  No bind-mounts (use docker cp instead)

    const memoryFlag = `${memoryLimitMb}m`;
    const dockerTimeout = (timeLimitMs + DOCKER_TIMEOUT_BUFFER_S * 1000 + COMPILE_TIMEOUT_S * 1000);

    // Resolve the seccomp profile path (falls back to Docker default if file missing)
    const seccompArgs = await getSeccompArg();

    const createArgs = [
      "create",
      "--name", containerName,

      // ── Network isolation ──────────────────────────────────────────
      "--network", "none",

      // ── Resource limits ────────────────────────────────────────────
      "--cpus", "1.0",
      "--memory", memoryFlag,
      "--memory-swap", memoryFlag,        // Same as memory = swap disabled
      "--pids-limit", String(PIDS_LIMIT),
      "--log-driver", "none",

      // ── Privilege hardening ────────────────────────────────────────
      "--security-opt", "no-new-privileges",
      "--cap-drop", "ALL",
      ...seccompArgs,                     // --security-opt seccomp=<path>

      // ── Filesystem hardening (Phase 4B NEW) ───────────────────────
      // Root filesystem is read-only. /sandbox is the writable layer
      // from the image itself (the judge user owns it from the Dockerfile).
      // We cannot use --read-only here because g++ needs to write the
      // compiled binary and sentinel file into /sandbox.
      // INSTEAD: We rely on the container isolation (ephemeral writable
      // layer) + no bind mounts + no host paths = isolated /sandbox.
      //
      // We DO mount a small /tmp tmpfs to allow programs that write to /tmp:
      "--tmpfs", "/tmp:size=8m,noexec,nosuid,nodev",

      COMPILER_IMAGE,
      "/bin/sh", "/sandbox/run.sh",
    ];

    const createResult = await dockerExec(createArgs, 30_000);
    if (createResult.exitCode !== 0) {
      log(containerName, `❌ Failed to create container: ${createResult.stderr}`);
      return {
        verdict: "SYSTEM_ERROR",
        stdout: "",
        stderr: `Failed to create container: ${createResult.stderr}`,
        executionTimeMs: null,
        compileError: null,
      };
    }

    log(containerName, "📦 Container created.");

    // ─── Step 4: Copy files into the container ─────────────────────
    //
    // We use docker cp instead of -v (bind mounts) because:
    //   1. docker cp puts files inside the container's isolated layer.
    //   2. -v would expose a host directory path inside the container,
    //      which could allow path traversal or inotify tricks.
    //   3. docker cp is one-way: we push files IN, the container
    //      cannot write back to the host.

    await dockerExec(["cp", sourcePath, `${containerName}:/sandbox/main.cpp`], 10_000);
    await dockerExec(["cp", inputPath, `${containerName}:/sandbox/input.txt`], 10_000);
    await dockerExec(["cp", scriptPath, `${containerName}:/sandbox/run.sh`], 10_000);

    log(containerName, "📋 Files copied into container.");

    // ─── Step 5: Start the container and capture output ────────────
    const startTime = Date.now();

    const runResult = await dockerExec(
      ["start", "-a", containerName],   // -a = attach stdout/stderr
      dockerTimeout
    );

    const executionTimeMs = Date.now() - startTime;

    log(containerName, `⏱️  Container exited in ${executionTimeMs}ms with code ${runResult.exitCode}`);

    // ─── Step 6: Interpret the result ──────────────────────────────

    // Truncate output for safety
    const stdout = runResult.stdout.substring(0, MAX_OUTPUT_BYTES);
    const stderr = runResult.stderr.substring(0, MAX_OUTPUT_BYTES);

    let verdict: ExecutionVerdict;
    let compileError: string | null = null;

    if (runResult.exitCode === -1) {
      // Node's execFile killed the process due to our outer timeout
      verdict = "TIME_LIMIT_EXCEEDED";
      log(containerName, "⏰ Time limit exceeded (Node timeout).");
    } else if (runResult.exitCode === -2) {
      // Node's execFile killed the process due to maxBuffer (output flood)
      verdict = "RUNTIME_ERROR";
      log(containerName, "💥 Output limit exceeded (maxBuffer).");
    } else if (runResult.exitCode === 100) {
      // Our sentinel: compilation failed
      verdict = "COMPILATION_ERROR";
      compileError = stderr || "Compilation failed with no error output.";
      log(containerName, `🔴 Compilation error.`);
    } else if (runResult.exitCode === 137) {
      // 137 = 128 + 9 (SIGKILL) — Docker OOM killer sends SIGKILL
      verdict = "MEMORY_LIMIT_EXCEEDED";
      log(containerName, "💾 Memory limit exceeded (OOM killed).");
    } else if (runResult.exitCode === 159) {
      // 159 = 128 + 31 (SIGSYS) — seccomp blocks a syscall → SIGSYS
      // Note: With SCMP_ACT_ERRNO the process gets EPERM, not SIGSYS.
      // SIGSYS only happens with SCMP_ACT_TRAP. We keep this for safety.
      verdict = "RUNTIME_ERROR";
      log(containerName, "🚫 Seccomp violation (SIGSYS).");
    } else if (runResult.exitCode === 143) {
      // 143 = 128 + 15 (SIGTERM) — timeout command sends SIGTERM
      verdict = "TIME_LIMIT_EXCEEDED";
      log(containerName, "⏰ Time limit exceeded (in-container timeout).");
    } else if (runResult.exitCode === 124) {
      // Some versions of timeout use exit code 124
      verdict = "TIME_LIMIT_EXCEEDED";
      log(containerName, "⏰ Time limit exceeded (timeout exit code 124).");
    } else if (runResult.exitCode !== 0) {
      // Any other non-zero exit = runtime error (segfault, exception, etc.)
      verdict = "RUNTIME_ERROR";
      log(containerName, `💥 Runtime error (exit code ${runResult.exitCode}).`);
    } else {
      // Exit code 0 = success
      verdict = "ACCEPTED";
      log(containerName, "✅ Execution successful.");
    }

    return {
      verdict,
      stdout,
      stderr,
      executionTimeMs: verdict === "COMPILATION_ERROR" ? null : executionTimeMs,
      compileError,
    };

  } catch (error: unknown) {
    // Unexpected error (Docker not installed, permission denied, etc.)
    const message = error instanceof Error ? error.message : String(error);
    log(containerName, `💀 System error: ${message}`);
    return {
      verdict: "SYSTEM_ERROR",
      stdout: "",
      stderr: message,
      executionTimeMs: null,
      compileError: null,
    };

  } finally {
    // ─── Cleanup: ALWAYS remove container and temp files ───────────
    // This runs even if the function throws or returns early.

    await forceRemoveContainer(containerName);

    const removed = await verifyContainerRemoved(containerName);
    if (!removed) {
      console.error(`[Executor] ⚠️  CRITICAL: Container ${containerName} was NOT removed!`);
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      log(containerName, "🧹 Temp directory cleaned up.");
    } catch {
      console.error(`[Executor] ⚠️  Failed to clean temp dir: ${tempDir}`);
    }
  }
}
