// Phase 2 API test script — tests the full queue flow
// Run with: node test-api.mjs
const BASE = "http://localhost:5001/api";

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

async function run() {
  console.log("\n═══ PHASE 2: JOB QUEUE + WORKER ═══\n");

  // ─── Step 1: Login as Professor (create problem) ───────────────
  let profRes = await api("Register Professor", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "prof3@test.com", password: "password123", name: "Prof Queue", role: "PROFESSOR" }),
  });
  let PROF_TOKEN = profRes?.data?.token;
  if (!PROF_TOKEN) {
    profRes = await api("Login Professor", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "prof3@test.com", password: "password123" }),
    });
    PROF_TOKEN = profRes?.data?.token;
  }

  // ─── Step 2: Login as Student (submit code) ────────────────────
  let stuRes = await api("Register Student", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "student3@test.com", password: "password123", name: "Student Queue", role: "STUDENT" }),
  });
  let STU_TOKEN = stuRes?.data?.token;
  if (!STU_TOKEN) {
    stuRes = await api("Login Student", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "student3@test.com", password: "password123" }),
    });
    STU_TOKEN = stuRes?.data?.token;
  }

  // ─── Step 3: Create a problem ──────────────────────────────────
  const prob = await api("Create Problem", "/problems", {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({ title: "Queue Test Problem", description: "Test the job queue.", difficulty: "EASY" }),
  });
  const PROBLEM_ID = prob?.data?.id;
  console.log(`   → Problem ID: ${PROBLEM_ID}`);

  console.log("\n─── SUBMISSION + QUEUE FLOW ─────────────────────\n");

  // ─── Step 4: Submit code (triggers queue) ──────────────────────
  const sub = await api("Submit Code (Student)", "/submissions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
    body: JSON.stringify({
      problemId: PROBLEM_ID,
      code: '#include<iostream>\nint main() { std::cout << "Hello"; return 0; }',
      language: "CPP",
    }),
  });
  const SUB_ID = sub?.data?.id;
  const JOB_ID = sub?.data?.jobId;
  console.log(`   → Submission ID: ${SUB_ID}`);
  console.log(`   → Job ID:        ${JOB_ID}`);
  console.log(`   → Initial Status: ${sub?.data?.status}`);

  // ─── Step 5: Check submission immediately (should be PENDING or JUDGING) ──
  const immediate = await api("Check Immediately", `/submissions/${SUB_ID}`, {
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
  });
  console.log(`   → Status: ${immediate?.data?.status}, Verdict: ${immediate?.data?.verdict || "null"}`);

  // ─── Step 6: Wait for worker to process ────────────────────────
  console.log("\n⏳ Waiting 3 seconds for worker to process...\n");
  await sleep(3000);

  // ─── Step 7: Check submission again (should be COMPLETED) ──────
  const after = await api("Check After Processing", `/submissions/${SUB_ID}`, {
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
  });
  console.log(`   → Status:          ${after?.data?.status}`);
  console.log(`   → Verdict:         ${after?.data?.verdict}`);
  console.log(`   → Execution Time:  ${after?.data?.executionTimeMs}ms`);
  console.log(`   → Memory Used:     ${after?.data?.memoryUsedMb}MB`);

  // ─── Step 8: Verify with a second submission ───────────────────
  console.log("\n─── SECOND SUBMISSION (verify consistency) ──────\n");

  const sub2 = await api("Submit Code #2", "/submissions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
    body: JSON.stringify({
      problemId: PROBLEM_ID,
      code: '#include<iostream>\nint main() { return 0; }',
      language: "CPP",
    }),
  });
  const SUB_ID_2 = sub2?.data?.id;
  console.log(`   → Submission #2 ID: ${SUB_ID_2}`);

  await sleep(3000);

  const after2 = await api("Check Submission #2", `/submissions/${SUB_ID_2}`, {
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
  });
  console.log(`   → Status:  ${after2?.data?.status}`);
  console.log(`   → Verdict: ${after2?.data?.verdict}`);

  // ─── Step 9: List all submissions (should show both) ───────────
  console.log("\n─── LIST ALL SUBMISSIONS ────────────────────────\n");

  const list = await api("List Student Submissions", "/submissions", {
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
  });
  const subs = list?.data?.submissions || [];
  for (const s of subs) {
    console.log(`   ${s.id} | ${s.status.padEnd(10)} | ${(s.verdict || "null").padEnd(10)} | ${s.executionTimeMs || "-"}ms`);
  }

  // ─── Step 10: Existing Phase 1 tests still pass ────────────────
  console.log("\n─── REGRESSION: PHASE 1 TESTS ──────────────────\n");

  await api("Health Check", "/health");
  await api("List Problems (public)", "/problems");
  await api("Get Profile", "/auth/me", { headers: { Authorization: `Bearer ${PROF_TOKEN}` } });
  await api("No Auth (expect 401)", "/auth/me");
  await api("Student Create Problem (expect 403)", "/problems", {
    method: "POST",
    headers: { Authorization: `Bearer ${STU_TOKEN}` },
    body: JSON.stringify({ title: "Nope", description: "Fail", difficulty: "EASY" }),
  });

  console.log("\n═══ ALL PHASE 2 TESTS COMPLETE ═══\n");
}

run().catch(console.error);
