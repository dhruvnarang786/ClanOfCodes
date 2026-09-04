// ─── Submission Queue (BullMQ Producer) ──────────────────────────────
//
// This module creates the BullMQ Queue that the API server uses to
// enqueue judging jobs. The queue lives in Redis — it's just a list
// of job payloads waiting to be processed.
//
// Architecture:
//
//   POST /api/submissions
//     → Save to PostgreSQL (PENDING)
//     → submissionQueue.add("judge", { submissionId })  ← THIS MODULE
//     → Return 201 to client
//
//   Later, the Worker (separate process) picks up the job from Redis.
//
// Why only pass submissionId in the job payload?
//   - The full submission data (code, test cases, etc.) is already in PostgreSQL.
//   - Passing only the ID keeps the Redis payload tiny (~50 bytes).
//   - The worker fetches fresh data from PostgreSQL, which avoids stale data issues.
//   - If the submission is deleted before processing, the worker detects it gracefully.

import { Queue } from "bullmq";
import { redisConnection } from "./connection";

/**
 * The submission queue. Jobs are added by the API server and
 * consumed by the submission worker (src/worker/submissionWorker.ts).
 */
export const submissionQueue = new Queue("submission-judging", {
  connection: redisConnection,
  defaultJobOptions: {
    // ─── Retry Behavior ───────────────────────────────────────────
    // If the worker crashes or throws during processing, BullMQ will
    // retry the job up to 3 times with exponential backoff:
    //   Attempt 1 fail → wait 2s  → retry
    //   Attempt 2 fail → wait 4s  → retry
    //   Attempt 3 fail → wait 8s  → retry
    //   Attempt 4 fail → move to "failed" state
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },

    // ─── Job Cleanup ──────────────────────────────────────────────
    // Keep the last 100 completed and 50 failed jobs in Redis
    // for debugging/monitoring. Older ones are automatically purged.
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Gracefully close the queue's Redis connection.
 * Called during server shutdown.
 */
export const closeQueue = async (): Promise<void> => {
  await submissionQueue.close();
};
