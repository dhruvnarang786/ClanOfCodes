// ─── Submission Routes ───────────────────────────────────────────────
//
// POST /api/submissions      — Submit code (authenticated)
// GET  /api/submissions      — List submissions (authenticated)
// GET  /api/submissions/:id  — Get submission detail (authenticated)

import { Router } from "express";
import {
  createSubmission,
  listSubmissions,
  getSubmission,
} from "../controllers/submission.controller";
import { authenticate } from "../middleware/auth";
import { validateBody, isNonEmpty, isOneOf } from "../middleware/validate";

const router = Router();

// ─── Validation Rules ────────────────────────────────────────────────

const createSubmissionRules = [
  { field: "problemId", message: "problemId is required.", check: isNonEmpty },
  { field: "code", message: "Code is required.", check: isNonEmpty },
  {
    field: "language",
    message: "Language must be CPP.",
    check: (v: unknown) => v === undefined || isOneOf(["CPP"])(v),
  },
];

// ─── Route Definitions ──────────────────────────────────────────────

router.post("/", authenticate, validateBody(createSubmissionRules), createSubmission);
router.get("/", authenticate, listSubmissions);
router.get("/:id", authenticate, getSubmission);

export default router;
