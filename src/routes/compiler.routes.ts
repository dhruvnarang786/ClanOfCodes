// ─── Compiler Routes ─────────────────────────────────────────────────
//
// POST /api/compiler/run — Execute code ad-hoc (authenticated, no DB write)

import { Router } from "express";
import { runCode, getCompilerHistory, deleteCompilerHistoryEntry } from "../controllers/compiler.controller";
import { authenticate } from "../middleware/auth";
import { validateBody, isNonEmpty, isOptionalPositiveInt } from "../middleware/validate";

const router = Router();

// ─── Validation Rules ────────────────────────────────────────────────

const runCodeRules = [
  { field: "sourceCode", message: "sourceCode is required.", check: isNonEmpty },
  // stdin is optional — empty string is valid
  // timeLimitMs is optional positive int
  {
    field: "timeLimitMs",
    message: "timeLimitMs must be a positive integer if provided.",
    check: isOptionalPositiveInt,
  },
];

// ─── Route Definitions ──────────────────────────────────────────────

router.post("/run", authenticate, validateBody(runCodeRules), runCode);
router.get("/history", authenticate, getCompilerHistory);
router.delete("/history/:id", authenticate, deleteCompilerHistoryEntry);

export default router;
