// ─── Phase 4A End-to-End Test Script ─────────────────────────────────
//
// Tests resource limits: CPU, Memory, PID, Output, and Timeout
//
// Prerequisites:
//   1. Docker daemon running
//   2. API server running:   npm run dev
//   3. Worker running:       npm run worker
//
// Run:  node test-phase4a.mjs

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

// Test 1: Normal C++ program
const NORMAL_CODE = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}
`;

// Test 2: Infinite loop (CPU bounded, causes Timeout)
const TLE_CODE = `
#include <iostream>
int main() {
    while (true) {}
    return 0;
}
`;

// Test 3: Memory-heavy program
// Tries to allocate and use 100MB (limit is 64MB)
const MLE_CODE = `
#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int*> v;
    while(true) {
        int* p = new int[1024 * 1024]; // 4MB
        for(int i=0; i < 1024*1024; i++) p[i] = i;
        v.push_back(p);
    }
    return 0;
}
`;

// Test 4: Program creating many processes (fork bomb)
// Limits to 64 pids, should hit limit and throw RUNTIME_ERROR
const FORK_CODE = `
#include <unistd.h>
#include <iostream>
int main() {
    while(true) {
        if (fork() < 0) {
            return 1; // Crash when we can't fork anymore
        }
    }
    return 0;
}
`;

// Test 5: Program producing huge output
// Should trigger node maxBuffer error -> RUNTIME_ERROR
const OLE_CODE = `
#include <iostream>
using namespace std;
int main() {
    while(true) {
        cout << "SPAM" << endl;
    }
    return 0;
}
`;

// Test 6: Runtime crash
const RE_CODE = `
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
║   🧪 Phase 4A Resource Limits Tests                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  console.log("═══ SETUP ═══\n");

  let profRes = await api("Register Professor", "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "prof_phase4a@test.com",
      password: "password123",
      name: "Prof Phase4A",
      role: "PROFESSOR",
    }),
  });
  let PROF_TOKEN = profRes?.data?.token;
  if (!PROF_TOKEN) {
    profRes = await api("Login Professor", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "prof_phase4a@test.com", password: "password123" }),
    });
    PROF_TOKEN = profRes?.data?.token;
  }

  let stuRes = await api("Register Student", "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "student_phase4a@test.com",
      password: "password123",
      name: "Student Phase4A",
      role: "STUDENT",
    }),
  });
  let STU_TOKEN = stuRes?.data?.token;
  if (!STU_TOKEN) {
    stuRes = await api("Login Student", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "student_phase4a@test.com", password: "password123" }),
    });
    STU_TOKEN = stuRes?.data?.token;
  }

  if (!PROF_TOKEN || !STU_TOKEN) {
    console.log("\n💀 Failed to get tokens.");
    process.exit(1);
  }

  console.log("\n═══ CREATE PROBLEM + TEST CASES ═══\n");

  const prob = await api("Create Problem (A+B)", "/problems", {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({
      title: "Add Two Numbers (Phase 4A)",
      description: "Limits test",
      difficulty: "EASY",
      timeLimitMs: 2000,
      memoryLimitMb: 64, // Crucial for MLE test
    }),
  });
  const PROBLEM_ID = prob?.data?.id;
  
  if (!PROBLEM_ID) {
    console.log("\n💀 Failed to create problem.");
    process.exit(1);
  }

  await api("Add Test Case", `/problems/${PROBLEM_ID}/testcases`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({ input: "1 2", expectedOutput: "3", isHidden: false }),
  });

  async function submitAndWait(testName, code, expectedVerdict, waitMs = 15000) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🧪 TEST: ${testName}`);
    console.log(`${"═".repeat(60)}\n`);

    const sub = await api(`Submit: ${testName}`, "/submissions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STU_TOKEN}` },
      body: JSON.stringify({ problemId: PROBLEM_ID, code, language: "CPP" }),
    });

    const subId = sub?.data?.id;
    if (!subId) {
      failCount++;
      return null;
    }

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
    console.log(`   ├─ executionTimeMs: ${result.executionTimeMs}`);
    console.log(`   └─ elapsed:         ${Date.now() - startTime}ms\n`);

    assert(result.status === "COMPLETED", `status should be COMPLETED, got ${result.status}`);
    assert(result.verdict === expectedVerdict, `verdict should be ${expectedVerdict}, got ${result.verdict}`);

    return result;
  }

  // 1. Normal C++ program
  await submitAndWait("Normal C++", NORMAL_CODE, "ACCEPTED", 30000);

  // 2. Infinite loop -> TLE
  await submitAndWait("Infinite Loop", TLE_CODE, "TIME_LIMIT_EXCEEDED", 30000);

  // 3. Memory-heavy program -> MLE
  await submitAndWait("Memory Heavy", MLE_CODE, "MEMORY_LIMIT_EXCEEDED", 30000);

  // 4. Fork bomb -> RUNTIME_ERROR
  await submitAndWait("Fork Bomb", FORK_CODE, "RUNTIME_ERROR", 30000);

  // 5. Output spam -> RUNTIME_ERROR (due to our maxBuffer handler)
  await submitAndWait("Huge Output", OLE_CODE, "RUNTIME_ERROR", 30000);

  // 6. Runtime crash
  await submitAndWait("Runtime Crash", RE_CODE, "RUNTIME_ERROR", 30000);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   📊 Phase 4A Test Summary                                   ║
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
