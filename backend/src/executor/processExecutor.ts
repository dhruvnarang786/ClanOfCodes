// ─── Process Executor ────────────────────────────────────────────────
//
// Executes submitted code DIRECTLY inside the running application container
// using Node.js child_process. No Docker daemon is required at runtime.
//
// The application container image (built from the backend Dockerfile) must
// already contain the required toolchain:
//   - g++      (for C++ compilation and execution)
//   - python3  (for Python execution)
//
// ─── Security Model ──────────────────────────────────────────────────
//
// Because execution happens INSIDE the same container as the API server,
// the following protections apply:
//
//   ✅ Execution timeout    – process is killed after timeLimitMs
//   ✅ Output size limit    – stdout/stderr truncated after MAX_OUTPUT_BYTES
//   ✅ Temp file cleanup    – source/binary deleted after every run
//   ✅ Unique temp dirs     – each submission gets its own /tmp/job-<uuid> dir
//
//   ❌ Memory limits        – not enforced (ulimit not available on Render free tier)
//   ❌ Syscall filtering    – no seccomp (would need privileged Docker to set up)
//   ❌ Filesystem isolation – code can read /tmp and world-readable files
//   ❌ Env-var isolation    – malicious code could read process.env values
//
// This is intentionally weaker than a fresh Docker container per submission.
// It is acceptable for a portfolio/educational platform at this scale.
//
// ─── Supported Languages ─────────────────────────────────────────────
//   - CPP  → compiled with g++ -O2 -std=c++17, executed as ./a.out
//   - PYTHON → executed with python3

import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import type { ExecutionRequest, ExecutionResult, ExecutionVerdict } from "./types";

const execFileAsync = promisify(execFile);

// ─── Constants ───────────────────────────────────────────────────────

/** Hard cap on stdout + stderr to prevent memory exhaustion from chatty programs */
const MAX_OUTPUT_BYTES = 256 * 1024; // 256 KB

/** Hard cap on compilation time */
const COMPILE_TIMEOUT_MS = 15_000; // 15 seconds

// ─── Helpers ─────────────────────────────────────────────────────────

function generateJobId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function truncate(s: string): string {
  if (Buffer.byteLength(s, "utf8") <= MAX_OUTPUT_BYTES) return s;
  const buf = Buffer.from(s, "utf8").subarray(0, MAX_OUTPUT_BYTES);
  return buf.toString("utf8") + "\n... [output truncated]";
}

function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort – log but don't throw
    console.warn(`[ProcessExecutor] Warning: could not clean up temp dir ${dir}`);
  }
}

