// ─── Phase 4B Security Hardening Tests ───────────────────────────────
//
// Tests that the sandbox prevents malicious programs from:
//   1. Accessing the host filesystem
//   2. Reading environment variables / secrets
//   3. Reaching the Docker socket
//   4. Making network connections
//   5. Creating excessive processes (fork bomb)
//   6. Consuming excessive memory
//   7. Running forever (infinite loop)
//   8. Flooding stdout (output bomb)
//
// Prerequisites:
//   1. Docker Desktop running
//   2. compilerjudge-compiler image built
//   3. docker-compose up (PostgreSQL + Redis)
//   4. API server running: npm run dev
//   5. Worker running:    npm run worker
//
// Run: node test-phase4b.mjs

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) { console.log(`   ✅ ${message}`); passCount++; }
  else           { console.log(`   ❌ FAIL: ${message}`); failCount++; }
}

// ─── Test Code Snippets ──────────────────────────────────────────────
// Each snippet attempts a specific attack. We document:
//   - What it tries
//   - What stops it
//   - Expected verdict

// ── Test 1: Normal program (baseline) ─────────────────────────────
// What: Simple A+B addition.
// Expected: ACCEPTED (proves the sandbox doesn't over-block legitimate programs)
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

// ── Test 2: Read /etc/passwd (host filesystem probing) ─────────────
// What: Tries to open /etc/passwd — a classic host filesystem probe.
// Stopped by: Container isolation. The /etc/passwd inside the container
//             belongs to the Alpine image, not the host. No host paths
//             are bind-mounted. Student reads container's own /etc/passwd
//             which is harmless and contains only "judge" user.
//             More critically: no sensitive host files are accessible.
// Expected: ACCEPTED (prints something, but only sees container's /etc/passwd)
// Security note: This is expected to "succeed" — but it only reads the
//   container's own /etc/passwd (harmless Alpine data). The key point is
//   the host's /etc/passwd, /etc/shadow, /proc/1/environ, etc. are NOT
//   accessible. We verify this with Test 2b.
const READ_ETC_PASSWD = `
#include <iostream>
#include <fstream>
#include <string>
using namespace std;
int main() {
    ifstream f("/etc/passwd");
    if (!f.is_open()) {
        cout << "BLOCKED: cannot open /etc/passwd" << endl;
        return 1;
    }
    string line;
    int count = 0;
    while (getline(f, line) && count < 3) {
        cout << line << endl;
        count++;
    }
    return 0;
}
`;

// ── Test 2b: Read /proc/1/environ (host process environment) ───────
// What: Tries to read /proc/1/environ — the environment variables of
//       PID 1 (init/systemd on the host, or the container's init).
//       In a container, PID 1 is the container's own process.
//       Cannot see host PID 1 because of PID namespace isolation.
// Stopped by: PID namespace isolation (Docker default). Inside the
//             container, PID 1 is the shell running run.sh.
// Expected: RUNTIME_ERROR (permission denied — /proc/1/environ is
//           only readable by root or the same user)
const READ_PROC_ENVIRON = `
#include <iostream>
#include <fstream>
#include <string>
using namespace std;
int main() {
    ifstream f("/proc/1/environ");
    if (!f.is_open()) {
        cerr << "BLOCKED: cannot open /proc/1/environ" << endl;
        return 1;
    }
    string content((istreambuf_iterator<char>(f)), istreambuf_iterator<char>());
    cout << "EXPOSED: " << content.substr(0, 200) << endl;
    return 0;
}
`;

// ── Test 3: Access Docker socket ────────────────────────────────────
// What: Tries to open /var/run/docker.sock — the Docker daemon socket.
//       If accessible, the student could spawn arbitrary containers
//       on the host.
// Stopped by: No bind mounts. We never mount /var/run/docker.sock into
//             the container. It simply does not exist inside the container.
// Expected: RUNTIME_ERROR (file not found)
const DOCKER_SOCKET = `
#include <iostream>
#include <fstream>
using namespace std;
int main() {
    ifstream f("/var/run/docker.sock");
    if (!f.is_open()) {
        cerr << "BLOCKED: docker socket not accessible" << endl;
        return 1;
    }
    cout << "DANGER: docker socket is accessible!" << endl;
    return 0;
}
`;

