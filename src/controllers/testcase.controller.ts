// ─── TestCase Controller ─────────────────────────────────────────────
//
// Manages test cases for programming problems.
//
// Access control:
//   - Create/Update/Delete: PROFESSOR only, must own the parent problem
//   - List: Authenticated users — PROFESSOR sees all, STUDENT sees non-hidden only
//
// Why hidden test cases?
//   Students shouldn't see all test inputs/outputs. Hidden test cases
//   prevent students from hardcoding expected outputs. Professors need
//   to see everything for management.

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

// ─── Helper: Verify problem exists and is owned by the user ─────────
const verifyProblemOwnership = async (problemId: string, userId: string) => {
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, creatorId: true },
  });

  if (!problem) {
    throw new ApiError(404, "Problem not found.");
  }

  if (problem.creatorId !== userId) {
    throw new ApiError(403, "You can only manage test cases for your own problems.");
  }

  return problem;
};

// ─── POST /api/problems/:problemId/testcases ─────────────────────────
// Add a test case to a problem. PROFESSOR only, must own the problem.

export const createTestCase = async (req: Request, res: Response): Promise<void> => {
  const problemId = req.params.problemId as string;
  const userId = req.user!.userId;
  const { input, expectedOutput, isHidden } = req.body;

  await verifyProblemOwnership(problemId, userId);

  const testCase = await prisma.testCase.create({
    data: {
      problemId,
      input: input.trim(),
      expectedOutput: expectedOutput.trim(),
      isHidden: isHidden !== undefined ? isHidden : true,
    },
  });

  res.status(201).json(
    new ApiResponse(201, testCase, "Test case created successfully.")
  );
};

// ─── GET /api/problems/:problemId/testcases ──────────────────────────
// List test cases for a problem.
// PROFESSOR sees all; STUDENT sees only non-hidden test cases.

export const listTestCases = async (req: Request, res: Response): Promise<void> => {
  const problemId = req.params.problemId as string;
  const userRole = req.user!.role;

  // Verify the problem exists
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });

  if (!problem) {
    throw new ApiError(404, "Problem not found.");
  }

  // Build filter: students only see non-hidden test cases
  const where: Record<string, unknown> = { problemId };
  if (userRole === "STUDENT") {
    where.isHidden = false;
  }

  const testCases = await prisma.testCase.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json(
    new ApiResponse(200, {
      testCases,
      total: testCases.length,
      note:
        userRole === "STUDENT"
          ? "Only sample test cases are shown. Hidden test cases are used during judging."
          : undefined,
    })
  );
};

// ─── PUT /api/testcases/:id ──────────────────────────────────────────
// Update a test case. PROFESSOR only, must own the parent problem.

export const updateTestCase = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  // Find the test case and its parent problem
  const existing = await prisma.testCase.findUnique({
    where: { id },
    include: { problem: { select: { creatorId: true } } },
  });

  if (!existing) {
    throw new ApiError(404, "Test case not found.");
  }

  if ((existing as any).problem.creatorId !== userId) {
    throw new ApiError(403, "You can only update test cases for your own problems.");
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  const { input, expectedOutput, isHidden } = req.body;

  if (input !== undefined) updateData.input = input.trim();
  if (expectedOutput !== undefined) updateData.expectedOutput = expectedOutput.trim();
  if (isHidden !== undefined) updateData.isHidden = isHidden;

  const testCase = await prisma.testCase.update({
    where: { id },
    data: updateData as any,
  });

  res.status(200).json(
    new ApiResponse(200, testCase, "Test case updated successfully.")
  );
};

// ─── DELETE /api/testcases/:id ───────────────────────────────────────
// Delete a test case. PROFESSOR only, must own the parent problem.

export const deleteTestCase = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  const existing = await prisma.testCase.findUnique({
    where: { id },
    include: { problem: { select: { creatorId: true } } },
  });

  if (!existing) {
    throw new ApiError(404, "Test case not found.");
  }

  if ((existing as any).problem.creatorId !== userId) {
    throw new ApiError(403, "You can only delete test cases from your own problems.");
  }

  await prisma.testCase.delete({ where: { id } });

  res.status(200).json(
    new ApiResponse(200, null, "Test case deleted successfully.")
  );
};
