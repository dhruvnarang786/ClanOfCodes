// ─── Phase 3C End-to-End Test Script ─────────────────────────────────
//
// Tests the full flow: API → PostgreSQL → BullMQ → Worker → Docker → PostgreSQL
//
// Prerequisites:
//   1. Docker daemon running
//   2. compilerjudge-compiler image built
//   3. docker-compose up (PostgreSQL + Redis)
//   4. API server running:   npm run dev
//   5. Worker running:       npm run worker
//
// Run:  node test-phase3.mjs

const BASE = "http://localhost:5001/api";

// ─── Helpers ─────────────────────────────────────────────────────────

async function api(name, url, options = {}) {
  try {
    const res = await fetch(`${BASE}${url}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await res.json();
    const icon = res.status < 400 ? "✅" : "⛔";
    console.log(`${icon} ${name} [${res.status}]: ${data.message}`);
    return { status: res.status, ...data };
  } catch (e) {
    console.log(`💥 ${name}: ${e.message}`);
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ ${message}`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL: ${message}`);
    failCount++;
  }
}

// ─── Test Code Snippets ──────────────────────────────────────────────

// Test 1: Correct solution — reads two numbers, prints their sum
const CORRECT_CODE = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}
`;

// Test 2: Wrong answer — always prints 0 regardless of input
const WRONG_ANSWER_CODE = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << 0 << endl;
    return 0;
}
`;

// Test 3: Compilation error — syntax error
const COMPILE_ERROR_CODE = `
#include <iostream>
int main() {
    cout << "missing namespace"
    return 0;
}
`;

// Test 4: Infinite loop — exceeds time limit
const TLE_CODE = `
#include <iostream>
int main() {
    while (true) {}
    return 0;
}
`;

// Test 5: Runtime error — segfault
const RUNTIME_ERROR_CODE = `
#include <iostream>
int main() {
    int* ptr = nullptr;
    *ptr = 42;
    return 0;
}
`;

// ─── Main Test Runner ────────────────────────────────────────────────

async function run() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🧪 Phase 3C End-to-End Tests                              ║
║                                                               ║
║   Flow: API → PostgreSQL → BullMQ → Worker → Docker → DB     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // ─── Setup: Create users ───────────────────────────────────────
  console.log("═══ SETUP ═══\n");

  // Register or login professor
  let profRes = await api("Register Professor", "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "prof_phase3@test.com",
      password: "password123",
      name: "Prof Phase3",
      role: "PROFESSOR",
    }),
  });
  let PROF_TOKEN = profRes?.data?.token;
  if (!PROF_TOKEN) {
    profRes = await api("Login Professor", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "prof_phase3@test.com", password: "password123" }),
    });
    PROF_TOKEN = profRes?.data?.token;
  }

  // Register or login student
  let stuRes = await api("Register Student", "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "student_phase3@test.com",
      password: "password123",
      name: "Student Phase3",
      role: "STUDENT",
    }),
  });
  let STU_TOKEN = stuRes?.data?.token;
  if (!STU_TOKEN) {
    stuRes = await api("Login Student", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "student_phase3@test.com", password: "password123" }),
    });
    STU_TOKEN = stuRes?.data?.token;
  }

  if (!PROF_TOKEN || !STU_TOKEN) {
    console.log("\n💀 Failed to get tokens. Is the API server running?");
    process.exit(1);
  }

  // ─── Setup: Create a problem with test cases ──────────────────
  console.log("\n═══ CREATE PROBLEM + TEST CASES ═══\n");

  const prob = await api("Create Problem (A+B)", "/problems", {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({
      title: "Add Two Numbers (Phase 3C)",
      description: "Given two integers A and B, print A + B.",
      difficulty: "EASY",
      timeLimitMs: 2000,
      memoryLimitMb: 64,
    }),
  });
  const PROBLEM_ID = prob?.data?.id;
  console.log(`   → Problem ID: ${PROBLEM_ID}`);

  if (!PROBLEM_ID) {
    console.log("\n💀 Failed to create problem. Aborting.");
    process.exit(1);
  }

  // Add test cases
  const tc1 = await api("Add Test Case 1 (1+2=3)", `/problems/${PROBLEM_ID}/testcases`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({ input: "1 2", expectedOutput: "3", isHidden: false }),
  });

  const tc2 = await api("Add Test Case 2 (100+200=300)", `/problems/${PROBLEM_ID}/testcases`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({ input: "100 200", expectedOutput: "300", isHidden: true }),
  });

  const tc3 = await api("Add Test Case 3 (-5+5=0)", `/problems/${PROBLEM_ID}/testcases`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({ input: "-5 5", expectedOutput: "0", isHidden: true }),
  });

  console.log(`   → Created 3 test cases`);

  // ─── Helper: Submit code and wait for verdict ─────────────────
  async function submitAndWait(testName, code, expectedVerdict, waitMs = 15000) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🧪 TEST: ${testName}`);
    console.log(`${"═".repeat(60)}\n`);

    const sub = await api(`Submit: ${testName}`, "/submissions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STU_TOKEN}` },
      body: JSON.stringify({
        problemId: PROBLEM_ID,
        code,
        language: "CPP",
      }),
    });

    const subId = sub?.data?.id;
    if (!subId) {
      console.log("   💀 Failed to create submission.");
      failCount++;
      return null;
    }

    console.log(`   → Submission ID: ${subId}`);
    console.log(`   → Initial Status: ${sub?.data?.status}`);

    // Poll until COMPLETED or timeout
    const startTime = Date.now();
    let result = null;

    console.log(`   ⏳ Waiting for worker (up to ${waitMs / 1000}s)...`);
    while (Date.now() - startTime < waitMs) {
      await sleep(2000);

      const check = await api(`Poll ${testName}`, `/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${STU_TOKEN}` },
      });

      if (check?.data?.status === "COMPLETED" || check?.data?.status === "FAILED") {
        result = check.data;
        break;
      }
    }

    if (!result) {
      console.log(`   💀 Timed out waiting for verdict.`);
      failCount++;
      return null;
    }

    console.log(`\n   Result:`);
    console.log(`   ├─ status:          ${result.status}`);
    console.log(`   ├─ verdict:         ${result.verdict}`);
    console.log(`   ├─ executionTimeMs: ${result.executionTimeMs ?? "null"}`);
    console.log(`   ├─ compileError:    ${result.compileError ? JSON.stringify(result.compileError.substring(0, 150)) : "null"}`);
    console.log(`   └─ elapsed:         ${Date.now() - startTime}ms\n`);

    assert(result.status === "COMPLETED", `status should be COMPLETED, got ${result.status}`);
    assert(result.verdict === expectedVerdict, `verdict should be ${expectedVerdict}, got ${result.verdict}`);

    return result;
  }

  // ─── Run Tests ─────────────────────────────────────────────────

  // Test 1: Correct solution → ACCEPTED (needs extra time for 3 test cases)
  const r1 = await submitAndWait("Correct Solution → ACCEPTED", CORRECT_CODE, "ACCEPTED", 30000);
  if (r1) {
    assert(r1.executionTimeMs !== null, "executionTimeMs should not be null");
    assert(r1.compileError === null, "compileError should be null");
  }

  // Test 2: Wrong output → WRONG_ANSWER
  const r2 = await submitAndWait("Wrong Output → WRONG_ANSWER", WRONG_ANSWER_CODE, "WRONG_ANSWER");
  if (r2) {
    assert(r2.compileError === null, "compileError should be null for wrong answer");
  }

  // Test 3: Syntax error → COMPILATION_ERROR
  const r3 = await submitAndWait("Syntax Error → COMPILATION_ERROR", COMPILE_ERROR_CODE, "COMPILATION_ERROR");
  if (r3) {
    assert(r3.compileError !== null, "compileError should not be null");
    assert(r3.compileError.length > 0, "compileError should contain error details");
  }

  // Test 4: Infinite loop → TIME_LIMIT_EXCEEDED
  const r4 = await submitAndWait("Infinite Loop → TIME_LIMIT_EXCEEDED", TLE_CODE, "TIME_LIMIT_EXCEEDED", 20000);

  // Test 5: Segfault → RUNTIME_ERROR
  const r5 = await submitAndWait("Segfault → RUNTIME_ERROR", RUNTIME_ERROR_CODE, "RUNTIME_ERROR");

  // ─── Summary ───────────────────────────────────────────────────
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   📊 Phase 3C Test Summary                                   ║
║                                                               ║
║   Passed: ${String(passCount).padEnd(4)}                                             ║
║   Failed: ${String(failCount).padEnd(4)}                                             ║
║   Total:  ${String(passCount + failCount).padEnd(4)}                                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(console.error);
