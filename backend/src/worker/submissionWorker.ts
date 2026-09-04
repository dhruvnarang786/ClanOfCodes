// ─── Submission Worker (BullMQ Consumer) ─────────────────────────────
//
// This file runs as a SEPARATE PROCESS from the API server.
// It connects to Redis, picks up judging jobs, and processes them.
//
// Architecture (Phase 3C):
//
//   API Server (process 1)         Worker (process 2) ← THIS FILE
//   ─────────────────────          ──────────────────────────────
//   POST /api/submissions          Listens on Redis queue
//     → Save to PostgreSQL         Picks up { submissionId }
//     → Enqueue job to Redis       Fetches submission + test cases from PG
//     → Return 201                 Updates status: PENDING → JUDGING
//                                  For each test case:
//                                    → DockerExecutor compiles & runs
//                                    → Compares stdout vs expectedOutput
//                                  Updates status: JUDGING → COMPLETED
//                                  Sets verdict + executionTimeMs
//
// Why a separate process?
//   - The worker does CPU-heavy work (Docker compilation/execution).
//   - Running it separately prevents blocking the API server.
//   - You can scale workers independently (run 5 workers on beefy machines).
//   - If a worker crashes, the API server keeps running.
//
// Idempotency:
//   The worker checks the current status before processing. If a job is
//   retried (BullMQ retry or duplicate delivery), the worker skips
//   submissions that are already JUDGING or COMPLETED. This prevents
//   double-processing.
//
// Run this file: npx tsx src/worker/submissionWorker.ts

import { Worker, Job } from "bullmq";
import { redisConnection } from "../queue/connection";
import { prisma } from "../lib/prisma";
import { executeCode } from "../executor/dockerExecutor";
import type { ExecutionResult } from "../executor/types";

// ─── Job Payload Type ────────────────────────────────────────────────
interface SubmissionJobData {
  submissionId: string;
}