// ─── Main Executor ───────────────────────────────────────────────────

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const { sourceCode, stdin, timeLimitMs, language } = request;

  const jobId = generateJobId();
  const tmpDir = path.join(os.tmpdir(), `cj-job-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`[ProcessExecutor] 🚀 Job ${jobId} | Lang: ${language ?? "CPP"} | TL: ${timeLimitMs}ms`);

  const lang = (language ?? "CPP").toUpperCase();

  try {
    if (lang === "CPP" || lang === "C++") {
      return await executeCpp({ sourceCode, stdin, timeLimitMs, tmpDir, jobId });
    } else if (lang === "PYTHON" || lang === "PYTHON3") {
      return await executePython({ sourceCode, stdin, timeLimitMs, tmpDir, jobId });
    } else {
      console.warn(`[ProcessExecutor] Unsupported language "${lang}", defaulting to CPP`);
      return await executeCpp({ sourceCode, stdin, timeLimitMs, tmpDir, jobId });
    }
  } finally {
    cleanup(tmpDir);
  }
}

// ─── C++ Executor ────────────────────────────────────────────────────

async function executeCpp(opts: {
  sourceCode: string;
  stdin: string;
  timeLimitMs: number;
  tmpDir: string;
  jobId: string;
}): Promise<ExecutionResult> {
  const { sourceCode, stdin, timeLimitMs, tmpDir, jobId } = opts;

  const srcFile = path.join(tmpDir, "solution.cpp");
  const binFile = path.join(tmpDir, "solution");
  const stdinFile = path.join(tmpDir, "stdin.txt");

  // Write source and stdin
  fs.writeFileSync(srcFile, sourceCode, "utf8");
  fs.writeFileSync(stdinFile, stdin ?? "", "utf8");

  // ── Compilation ─────────────────────────────────────────────────────
  const compileStart = Date.now();
  try {
    await execFileAsync("g++", [
      "-O2",
      "-std=c++17",
      "-Wall",
      "-o", binFile,
      srcFile,
    ], {
      timeout: COMPILE_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
  } catch (err: any) {
    const compileStderr = truncate(err.stderr ?? err.message ?? String(err));
    console.log(`[ProcessExecutor] 🔴 Job ${jobId} – Compilation error`);
    return {
      verdict: "COMPILATION_ERROR",
      stdout: "",
      stderr: compileStderr,
      executionTimeMs: null,
      compileError: compileStderr,
    };
  }

  const compileMs = Date.now() - compileStart;
  console.log(`[ProcessExecutor] ✅ Job ${jobId} – Compiled in ${compileMs}ms`);

  // Make binary executable (important on Linux)
  try { fs.chmodSync(binFile, 0o755); } catch { /* ignore */ }

  // ── Execution ───────────────────────────────────────────────────────
  const execStart = Date.now();
  try {
    // Feed stdin via shell redirect using a wrapper so we can use execFile
    // safely without shell injection. We pass the pre-written stdin file
    // to the process via stdin stream.
    const stdinData = fs.readFileSync(stdinFile);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve, reject) => {
        const child = require("child_process").spawn(binFile, [], {
          cwd: tmpDir,
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let outputLimitHit = false;

        child.stdin.write(stdinData);
        child.stdin.end();

        child.stdout.on("data", (chunk: Buffer) => {
          stdoutBytes += chunk.length;
          if (stdoutBytes <= MAX_OUTPUT_BYTES) {
            stdout += chunk.toString("utf8");
          } else if (!outputLimitHit) {
            outputLimitHit = true;
            stdout += "\n... [output truncated]";
            child.kill("SIGKILL");
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          stderrBytes += chunk.length;
          if (stderrBytes <= MAX_OUTPUT_BYTES) {
            stderr += chunk.toString("utf8");
          }
        });

        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve({ stdout, stderr, exitCode: -1 }); // -1 signals TLE
        }, timeLimitMs);

        child.on("close", (code: number | null) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        child.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      }
    );

    const execMs = Date.now() - execStart;

    // TLE: timer fired → exitCode = -1 sentinel
    if (result.exitCode === -1) {
      console.log(`[ProcessExecutor] ⏰ Job ${jobId} – TLE (>${timeLimitMs}ms)`);
      return {
        verdict: "TIME_LIMIT_EXCEEDED",
        stdout: truncate(result.stdout),
        stderr: "",
        executionTimeMs: timeLimitMs,
        compileError: null,
      };
    }

    // Output truncation verdict
    if (result.stdout.includes("[output truncated]") && result.exitCode !== 0) {
      return {
        verdict: "RUNTIME_ERROR",
        stdout: truncate(result.stdout),
        stderr: truncate(result.stderr),
        executionTimeMs: execMs,
        compileError: null,
      };
    }

    // Non-zero exit = runtime error
    if (result.exitCode !== 0) {
      console.log(`[ProcessExecutor] 💥 Job ${jobId} – Runtime error (exit ${result.exitCode})`);
      return {
        verdict: "RUNTIME_ERROR",
        stdout: truncate(result.stdout),
        stderr: truncate(result.stderr),
        executionTimeMs: execMs,
        compileError: null,
      };
    }

    console.log(`[ProcessExecutor] ✅ Job ${jobId} – Executed in ${execMs}ms`);
    return {
      verdict: "ACCEPTED",
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      executionTimeMs: execMs,
      compileError: null,
    };
  } catch (err: any) {
    console.error(`[ProcessExecutor] 💀 Job ${jobId} – System error:`, err.message);
    return {
      verdict: "SYSTEM_ERROR",
      stdout: "",
      stderr: err.message ?? String(err),
      executionTimeMs: null,
      compileError: null,
    };
  }
}

// ─── Python Executor ─────────────────────────────────────────────────

async function executePython(opts: {
  sourceCode: string;
  stdin: string;
  timeLimitMs: number;
  tmpDir: string;
  jobId: string;
}): Promise<ExecutionResult> {
  const { sourceCode, stdin, timeLimitMs, tmpDir, jobId } = opts;

  const srcFile = path.join(tmpDir, "solution.py");
  const stdinFile = path.join(tmpDir, "stdin.txt");

  fs.writeFileSync(srcFile, sourceCode, "utf8");
  fs.writeFileSync(stdinFile, stdin ?? "", "utf8");

  const stdinData = fs.readFileSync(stdinFile);
  const execStart = Date.now();

  try {
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve, reject) => {
        const child = require("child_process").spawn("python3", [srcFile], {
          cwd: tmpDir,
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let stdoutBytes = 0;
        let outputLimitHit = false;

        child.stdin.write(stdinData);
        child.stdin.end();

        child.stdout.on("data", (chunk: Buffer) => {
          stdoutBytes += chunk.length;
          if (stdoutBytes <= MAX_OUTPUT_BYTES) {
            stdout += chunk.toString("utf8");
          } else if (!outputLimitHit) {
            outputLimitHit = true;
            stdout += "\n... [output truncated]";
            child.kill("SIGKILL");
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8").substring(0, MAX_OUTPUT_BYTES);
        });

        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve({ stdout, stderr, exitCode: -1 });
        }, timeLimitMs);

        child.on("close", (code: number | null) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        child.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      }
    );

    const execMs = Date.now() - execStart;

    if (result.exitCode === -1) {
      return { verdict: "TIME_LIMIT_EXCEEDED", stdout: truncate(result.stdout), stderr: "", executionTimeMs: timeLimitMs, compileError: null };
    }

    if (result.exitCode !== 0) {
      return { verdict: "RUNTIME_ERROR", stdout: truncate(result.stdout), stderr: truncate(result.stderr), executionTimeMs: execMs, compileError: null };
    }

    return { verdict: "ACCEPTED", stdout: truncate(result.stdout), stderr: truncate(result.stderr), executionTimeMs: execMs, compileError: null };
  } catch (err: any) {
    return { verdict: "SYSTEM_ERROR", stdout: "", stderr: err.message ?? String(err), executionTimeMs: null, compileError: null };
  }
}
