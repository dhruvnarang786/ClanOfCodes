// ─── TestCase Routes ─────────────────────────────────────────────────
//
// POST   /api/problems/:problemId/testcases  — Add test case (PROFESSOR, own problem)
// GET    /api/problems/:problemId/testcases  — List test cases (authenticated)
// PUT    /api/testcases/:id                  — Update test case (PROFESSOR, own problem)
// DELETE /api/testcases/:id                  — Delete test case (PROFESSOR, own problem)

import { Router } from "express";
import {
  createTestCase,
  listTestCases,
  updateTestCase,
  deleteTestCase,
} from "../controllers/testcase.controller";
import { authenticate, authorize } from "../middleware/auth";
import {
  validateBody,
  isNonEmpty,
  isOptionalString,
  isOptionalBoolean,
} from "../middleware/validate";

const router = Router();

// ─── Validation Rules ────────────────────────────────────────────────

const createTestCaseRules = [
  { field: "input", message: "Input is required.", check: isNonEmpty },
  { field: "expectedOutput", message: "Expected output is required.", check: isNonEmpty },
  { field: "isHidden", message: "isHidden must be a boolean.", check: isOptionalBoolean },
];

const updateTestCaseRules = [
  { field: "input", message: "Input must be a non-empty string.", check: isOptionalString },
  {
    field: "expectedOutput",
    message: "Expected output must be a non-empty string.",
    check: isOptionalString,
  },
  { field: "isHidden", message: "isHidden must be a boolean.", check: isOptionalBoolean },
];

// ─── Problem-scoped routes (mounted on /api/problems) ────────────────
// These are mounted via app.ts under the problem routes prefix.

router.post(
  "/:problemId/testcases",
  authenticate,
  authorize("PROFESSOR"),
  validateBody(createTestCaseRules),
  createTestCase
);

router.get("/:problemId/testcases", authenticate, listTestCases);

// ─── Standalone routes (mounted on /api/testcases) ───────────────────

router.put(
  "/:id",
  authenticate,
  authorize("PROFESSOR"),
  validateBody(updateTestCaseRules),
  updateTestCase
);

router.delete("/:id", authenticate, authorize("PROFESSOR"), deleteTestCase);

export default router;
