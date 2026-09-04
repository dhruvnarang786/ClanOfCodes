// ─── Compiler Controller ──────────────────────────────────────────────
//
// Handles the online compiler (ad-hoc code execution, no DB write).
//
// POST /api/compiler/run
//   → authenticate (JWT required)
//   → validateBody
//   → executeCode() from DockerExecutor
//   → return ExecutionResult directly
//
// This is intentionally stateless for submissions, but it now saves 
// the run to CompilerHistory.
// The execution uses the same Docker sandbox, seccomp profile, and resource
// limits as the problem judging flow.

import { Request, Response } from "express";
import { executeCode } from "../executor";
import { ApiResponse } from "../utils/ApiResponse";
import { prisma } from "../lib/prisma";

// Default limits for ad-hoc compiler runs (more generous than problem judging)
const DEFAULT_TIME_LIMIT_MS = 5000;    // 5 seconds
const MAX_TIME_LIMIT_MS    = 10000;   // 10 seconds cap (user cannot exceed this)
const DEFAULT_MEMORY_LIMIT_MB = 128;  // 128 MB

// ─── POST /api/compiler/run ──────────────────────────────────────────
export const runCode = async (req: Request, res: Response): Promise<void> => {
  const { sourceCode, stdin = "", timeLimitMs } = req.body;
  const userId = req.user?.userId;

  // Clamp the caller-supplied time limit between 1s and MAX_TIME_LIMIT_MS
  const resolvedTimeLimit = timeLimitMs
    ? Math.min(Math.max(Number(timeLimitMs), 1000), MAX_TIME_LIMIT_MS)
    : DEFAULT_TIME_LIMIT_MS;

  const result = await executeCode({
    sourceCode,
    stdin,
    timeLimitMs: resolvedTimeLimit,
    memoryLimitMb: DEFAULT_MEMORY_LIMIT_MB,
  });

  if (userId) {
    try {
      await prisma.compilerHistory.create({
        data: {
          userId,
          code: sourceCode,
          language: "CPP",
          stdin,
          stdout: result.stdout,
          stderr: result.stderr,
          compileError: result.compileError,
          verdict: result.verdict,
          executionTimeMs: result.executionTimeMs,
        }
      });
    } catch (error) {
      console.error("Failed to save compiler history:", error);
    }
  }

  res.status(200).json(
    new ApiResponse(200, result, "Code executed.")
  );
};

// ─── GET /api/compiler/history ───────────────────────────────────────
export const getCompilerHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
    return;
  }

  const history = await prisma.compilerHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50, // Limit to 50 recent runs to prevent bloating
  });

  res.status(200).json(new ApiResponse(200, history, "Compiler history retrieved"));
};

// ─── DELETE /api/compiler/history/:id ────────────────────────────────
export const deleteCompilerHistoryEntry = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const historyId = req.params.id as string;

  if (!userId) {
    res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
    return;
  }

  const entry = await prisma.compilerHistory.findUnique({
    where: { id: historyId },
  });

  if (!entry) {
    res.status(404).json(new ApiResponse(404, null, "History entry not found"));
    return;
  }

  if (entry.userId !== userId) {
    res.status(403).json(new ApiResponse(403, null, "Forbidden"));
    return;
  }

  await prisma.compilerHistory.delete({
    where: { id: historyId },
  });

  res.status(200).json(new ApiResponse(200, null, "History entry deleted"));
};
