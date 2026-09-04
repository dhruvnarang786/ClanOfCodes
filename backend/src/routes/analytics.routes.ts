import { Router } from "express";
import { getProfessorDashboardAnalytics, getProblemAnalytics } from "../controllers/analytics.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// ─── Route Definitions ──────────────────────────────────────────────

// Protected routes (PROFESSOR only)
router.get("/dashboard", authenticate, authorize("PROFESSOR"), getProfessorDashboardAnalytics);
router.get("/problems/:id", authenticate, authorize("PROFESSOR"), getProblemAnalytics);

export default router;
