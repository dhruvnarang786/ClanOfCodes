// ─── Submission Controller ───────────────────────────────────────────
//
// Handles code submissions for programming problems.
//
// Phase 2 flow (current):
//   1. Save submission to PostgreSQL with status PENDING
//   2. Enqueue a judging job to BullMQ (Redis)
//   3. Return the submission immediately (non-blocking)
//   4. Worker (separate process) picks up the job and processes it
//
// Access control:
//   - Create: Any authenticated user
//   - List:   Students see only their own; Professors see all
//   - Detail: Students see only their own; Professors see any

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { submissionQueue } from "../queue/submissionQueue";

// ─── POST /api/submissions ───────────────────────────────────────────
// Submit code for a problem.
//   1. Save to PostgreSQL (PENDING)
//   2. Add judging job to BullMQ
//   3. Return immediately — worker processes asynchronously

export const createSubmission = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { problemId, code, language } = req.body;

  // Verify the problem exists
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, title: true },
  });

  if (!problem) {
    throw new ApiError(404, "Problem not found.");
  }

  // Step 1: Create the submission with PENDING status
  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId,
      code,
      language: language || "CPP",
      status: "PENDING",
    },
    include: {
      problem: { select: { id: true, title: true, slug: true } },
    },
  });

  console.log(`[API] 📝 Submission created: ${submission.id} for problem "${problem.title}"`);

  // Step 2: Enqueue judging job to BullMQ
  // Only the submissionId is passed — the worker fetches full data from PostgreSQL.
  // This keeps the Redis payload tiny and avoids stale data issues.
  const job = await submissionQueue.add("judge", {
    submissionId: submission.id,
  });

  console.log(`[API] 📤 Job enqueued: ${job.id} → submission ${submission.id}`);

  // Step 3: Return immediately — the worker will process the submission asynchronously
  res.status(201).json(
    new ApiResponse(
      201,
      {
        id: submission.id,
        status: submission.status,
        problemId: submission.problemId,
        problem: submission.problem,
        language: submission.language,
        createdAt: submission.createdAt,
        jobId: job.id,
      },
      "Submission received and queued for judging."
    )
  );
};

// ─── GET /api/submissions ────────────────────────────────────────────
// List submissions. Students see only their own; Professors see all.
// Query params: ?page=1&limit=20&problemId=xxx

export const listSubmissions = async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  // Build filter
  const where: Record<string, unknown> = {};

  // Students can only see their own submissions
  if (role === "STUDENT") {
    where.userId = userId;
  } else if (role === "PROFESSOR") {
    // Professors can only see submissions for problems they created
    where.problem = { creatorId: userId };
  }

  // Optional filter by problemId
  if (req.query.problemId) {
    where.problemId = req.query.problemId as string;
  }

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        language: true,
        status: true,
        verdict: true,
        executionTimeMs: true,
        memoryUsedMb: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        problem: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.submission.count({ where }),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
};

// ─── GET /api/submissions/:id ────────────────────────────────────────
// Get submission detail including code.
// Students can only view their own; Professors can view any.

export const getSubmission = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { userId, role } = req.user!;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      problem: { select: { id: true, title: true, slug: true, difficulty: true, creatorId: true } },
    },
  });

  if (!submission) {
    throw new ApiError(404, "Submission not found.");
  }

  // Students can only view their own submissions
  if (role === "STUDENT" && submission.userId !== userId) {
    throw new ApiError(403, "You can only view your own submissions.");
  } else if (role === "PROFESSOR" && (submission as any).problem.creatorId !== userId) {
    throw new ApiError(403, "You can only view submissions for your own problems.");
  }

  res.status(200).json(new ApiResponse(200, submission));
};