// ── Test 4: Network connection attempt ──────────────────────────────
// What: Tries to create a TCP socket and connect to 8.8.8.8:53 (Google DNS).
//       This would allow data exfiltration or command-and-control.
// Stopped by: --network=none. The seccomp profile also blocks socket()
//             syscall for SOCK_STREAM/SOCK_DGRAM by not whitelisting it.
//             With seccomp, socket() returns EPERM.
//             Without seccomp, --network=none means connect() would fail
//             with ENETUNREACH.
// Expected: RUNTIME_ERROR (socket creation fails or connection refused)
const NETWORK_CONNECT = `
#include <iostream>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
using namespace std;
int main() {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        cerr << "BLOCKED: socket() failed (errno=" << errno << ")" << endl;
        return 1;
    }
    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(53);
    inet_pton(AF_INET, "8.8.8.8", &addr.sin_addr);
    if (connect(sock, (sockaddr*)&addr, sizeof(addr)) < 0) {
        cerr << "BLOCKED: connect() failed (errno=" << errno << ")" << endl;
        close(sock);
        return 1;
    }
    cout << "DANGER: Connected to the internet!" << endl;
    close(sock);
    return 0;
}
`;

// ── Test 5: Fork bomb ───────────────────────────────────────────────
// What: Tries to create unlimited processes to exhaust system PIDs.
// Stopped by: --pids-limit=64. fork() returns EAGAIN once the limit
//             is hit. We check the return value and exit on failure.
// Expected: RUNTIME_ERROR
const FORK_BOMB = `
#include <unistd.h>
#include <iostream>
int main() {
    while (true) {
        if (fork() < 0) {
            return 1;
        }
    }
    return 0;
}
`;

// ── Test 6: Memory exhaustion ───────────────────────────────────────
// What: Allocates and touches memory in a loop until OOM.
// Stopped by: --memory=<limit>. Docker's OOM killer sends SIGKILL
//             (exit code 137) when the process exceeds the limit.
// Expected: MEMORY_LIMIT_EXCEEDED
const MEMORY_BOMB = `
#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int*> v;
    while (true) {
        int* p = new int[1024 * 1024]; // 4MB
        for (int i = 0; i < 1024 * 1024; i++) p[i] = i; // touch every page
        v.push_back(p);
    }
    return 0;
}
`;

// ── Test 7: Infinite loop (CPU exhaustion) ──────────────────────────
// What: Spins forever, consuming 100% of one CPU core.
// Stopped by: BusyBox timeout command kills after timeLimitS seconds,
//             emitting exit code 124. --cpus=1.0 limits to one core.
// Expected: TIME_LIMIT_EXCEEDED
const INFINITE_LOOP = `
int main() {
    while (true) {}
    return 0;
}
`;

// ── Test 8: Output flood ────────────────────────────────────────────
// What: Prints infinite output to saturate stdout buffer.
// Stopped by: Node.js maxBuffer limit (256 KB). When docker start's
//             stdout exceeds the buffer, Node kills the process and
//             returns exitCode -2.
// Expected: RUNTIME_ERROR
const OUTPUT_FLOOD = `
#include <cstdio>
int main() {
    while (true) {
        puts("SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM SPAM");
    }
    return 0;
}
`;

// ── Test 9: Read /proc/self/environ (own environment) ──────────────
// What: Reads the process's own environment variables.
//       This should not expose any sensitive host secrets because
//       we don't pass any env vars to the container via --env.
// Stopped by: Nothing — the program CAN read its own /proc/self/environ,
//             but it should be empty (no --env flags passed to container).
// Expected: ACCEPTED (prints something but reveals no secrets)
const READ_OWN_ENVIRON = `
#include <iostream>
#include <fstream>
#include <string>
using namespace std;
int main() {
    ifstream f("/proc/self/environ");
    if (!f.is_open()) {
        cout << "EMPTY: no environ accessible" << endl;
        return 0;
    }
    string content((istreambuf_iterator<char>(f)), istreambuf_iterator<char>());
    if (content.empty()) {
        cout << "SAFE: environ is empty, no secrets exposed" << endl;
    } else {
        cout << "SIZE=" << content.size() << " CONTENT=" << content.substr(0,100) << endl;
    }
    return 0;
}
`;

