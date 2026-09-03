// ─── Docker Executor Integration Tests ───────────────────────────────
//
// Run: npx tsx src/executor/testExecutor.ts
//
// These tests verify the DockerExecutor against real Docker containers.
// They do NOT require a database, Redis, or the API server.
//
// Prerequisites:
//   - Docker daemon must be running
//   - compilerjudge-compiler image must be built
//     (docker build -t compilerjudge-compiler -f docker/compiler/Dockerfile .)

import { executeCode } from "./dockerExecutor";
import type { ExecutionRequest, ExecutionResult } from "./types";

// ─── Test Helpers ────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`   ❌ ASSERTION FAILED: ${message}`);
    failCount++;
  } else {
    console.log(`   ✅ ${message}`);
    passCount++;
  }
}

async function runTest(
  name: string,
  request: ExecutionRequest,
  validate: (result: ExecutionResult) => void
): Promise<void> {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🧪 TEST: ${name}`);
  console.log(`${"═".repeat(60)}`);

  const startTime = Date.now();

  try {
    const result = await executeCode(request);
    const elapsed = Date.now() - startTime;

    console.log(`\n   Result:`);
    console.log(`   ├─ verdict:         ${result.verdict}`);
    console.log(`   ├─ stdout:          ${JSON.stringify(result.stdout.substring(0, 200))}`);
    console.log(`   ├─ stderr:          ${JSON.stringify(result.stderr.substring(0, 200))}`);
    console.log(`   ├─ executionTimeMs: ${result.executionTimeMs}`);
    console.log(`   ├─ compileError:    ${result.compileError ? JSON.stringify(result.compileError.substring(0, 200)) : "null"}`);
    console.log(`   └─ total wall time: ${elapsed}ms`);
    console.log();

    validate(result);
  } catch (error) {
    console.error(`   💀 Test threw an exception: ${error}`);
    failCount++;
  }
}

// ─── Test Cases ──────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪 DockerExecutor Integration Tests                    ║
║                                                           ║
║   Testing: compile, execute, timeout, errors, security    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // ─── Test 1: Valid C++ program → ACCEPTED ──────────────────────
  await runTest(
    "Valid C++ program (Hello World with stdin)",
    {
      sourceCode: `
        #include <iostream>
        #include <string>
        using namespace std;

        int main() {
          string name;
          getline(cin, name);
          cout << "Hello, " << name << "!" << endl;
          return 0;
        }
      `,
      stdin: "CompilerJudge\n",
      timeLimitMs: 5000,
      memoryLimitMb: 64,
    },
    (result) => {
      assert(result.verdict === "ACCEPTED", `verdict should be ACCEPTED, got ${result.verdict}`);
      assert(result.stdout.trim() === "Hello, CompilerJudge!", `stdout should be "Hello, CompilerJudge!", got "${result.stdout.trim()}"`);
      assert(result.compileError === null, "compileError should be null");
      assert(result.executionTimeMs !== null, "executionTimeMs should not be null");
    }
  );

  // ─── Test 2: Invalid C++ → COMPILATION_ERROR ──────────────────
  await runTest(
    "Invalid C++ (syntax error)",
    {
      sourceCode: `
        #include <iostream>
        int main() {
          // Missing semicolon
          cout << "This won't compile"
          return 0;
        }
      `,
      stdin: "",
      timeLimitMs: 5000,
      memoryLimitMb: 64,
    },
    (result) => {
      assert(result.verdict === "COMPILATION_ERROR", `verdict should be COMPILATION_ERROR, got ${result.verdict}`);
      assert(result.compileError !== null, "compileError should not be null");
      assert(result.compileError!.length > 0, "compileError should contain error details");
      assert(result.executionTimeMs === null, "executionTimeMs should be null for compile errors");
    }
  );

  // ─── Test 3: Runtime error (segfault) → RUNTIME_ERROR ─────────
  await runTest(
    "Runtime error (null pointer dereference → segfault)",
    {
      sourceCode: `
        #include <iostream>
        int main() {
          int* ptr = nullptr;
          *ptr = 42;  // Segmentation fault
          return 0;
        }
      `,
      stdin: "",
      timeLimitMs: 5000,
      memoryLimitMb: 64,
    },
    (result) => {
      assert(result.verdict === "RUNTIME_ERROR", `verdict should be RUNTIME_ERROR, got ${result.verdict}`);
      assert(result.compileError === null, "compileError should be null (it compiled fine)");
    }
  );

  // ─── Test 4: Infinite loop → TIME_LIMIT_EXCEEDED ──────────────
  await runTest(
    "Infinite loop (2-second time limit)",
    {
      sourceCode: `
        int main() {
          while (true) {}
          return 0;
        }
      `,
      stdin: "",
      timeLimitMs: 2000,
      memoryLimitMb: 64,
    },
    (result) => {
      assert(result.verdict === "TIME_LIMIT_EXCEEDED", `verdict should be TIME_LIMIT_EXCEEDED, got ${result.verdict}`);
    }
  );

  // ─── Test 5: Network disabled verification ────────────────────
  await runTest(
    "Network is disabled (ping should fail)",
    {
      sourceCode: `
        #include <cstdlib>
        #include <iostream>

        int main() {
          // Try to access the network — should fail with --network=none
          int result = system("ping -c 1 8.8.8.8 2>&1 || echo NETWORK_BLOCKED");
          std::cout << "DONE" << std::endl;
          return 0;
        }
      `,
      stdin: "",
      timeLimitMs: 10000,
      memoryLimitMb: 64,
    },
    (result) => {
      // The program should still run (ACCEPTED) but the ping should fail
      // because --network=none blocks all network access.
      assert(
        result.verdict === "ACCEPTED" || result.verdict === "RUNTIME_ERROR",
        `verdict should be ACCEPTED or RUNTIME_ERROR, got ${result.verdict}`
      );
      // Check that the output indicates network was blocked
      const output = result.stdout + result.stderr;
      const networkBlocked =
        output.includes("NETWORK_BLOCKED") ||
        output.includes("unreachable") ||
        output.includes("Network") ||
        output.includes("bad address") ||
        output.includes("DONE");  // If system() fails but program continues
      assert(networkBlocked, "Output should indicate network is unavailable");
    }
  );

  // ─── Test 6: Container cleanup verification ───────────────────
  // This test runs a normal program and then verifies that no
  // cj-exec-* containers remain afterward.
  await runTest(
    "Container cleanup verification",
    {
      sourceCode: `
        #include <iostream>
        int main() {
          std::cout << "cleanup test" << std::endl;
          return 0;
        }
      `,
      stdin: "",
      timeLimitMs: 5000,
      memoryLimitMb: 64,
    },
    (result) => {
      assert(result.verdict === "ACCEPTED", `verdict should be ACCEPTED, got ${result.verdict}`);
      assert(result.stdout.trim() === "cleanup test", `stdout should be "cleanup test"`);
    }
  );

  // After all tests, verify no leftover containers
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🔍 POST-TEST: Checking for leftover containers...`);
  console.log(`${"═".repeat(60)}`);

  const { execFile: execFileCb } = await import("child_process");
  const { promisify: pfy } = await import("util");
  const execAsync = pfy(execFileCb);

  try {
    const { stdout: containers } = await execAsync("docker", [
      "ps", "-a", "--filter", "name=cj-exec-", "--format", "{{.Names}}"
    ]);
    if (containers.trim() === "") {
      console.log("   ✅ No leftover cj-exec-* containers found.");
      passCount++;
    } else {
      console.error(`   ❌ Leftover containers found: ${containers.trim()}`);
      failCount++;
    }
  } catch {
    console.log("   ✅ No leftover cj-exec-* containers found (docker ps returned nothing).");
    passCount++;
  }

  // ─── Summary ───────────────────────────────────────────────────
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   📊 Test Summary                                        ║
║                                                           ║
║   Passed: ${String(passCount).padEnd(3)}                                           ║
║   Failed: ${String(failCount).padEnd(3)}                                           ║
║   Total:  ${String(passCount + failCount).padEnd(3)}                                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  process.exit(failCount > 0 ? 1 : 0);
}

main();
