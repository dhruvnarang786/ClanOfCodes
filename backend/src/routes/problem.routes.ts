// ─── Problem Routes ──────────────────────────────────────────────────
//
// GET    /api/problems        — List all problems (public)
// GET    /api/problems/:slug  — Get problem by slug (public)
// POST   /api/problems        — Create problem (PROFESSOR)
// PUT    /api/problems/:id    — Update problem (PROFESSOR, own)
// DELETE /api/problems/:id    — Delete problem (PROFESSOR, own)

import { Router } from "express";
import {
  listProblems,
  getProblemBySlug,
  createProblem,
  updateProblem,
  deleteProblem,
} from "../controllers/problem.controller";
import { authenticate, authorize } from "../middleware/auth";
import {
  validateBody,
  isNonEmpty,
  isOneOf,
  isOptionalString,
  isOptionalPositiveInt,
} from "../middleware/validate";

const router = Router();

// ─── Validation Rules ────────────────────────────────────────────────

const createProblemRules = [
  { field: "title", message: "Title is required.", check: isNonEmpty },
  { field: "description", message: "Description is required.", check: isNonEmpty },
  {
    field: "difficulty",
    message: "Difficulty must be EASY, MEDIUM, or HARD.",
    check: (v: unknown) => v === undefined || isOneOf(["EASY", "MEDIUM", "HARD"])(v),
  },
  {
    field: "timeLimitMs",
    message: "timeLimitMs must be a positive integer.",
    check: isOptionalPositiveInt,
  },
  {
    field: "memoryLimitMb",
    message: "memoryLimitMb must be a positive integer.",
    check: isOptionalPositiveInt,
  },
];

const updateProblemRules = [
  { field: "title", message: "Title must be a non-empty string.", check: isOptionalString },
  {
    field: "description",
    message: "Description must be a non-empty string.",
    check: isOptionalString,
  },
  {
    field: "difficulty",
    message: "Difficulty must be EASY, MEDIUM, or HARD.",
    check: (v: unknown) => v === undefined || isOneOf(["EASY", "MEDIUM", "HARD"])(v),
  },
  {
    field: "timeLimitMs",
    message: "timeLimitMs must be a positive integer.",
    check: isOptionalPositiveInt,
  },
  {
    field: "memoryLimitMb",
    message: "memoryLimitMb must be a positive integer.",
    check: isOptionalPositiveInt,
  },
];

// ─── Route Definitions ──────────────────────────────────────────────

// Public routes
router.get("/", listProblems);
router.get("/:slug", getProblemBySlug);

// Protected routes (PROFESSOR only)
router.post(
  "/",
  authenticate,
  authorize("PROFESSOR"),
  validateBody(createProblemRules),
  createProblem
);
router.put(
  "/:id",
  authenticate,
  authorize("PROFESSOR"),
  validateBody(updateProblemRules),
  updateProblem
);
router.delete("/:id", authenticate, authorize("PROFESSOR"), deleteProblem);

export default router;
