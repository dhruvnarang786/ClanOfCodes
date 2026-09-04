// ─── Auth Routes ─────────────────────────────────────────────────────
//
// POST /api/auth/register  — Create a new account
// POST /api/auth/login     — Login and get JWT
// GET  /api/auth/me        — Get current user profile (protected)

import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import {
  validateBody,
  isEmail,
  isMinLength,
  isNonEmpty,
  isOneOf,
} from "../middleware/validate";

const router = Router();

// ─── Validation Rules ────────────────────────────────────────────────

const registerRules = [
  { field: "email", message: "Valid email is required.", check: isEmail },
  {
    field: "password",
    message: "Password must be at least 6 characters.",
    check: isMinLength(6),
  },
  { field: "name", message: "Name is required.", check: isNonEmpty },
  {
    field: "role",
    message: "Role must be STUDENT or PROFESSOR.",
    check: (v: unknown) => v === undefined || isOneOf(["STUDENT", "PROFESSOR"])(v),
  },
];

const loginRules = [
  { field: "email", message: "Email is required.", check: isEmail },
  { field: "password", message: "Password is required.", check: isNonEmpty },
];

// ─── Route Definitions ──────────────────────────────────────────────

router.post("/register", validateBody(registerRules), register);
router.post("/login", validateBody(loginRules), login);
router.get("/me", authenticate, getMe);

export default router;
