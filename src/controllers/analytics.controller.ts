import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

// ─── GET /api/analytics/dashboard ────────────────────────────────────
// Get aggregate stats for the logged-in professor

export const getProfessorDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const totalProblems = await prisma.problem.count({ where: { creatorId: userId } });

  const submissions = await prisma.submission.findMany({
    where: { problem: { creatorId: userId } },
    select: { verdict: true },
  });

  const totalSubmissions = submissions.length;
  const acceptedSubmissions = submissions.filter(s => s.verdict === "ACCEPTED").length;
  const acceptanceRate = totalSubmissions > 0 
    ? Math.round((acceptedSubmissions / totalSubmissions) * 1000) / 10 
    : 0;

  res.status(200).json(
    new ApiResponse(200, {
      totalProblems,
      totalSubmissions,
      acceptedSubmissions,
      acceptanceRate,
    })
  );
};

// ─── GET /api/analytics/problems/:id ──────────────────────────────────
// Get per-problem stats for a specific problem

export const getProblemAnalytics = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  const problem = await prisma.problem.findUnique({
    where: { id },
    select: { creatorId: true },
  });

  if (!problem) {
    throw new ApiError(404, "Problem not found.");
  }

  if (problem.creatorId !== userId) {
    throw new ApiError(403, "You can only view analytics for your own problems.");
  }

  const submissions = await prisma.submission.findMany({
    where: { problemId: id },
    select: { verdict: true },
  });

  const stats = {
    totalSubmissions: submissions.length,
    accepted: 0,
    wrongAnswer: 0,
    compilationError: 0,
    runtimeError: 0,
    timeLimitExceeded: 0,
    acceptanceRate: 0,
  };

  submissions.forEach(s => {
    if (s.verdict === "ACCEPTED") stats.accepted++;
    else if (s.verdict === "WRONG_ANSWER") stats.wrongAnswer++;
    else if (s.verdict === "COMPILATION_ERROR") stats.compilationError++;
    else if (s.verdict === "RUNTIME_ERROR") stats.runtimeError++;
    else if (s.verdict === "TIME_LIMIT_EXCEEDED") stats.timeLimitExceeded++;
  });

  stats.acceptanceRate = stats.totalSubmissions > 0 
    ? Math.round((stats.accepted / stats.totalSubmissions) * 1000) / 10 
    : 0;

  res.status(200).json(new ApiResponse(200, stats));
};
