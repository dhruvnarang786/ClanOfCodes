// ─── Authentication & Authorization Middleware ───────────────────────
//
// Two middleware functions that work together:
//
// 1. authenticate  — Verifies the JWT token from the Authorization header.
//                    Attaches the decoded user payload to `req.user`.
//
// 2. authorize     — Checks if `req.user.role` is in the list of allowed roles.
//                    Must be used AFTER authenticate.
//
// Request flow:
//   Client → authenticate → authorize("PROFESSOR") → controller
//
// The JWT payload contains: { userId, role }

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../lib/prisma";

// ─── Extend Express Request type to include `user` ──────────────────
export interface AuthUser {
  userId: string;
  role: "STUDENT" | "PROFESSOR";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ─── JWT Token Payload Shape ─────────────────────────────────────────
interface JwtPayload {
  userId: string;
  role: string;
}

// ─── authenticate Middleware ─────────────────────────────────────────
// Extracts JWT from "Authorization: Bearer <token>", verifies it,
// and attaches the user to the request.

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required. Provide a Bearer token.");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Verify user still exists in database (handles deleted accounts)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new ApiError(401, "User no longer exists.");
    }

    req.user = { userId: user.id, role: user.role };
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid or expired token.");
  }
};

// ─── authorize Middleware ────────────────────────────────────────────
// Factory function that returns middleware checking if the user's role
// is in the allowed list.
//
// Usage: router.post("/", authenticate, authorize("PROFESSOR"), controller)

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required.");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required role: ${allowedRoles.join(" or ")}`
      );
    }

    next();
  };
};