// ─── Logging Helper ──────────────────────────────────────────────────
function log(submissionId: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Worker] [${submissionId}] ${message}`);
}

// ─── Output Comparison ──────────────────────────────────────────────
// Compares program output against expected output.
// Trims trailing whitespace from both sides to be forgiving of minor
// formatting differences (trailing newline, spaces at end of lines).

function normalizeOutput(output: string): string {
  return output
    .split("\n")
    .map((line) => line.trimEnd())  // Remove trailing spaces per line
    .join("\n")
    .trim();                         // Remove leading/trailing blank lines
}

function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

// ─── Job Processor ───────────────────────────────────────────────────
// This function is called once for each job that the worker picks up.

async function processSubmission(job: Job<SubmissionJobData>): Promise<void> {
  const { submissionId } = job.data;

  log(submissionId, `📥 Received job (attempt ${job.attemptsMade + 1}/${(job.opts?.attempts ?? 3)})`);

  // ─── Step 1: Fetch submission + problem + test cases ────────────
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          timeLimitMs: true,
          memoryLimitMb: true,
        },
      },
    },
  });

  if (!submission) {
    log(submissionId, "⚠️  Submission not found in database. Skipping (may have been deleted).");
    return; // Don't throw — no point retrying a deleted submission
  }

  // ─── Step 2: Idempotency check ────────────────────────────────
  // If the worker already processed this submission (e.g., retry after
  // crash), skip it to prevent double-processing only if it is already finished.
  // If it's JUDGING, it may be a stalled job that BullMQ is retrying.
  if (submission.status === "COMPLETED" || submission.status === "FAILED") {
    log(submissionId, `⚠️  Status is already ${submission.status}. Skipping (idempotent).`);
    return;
  }

  // ─── Step 3: Fetch test cases ─────────────────────────────────
  const testCases = await prisma.testCase.findMany({
    where: { problemId: submission.problemId },
    orderBy: { createdAt: "asc" },
  });

  if (testCases.length === 0) {
    log(submissionId, "⚠️  No test cases found for this problem. Marking as SYSTEM_ERROR.");
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        verdict: "SYSTEM_ERROR",
      },
    });
    return;
  }

  log(submissionId, `📋 Found ${testCases.length} test case(s) for "${submission.problem.title}".`);

  // ─── Step 4: Update status to JUDGING ─────────────────────────
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "JUDGING" },
  });
  log(submissionId, `⚙️  Status → JUDGING`);

  // ─── Step 5: Execute against each test case sequentially ──────
  //
  // Strategy:
  //   - Run each test case one at a time
  //   - On the first non-ACCEPTED result, stop and use that verdict
  //   - If all test cases pass, verdict is ACCEPTED
  //   - Track the maximum execution time across all test cases
  //
  // Why sequential?
  //   In Phase 3C we keep it simple. Parallel execution would
  //   require more resource management and Docker concurrency control.

  let finalVerdict: string = "ACCEPTED";
  let maxExecutionTimeMs = 0;
  let compileError: string | null = null;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    log(submissionId, `🧪 Test case ${i + 1}/${testCases.length}...`);

    let result: ExecutionResult;
    try {
      result = await executeCode({
        sourceCode: submission.code,
        stdin: tc.input,
        timeLimitMs: submission.problem.timeLimitMs,
        memoryLimitMb: submission.problem.memoryLimitMb,
      });
    } catch (error: unknown) {
      // Unexpected error in the executor itself (e.g., Docker daemon down)
      const message = error instanceof Error ? error.message : String(error);
      log(submissionId, `💀 Executor threw an exception: ${message}`);
      finalVerdict = "SYSTEM_ERROR";
      break;
    }

    // Track execution time (use the max across all test cases)
    if (result.executionTimeMs !== null && result.executionTimeMs > maxExecutionTimeMs) {
      maxExecutionTimeMs = result.executionTimeMs;
    }

    // ─── Handle non-ACCEPTED executor verdicts ──────────────────
    // These verdicts mean the code didn't run successfully — no need
    // to compare output.
    if (result.verdict === "COMPILATION_ERROR") {
      finalVerdict = "COMPILATION_ERROR";
      compileError = result.compileError;
      log(submissionId, `🔴 Compilation error on test case ${i + 1}.`);
      break; // No point running more test cases
    }

    if (result.verdict === "RUNTIME_ERROR") {
      finalVerdict = "RUNTIME_ERROR";
      log(submissionId, `💥 Runtime error on test case ${i + 1}.`);
      break;
    }

    if (result.verdict === "TIME_LIMIT_EXCEEDED") {
      finalVerdict = "TIME_LIMIT_EXCEEDED";
      log(submissionId, `⏰ Time limit exceeded on test case ${i + 1}.`);
      break;
    }

    if (result.verdict === "MEMORY_LIMIT_EXCEEDED") {
      finalVerdict = "MEMORY_LIMIT_EXCEEDED";
      log(submissionId, `💾 Memory limit exceeded on test case ${i + 1}.`);
      break;
    }

    if (result.verdict === "SYSTEM_ERROR") {
      finalVerdict = "SYSTEM_ERROR";
      log(submissionId, `💀 System error on test case ${i + 1}.`);
      break;
    }

    // ─── Verdict is ACCEPTED from executor — compare output ─────
    // The executor's ACCEPTED means "compiled and ran without crashing".
    // We still need to check if the output matches the expected output.
    if (!outputsMatch(result.stdout, tc.expectedOutput)) {
      finalVerdict = "WRONG_ANSWER";
      log(
        submissionId,
        `❌ Wrong answer on test case ${i + 1}. ` +
        `Expected: ${JSON.stringify(normalizeOutput(tc.expectedOutput).substring(0, 100))}, ` +
        `Got: ${JSON.stringify(normalizeOutput(result.stdout).substring(0, 100))}`
      );
      break;
    }

    log(submissionId, `✅ Test case ${i + 1} passed.`);
  }

  // ─── Step 6: Update submission with final verdict ─────────────
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: "COMPLETED",
      verdict: finalVerdict as any,
      executionTimeMs: maxExecutionTimeMs > 0 ? maxExecutionTimeMs : null,
      compileError,
    },
  });

  log(submissionId, `🏁 Status → COMPLETED | Verdict: ${finalVerdict} | Time: ${maxExecutionTimeMs}ms`);
}

// ─── Create the BullMQ Worker ────────────────────────────────────────
// `concurrency: 1` because each job spawns a Docker container which is
// resource-heavy. Scale by running multiple worker processes instead.

const worker = new Worker("submission-judging", processSubmission, {
  connection: redisConnection,
  concurrency: 1,
});

// ─── Worker Event Listeners ──────────────────────────────────────────

worker.on("ready", () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ⚡ CompilerJudge Worker (Phase 3C)                  ║
║                                                       ║
║   Queue:       submission-judging                     ║
║   Concurrency: 1 (Docker containers are heavy)        ║
║   Executor:    DockerExecutor → compilerjudge-compiler ║
║   Status:      LISTENING for jobs...                  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

worker.on("completed", (job: Job) => {
  log(job.data.submissionId, `🏁 Job ${job.id} completed successfully.`);
});

worker.on("failed", (job: Job | undefined, error: Error) => {
  const subId = job?.data?.submissionId || "unknown";
  log(subId, `❌ Job ${job?.id} failed: ${error.message}`);
});

worker.on("error", (error: Error) => {
  console.error(`[Worker] Connection error: ${error.message}`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────
// When the worker process receives SIGTERM or SIGINT, it:
//   1. Stops picking up new jobs
//   2. Waits for currently-processing jobs to finish
//   3. Closes the Redis connection
//   4. Disconnects Prisma
//
// This prevents data corruption from half-processed submissions.

async function gracefulShutdown(signal: string) {
  console.log(`\n[Worker] ${signal} received. Shutting down gracefully...`);
  console.log("[Worker] Waiting for active jobs to complete...");

  await worker.close();
  console.log("[Worker] Worker closed.");

  await prisma.$disconnect();
  console.log("[Worker] Prisma disconnected.");

  console.log("[Worker] Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
