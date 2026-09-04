// ─── Authentication Controller ───────────────────────────────────────
//
// Handles user registration, login, and profile retrieval.
//
// Request flow for Register:
//   POST /api/auth/register
//   → validateBody (checks email, password, name, role)
//   → register handler
//   → hash password with bcrypt
//   → create User in database
//   → generate JWT
//   → return { user, token }
//
// Request flow for Login:
//   POST /api/auth/login
//   → validateBody (checks email, password)
//   → login handler
//   → find user by email
//   → compare password with bcrypt
//   → generate JWT
//   → return { user, token }

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { config } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

// ─── Helper: Generate JWT ────────────────────────────────────────────
const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
};

// ─── Helper: Strip sensitive fields from user object ─────────────────
const sanitizeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt,
});

// ─── POST /api/auth/register ─────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role } = req.body;

  // Check if email is already registered
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  // Hash the password (bcrypt adds a random salt automatically)
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  // Create the user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      role: role || "STUDENT", // Default to STUDENT if not specified
    },
  });

  // Generate JWT for immediate login after registration
  const token = generateToken(user.id, user.role);

  res.status(201).json(
    new ApiResponse(201, { user: sanitizeUser(user), token }, "Registration successful.")
  );
};

// ─── POST /api/auth/login ────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  // Compare submitted password with stored hash
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const token = generateToken(user.id, user.role);

  res.status(200).json(
    new ApiResponse(200, { user: sanitizeUser(user), token }, "Login successful.")
  );
};

// ─── GET /api/auth/me ────────────────────────────────────────────────
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          submissions: true,
          createdProblems: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  res.status(200).json(new ApiResponse(200, user));
};
