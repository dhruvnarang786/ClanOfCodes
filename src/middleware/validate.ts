// ─── Lightweight Input Validation Middleware ─────────────────────────
//
// Why not use a library like Zod or Joi?
// The user asked us to avoid unnecessary dependencies. This module
// provides reusable validation helpers that cover our API needs.
//
// Usage:
//   router.post("/register", validateBody(registerRules), controller)
//
// Each rule is: { field, message, check: (value) => boolean }
// If check returns false, a 400 error is thrown with the message.

import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

// ─── Validation Rule Type ────────────────────────────────────────────
export interface ValidationRule {
  field: string;
  message: string;
  check: (value: unknown) => boolean;
}

// ─── validateBody Middleware Factory ─────────────────────────────────
// Takes an array of rules, returns middleware that validates req.body.

export const validateBody = (rules: ValidationRule[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const rule of rules) {
      const value = req.body[rule.field];
      if (!rule.check(value)) {
        throw new ApiError(400, rule.message);
      }
    }
    next();
  };
};

// ─── Reusable Check Helpers ──────────────────────────────────────────

/** Value must be a non-empty string */
export const isNonEmpty = (v: unknown): boolean =>
  typeof v === "string" && v.trim().length > 0;

/** Value must be a string with at least `min` characters */
export const isMinLength = (min: number) => (v: unknown): boolean =>
  typeof v === "string" && v.trim().length >= min;

/** Value must match a basic email pattern */
export const isEmail = (v: unknown): boolean =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Value must be one of the allowed values */
export const isOneOf = (allowed: string[]) => (v: unknown): boolean =>
  typeof v === "string" && allowed.includes(v);

/** Value is optional — if present, must be a non-empty string */
export const isOptionalString = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim().length > 0);

/** Value must be a positive integer */
export const isPositiveInt = (v: unknown): boolean =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

/** Value is optional — if present, must be a positive integer */
export const isOptionalPositiveInt = (v: unknown): boolean =>
  v === undefined || v === null || isPositiveInt(v);

/** Value must be a boolean */
export const isBoolean = (v: unknown): boolean => typeof v === "boolean";

/** Value is optional — if present, must be a boolean */
export const isOptionalBoolean = (v: unknown): boolean =>
  v === undefined || v === null || typeof v === "boolean";