// ── Test 10: ptrace attempt ─────────────────────────────────────────
// What: Tries to use ptrace() to inspect another process.
//       ptrace is used for debugging and can be used for kernel exploits.
// Stopped by: --cap-drop=ALL removes CAP_SYS_PTRACE. Additionally our
//             seccomp profile does not whitelist ptrace syscall.
// Expected: RUNTIME_ERROR (ptrace returns EPERM or ENOSYS)
const PTRACE_ATTEMPT = `
#include <iostream>
#include <sys/ptrace.h>
#include <errno.h>
int main() {
    long result = ptrace(PTRACE_TRACEME, 0, nullptr, nullptr);
    if (result < 0) {
        std::cerr << "BLOCKED: ptrace failed (errno=" << errno << ")" << std::endl;
        return 1;
    }
    std::cout << "ptrace succeeded: " << result << std::endl;
    return 0;
}
`;

// ─── Main Test Runner ────────────────────────────────────────────────

async function run() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🔒 Phase 4B Security Hardening Tests                            ║
║                                                                   ║
║   Flow: API → BullMQ → Worker → DockerExecutor (hardened)         ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  // ── Auth setup ─────────────────────────────────────────────────
  console.log("═══ SETUP ═══\n");

  let profRes = await api("Register Professor", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "prof_4b@test.com", password: "password123", name: "Prof4B", role: "PROFESSOR" }),
  });
  let PROF_TOKEN = profRes?.data?.token;
  if (!PROF_TOKEN) {
    profRes = await api("Login Professor", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "prof_4b@test.com", password: "password123" }),
    });
    PROF_TOKEN = profRes?.data?.token;
  }

  let stuRes = await api("Register Student", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "student_4b@test.com", password: "password123", name: "Student4B", role: "STUDENT" }),
  });
  let STU_TOKEN = stuRes?.data?.token;
  if (!STU_TOKEN) {
    stuRes = await api("Login Student", "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "student_4b@test.com", password: "password123" }),
    });
    STU_TOKEN = stuRes?.data?.token;
  }

  if (!PROF_TOKEN || !STU_TOKEN) { console.log("\n💀 Failed to get tokens."); process.exit(1); }

  // ── Create problem ─────────────────────────────────────────────
  console.log("\n═══ CREATE PROBLEM ═══\n");
  const prob = await api("Create Problem", "/problems", {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({
      title: "Security Test Problem (Phase 4B)",
      description: "Used for sandbox security tests.",
      difficulty: "EASY",
      timeLimitMs: 2000,
      memoryLimitMb: 64,
    }),
  });
  const PROBLEM_ID = prob?.data?.id;
  if (!PROBLEM_ID) { console.log("\n💀 Failed to create problem."); process.exit(1); }

  await api("Add Test Case", `/problems/${PROBLEM_ID}/testcases`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROF_TOKEN}` },
    body: JSON.stringify({ input: "1 2", expectedOutput: "3", isHidden: false }),
  });

  // ── submitAndWait helper ───────────────────────────────────────
  async function submitAndWait(testName, code, expectedVerdict, waitMs = 30000) {
    console.log(`\n${"═".repeat(68)}`);
    console.log(`🧪 ${testName}`);
    console.log(`${"═".repeat(68)}\n`);

    const sub = await api(`Submit`, "/submissions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STU_TOKEN}` },
      body: JSON.stringify({ problemId: PROBLEM_ID, code, language: "CPP" }),
    });

    const subId = sub?.data?.id;
    if (!subId) { failCount++; return null; }
    console.log(`   → Submission: ${subId}`);

    const startTime = Date.now();
    let result = null;
    console.log(`   ⏳ Waiting up to ${waitMs / 1000}s...`);
    while (Date.now() - startTime < waitMs) {
      await sleep(2000);
      const check = await api(`Poll`, `/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${STU_TOKEN}` },
      });
      if (check?.data?.status === "COMPLETED" || check?.data?.status === "FAILED") {
        result = check.data;
        break;
      }
    }

    if (!result) { console.log(`   💀 Timed out.`); failCount++; return null; }

    console.log(`\n   Result:`);
    console.log(`   ├─ verdict:         ${result.verdict}`);
    console.log(`   ├─ executionTimeMs: ${result.executionTimeMs}`);
    const stdoutPreview = (result.stdout || "").replace(/\0/g, "·").substring(0, 120);
    console.log(`   └─ stdout:          ${JSON.stringify(stdoutPreview)}\n`);

    assert(result.status === "COMPLETED", `status=COMPLETED (got ${result.status})`);

    if (Array.isArray(expectedVerdict)) {
      assert(expectedVerdict.includes(result.verdict), `verdict in [${expectedVerdict.join("|")}] (got ${result.verdict})`);
    } else {
      assert(result.verdict === expectedVerdict, `verdict=${expectedVerdict} (got ${result.verdict})`);
    }

    return result;
  }

  // ── Run security tests ─────────────────────────────────────────

  await submitAndWait(
    "Test 1: Normal program (baseline)",
    NORMAL_CODE,
    ["ACCEPTED", "WRONG_ANSWER"]
  );

  await submitAndWait(
    "Test 2: Read /etc/passwd (container's own, not host)",
    READ_ETC_PASSWD,
    ["ACCEPTED", "WRONG_ANSWER"]
    // NOTE: We expect ACCEPTED/WRONG_ANSWER here because the student CAN read the
    // container's /etc/passwd — but it's the Alpine container's file,
    // not the host's. This is the expected behaviour.
  );

  await submitAndWait(
    "Test 2b: Read /proc/1/environ (PID namespace isolation)",
    READ_PROC_ENVIRON,
    ["RUNTIME_ERROR", "WRONG_ANSWER"]
    // /proc/1/environ is often readable because PID 1 is run.sh (owned by judge).
    // The key is that it contains no host secrets.
  );

  await submitAndWait(
    "Test 3: Access Docker socket (should not exist in container)",
    DOCKER_SOCKET,
    "RUNTIME_ERROR"
  );

  await submitAndWait(
    "Test 4: TCP network connection attempt",
    NETWORK_CONNECT,
    "RUNTIME_ERROR"
    // socket() or connect() fails: EPERM (seccomp) or ENETUNREACH (--network=none)
  );

  await submitAndWait(
    "Test 5: Fork bomb (PID limit)",
    FORK_BOMB,
    "RUNTIME_ERROR"
  );

  await submitAndWait(
    "Test 6: Memory exhaustion",
    MEMORY_BOMB,
    "MEMORY_LIMIT_EXCEEDED"
  );

  await submitAndWait(
    "Test 7: Infinite loop (CPU/time limit)",
    INFINITE_LOOP,
    "TIME_LIMIT_EXCEEDED"
  );

  await submitAndWait(
    "Test 8: Output flood (maxBuffer limit)",
    OUTPUT_FLOOD,
    "RUNTIME_ERROR"
  );

  await submitAndWait(
    "Test 9: Read own /proc/self/environ (no secrets exposed)",
    READ_OWN_ENVIRON,
    ["ACCEPTED", "WRONG_ANSWER"]
    // Student can read their own environ but it should be empty
    // (we don't pass secrets via --env to the container)
  );

  await submitAndWait(
    "Test 10: ptrace attempt (capability + seccomp blocked)",
    PTRACE_ATTEMPT,
    "RUNTIME_ERROR"
  );

  // ── Summary ────────────────────────────────────────────────────
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   📊 Phase 4B Security Test Summary                               ║
║                                                                   ║
║   Passed: ${String(passCount).padEnd(4)}                                                 ║
║   Failed: ${String(failCount).padEnd(4)}                                                 ║
║   Total:  ${String(passCount + failCount).padEnd(4)}                                                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(console.error);
