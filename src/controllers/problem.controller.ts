// ─── Problem Controller ──────────────────────────────────────────────
//
// CRUD operations for programming problems.
//
// Access control:
//   - GET (list, getBySlug): Public — anyone can browse problems
//   - POST (create):        PROFESSOR only
//   - PUT (update):         PROFESSOR only, must own the problem
//   - DELETE (delete):      PROFESSOR only, must own the problem
//
// Slug generation:
//   "Two Sum Problem" → "two-sum-problem"
//   If slug already exists, appends a random suffix: "two-sum-problem-a1b2"

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

// ─── Helper: Generate URL-safe slug from title ──────────────────────
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // Remove special characters
    .replace(/\s+/g, "-")           // Replace spaces with hyphens
    .replace(/-+/g, "-")            // Collapse multiple hyphens
    .replace(/^-|-$/g, "");         // Trim leading/trailing hyphens
};

// ─── GET /api/problems ───────────────────────────────────────────────
// List all problems with pagination.
// Query params: ?page=1&limit=20&difficulty=EASY&creatorId=<userId>

export const listProblems = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const difficulty = req.query.difficulty as string | undefined;
  const creatorId = req.query.creatorId as string | undefined;
  const skip = (page - 1) * limit;

  // Build dynamic filter
  const where: Record<string, unknown> = {};
  if (difficulty && ["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
    where.difficulty = difficulty;
  }
  // Allow filtering by creator (used by the Professor Dashboard)
  if (creatorId) {
    where.creatorId = creatorId;
  }

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        difficulty: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
        _count: { select: { testCases: true, submissions: true } },
      },
    }),
    prisma.problem.count({ where }),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      problems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
};

// ─── GET /api/problems/:slug ─────────────────────────────────────────
// Get a single problem by its URL slug.

export const getProblemBySlug = async (req: Request, res: Response): Promise<void> => {
  const slug = req.params.slug as string;

  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { testCases: true, submissions: true } },
    },
  });

  if (!problem) {
    throw new ApiError(404, "Problem not found.");
  }

  res.status(200).json(new ApiResponse(200, problem));
};

// ─── POST /api/problems ─────────────────────────────────────────────
// Create a new problem. PROFESSOR only.

export const createProblem = async (req: Request, res: Response): Promise<void> => {
  const { title, description, difficulty, timeLimitMs, memoryLimitMb } = req.body;
  const creatorId = req.user!.userId;

  // Generate slug from title
  let slug = generateSlug(title);

  // Check for duplicate slug and append random suffix if needed
  const existingSlug = await prisma.problem.findUnique({ where: { slug } });
  if (existingSlug) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${slug}-${suffix}`;
  }

  const problem = await prisma.problem.create({
    data: {
      title: title.trim(),
      slug,
      description: description.trim(),
      difficulty: difficulty || "EASY",
      timeLimitMs: timeLimitMs || 2000,
      memoryLimitMb: memoryLimitMb || 256,
      creatorId,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  res.status(201).json(
    new ApiResponse(201, problem, "Problem created successfully.")
  );
};

// ─── PUT /api/problems/:id ──────────────────────────────────────────
// Update a problem. PROFESSOR only, must own the problem.

export const updateProblem = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  // Find the problem and verify ownership
  const existing = await prisma.problem.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(404, "Problem not found.");
  }

  if (existing.creatorId !== userId) {
    throw new ApiError(403, "You can only update your own problems.");
  }

  // Build update data (only include fields that were provided)
  const updateData: Record<string, unknown> = {};
  const { title, description, difficulty, timeLimitMs, memoryLimitMb } = req.body;

  if (title !== undefined) {
    updateData.title = title.trim();
    // Regenerate slug if title changed
    updateData.slug = generateSlug(title);
    // Check slug uniqueness (excluding current problem)
    const slugConflict = await prisma.problem.findFirst({
      where: { slug: updateData.slug as string, id: { not: id } },
    });
    if (slugConflict) {
      const suffix = Math.random().toString(36).substring(2, 6);
      updateData.slug = `${updateData.slug}-${suffix}`;
    }
  }
  if (description !== undefined) updateData.description = description.trim();
  if (difficulty !== undefined) updateData.difficulty = difficulty;
  if (timeLimitMs !== undefined) updateData.timeLimitMs = timeLimitMs;
  if (memoryLimitMb !== undefined) updateData.memoryLimitMb = memoryLimitMb;

  const problem = await prisma.problem.update({
    where: { id },
    data: updateData,
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  res.status(200).json(
    new ApiResponse(200, problem, "Problem updated successfully.")
  );
};

// ─── DELETE /api/problems/:id ────────────────────────────────────────
// Delete a problem. PROFESSOR only, must own the problem.
// Cascades to test cases (defined in schema).

export const deleteProblem = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  const existing = await prisma.problem.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(404, "Problem not found.");
  }

  if (existing.creatorId !== userId) {
    throw new ApiError(403, "You can only delete your own problems.");
  }

  await prisma.problem.delete({ where: { id } });

  res.status(200).json(
    new ApiResponse(200, null, "Problem deleted successfully.")
  );
};
