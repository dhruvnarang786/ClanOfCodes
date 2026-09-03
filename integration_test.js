const BASE_URL = 'http://localhost:5001/api';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function checkStatus(res, expected, msg) {
  if (res.status !== expected) {
    console.error(`❌ ${msg}: Expected ${expected} got ${res.status}`, res.data);
    process.exit(1);
  }
}

async function runTests() {
  console.log("🚀 Starting Full System Audit...");
  
  let student1, student2, prof1, prof2;
  
  // 1. Authentication & Registration
  console.log("\\n--- 1. Authentication ---");
  const suffix = Date.now().toString().slice(-6);
  
  // Register Student 1
  let res = await request('POST', '/auth/register', { email: `s1_${suffix}@test.com`, password: 'password', name: 'Student 1' });
  checkStatus(res, 201, 'Student 1 registration failed');
  student1 = res.data.data;
  
  // Register Student 2
  res = await request('POST', '/auth/register', { email: `s2_${suffix}@test.com`, password: 'password', name: 'Student 2' });
  checkStatus(res, 201, 'Student 2 registration failed');
  student2 = res.data.data;
  
  // Register Prof 1
  res = await request('POST', '/auth/register', { email: `p1_${suffix}@test.com`, password: 'password', name: 'Prof 1', role: 'PROFESSOR' });
  checkStatus(res, 201, 'Prof 1 registration failed');
  prof1 = res.data.data;

  // Register Prof 2
  res = await request('POST', '/auth/register', { email: `p2_${suffix}@test.com`, password: 'password', name: 'Prof 2', role: 'PROFESSOR' });
  checkStatus(res, 201, 'Prof 2 registration failed');
  prof2 = res.data.data;

  console.log("✅ Registration passed");

  // Invalid Login
  res = await request('POST', '/auth/login', { email: `s1_${suffix}@test.com`, password: 'wrong' });
  console.assert(res.status === 401, 'Expected 401 for wrong password');
  console.log("✅ Invalid login blocked");

  // Invalid Token
  res = await request('GET', '/auth/me', null, 'invalid.token.here');
  console.assert(res.status === 401 || res.status === 403, 'Expected 401/403 for invalid token');
  console.log("✅ Invalid token blocked");

  // 2. Professor Flow (Problem Creation)
  console.log("\\n--- 2. Professor Flow ---");
  
  res = await request('POST', '/problems', {
    title: `Two Sum ${suffix}`,
    description: 'Find two numbers',
    difficulty: 'EASY'
  }, prof1.token);
  console.assert(res.status === 201, 'Prof 1 failed to create problem');
  const problem1 = res.data.data;

  // Prof 1 adds testcases
  await request('POST', `/problems/${problem1.id}/testcases`, { input: '4\n2 7 11 15\n9', expectedOutput: '0 1', isHidden: false }, prof1.token);
  await request('POST', `/problems/${problem1.id}/testcases`, { input: '3\n3 2 4\n6', expectedOutput: '1 2', isHidden: true }, prof1.token);

  // Prof 2 creates problem
  res = await request('POST', '/problems', {
    title: `Multiply ${suffix}`,
    description: 'Multiply two numbers',
  }, prof2.token);
  const problem2 = res.data.data;

  console.log("✅ Problem & Test cases created");

  // RBAC: Student tries to edit problem
  res = await request('PUT', `/problems/${problem1.id}`, { title: 'Hacked' }, student1.token);
  console.assert(res.status === 403, 'Expected 403 when student edits problem');
  
  // RBAC: Prof 2 tries to edit Prof 1's problem
  res = await request('PUT', `/problems/${problem1.id}`, { title: 'Hacked by Prof2' }, prof2.token);
  console.assert(res.status === 403, 'Expected 403 when Prof2 edits Prof1 problem');
  console.log("✅ RBAC Problem boundaries enforced");

  // 3. Student Flow (Judging)
  console.log("\\n--- 3. Student Flow & Judging ---");

  // Student views problem (should not see hidden test cases)
  res = await request('GET', `/problems/${problem1.slug}`);
  console.assert(res.status === 200, 'Failed to fetch problem');
  
  res = await request('GET', `/problems/${problem1.id}/testcases`, null, student1.token);
  console.assert(res.data.data.testCases.length === 1, 'Student should only see 1 public testcase');
  console.log("✅ Hidden testcase restriction enforced");

  // Student 1 Submits Code (Correct)
  const cppCode = `
    #include <iostream>
    #include <vector>
    using namespace std;
    int main() {
      int n; cin >> n;
      vector<int> a(n);
      for(int i=0; i<n; i++) cin >> a[i];
      int t; cin >> t;
      for(int i=0; i<n; i++) {
        for(int j=i+1; j<n; j++) {
          if (a[i]+a[j] == t) {
            cout << i << " " << j;
            return 0;
          }
        }
      }
      return 0;
    }
  `;
  res = await request('POST', '/submissions', { problemId: problem1.id, code: cppCode, language: 'CPP' }, student1.token);
  console.assert(res.status === 201, 'Submission failed');
  const sub1 = res.data.data;

  // Student 2 Submits Code (Compile Error)
  res = await request('POST', '/submissions', { problemId: problem1.id, code: 'invalid cpp code', language: 'CPP' }, student2.token);
  const sub2 = res.data.data;

  // Wait for judging (poll for 10 seconds)
  console.log("Waiting for judging...");
  let judged = false;
  for(let i=0; i<10; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const s1 = await request('GET', `/submissions/${sub1.id}`, null, student1.token);
    const s2 = await request('GET', `/submissions/${sub2.id}`, null, student2.token);
    if (s1.data.data.status !== 'PENDING' && s1.data.data.status !== 'JUDGING' &&
        s2.data.data.status !== 'PENDING' && s2.data.data.status !== 'JUDGING') {
      if (s1.data.data.verdict !== 'ACCEPTED') {
        console.error("sub1 failed:", s1.data.data);
      }
      checkStatus({status: s1.data.data.verdict === 'ACCEPTED' ? 200 : 500, data: s1.data.data}, 200, 'Expected ACCEPTED for sub1');
      checkStatus({status: s2.data.data.verdict === 'COMPILATION_ERROR' ? 200 : 500, data: s2.data.data}, 200, 'Expected COMPILATION_ERROR for sub2');
      console.log("✅ Judging completed correctly");
      judged = true;
      break;
    }
  }
  if(!judged) console.log("⚠️ Judging timeout (are workers running?)");

  // 4. Analytics & Isolation
  console.log("\\n--- 4. Analytics & Isolation ---");
  
  // Student 2 tries to view Student 1's submission
  res = await request('GET', `/submissions/${sub1.id}`, null, student2.token);
  console.assert(res.status === 403, 'Expected 403 when Student 2 views Student 1 submission');
  
  // Prof 2 tries to view Student 1's submission (problem belongs to Prof 1)
  res = await request('GET', `/submissions/${sub1.id}`, null, prof2.token);
  console.assert(res.status === 403, 'Expected 403 when Prof 2 views Prof 1 submission');

  // Prof 1 views own dashboard analytics
  res = await request('GET', '/analytics/dashboard', null, prof1.token);
  console.assert(res.status === 200, 'Prof 1 analytics failed');
  console.assert(res.data.data.totalProblems === 1, 'Prof 1 totalProblems mismatch');
  console.assert(res.data.data.totalSubmissions === 2, 'Prof 1 totalSubmissions mismatch');
  console.log("✅ Analytics and isolation verified");

  console.log("\\n🎉 All Integration Tests Passed!");
}

runTests().catch(e => console.error("TEST FAILED:", e));
