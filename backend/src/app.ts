// ─── Express Application Setup ───────────────────────────────────────
//
// This file creates and configures the Express app but does NOT start
// the server. The server is started in server.ts. This separation
// makes testing easier (you can import `app` without starting a listener).
//
// Middleware pipeline:
//   1. CORS (allow cross-origin requests from frontend)
//   2. JSON body parser (parse request bodies)
//   3. Route modules (auth, problems, testcases, submissions)
//   4. 404 handler (unmatched routes)
//   5. Global error handler (catches all thrown errors)

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { ApiError } from "./utils/ApiError";
import { ApiResponse } from "./utils/ApiResponse";

// ─── Import Route Modules ────────────────────────────────────────────
import authRoutes from "./routes/auth.routes";
import problemRoutes from "./routes/problem.routes";
import testcaseRoutes from "./routes/testcase.routes";
import submissionRoutes from "./routes/submission.routes";
import compilerRoutes from "./routes/compiler.routes";
import analyticsRoutes from "./routes/analytics.routes";

// ─── Create Express App ─────────────────────────────────────────────
const app = express();

// ─── Global Middleware ───────────────────────────────────────────────
app.use(cors());                    // Allow all origins (tighten in production)
app.use(express.json({ limit: "10mb" }));  // Parse JSON bodies (10MB for code submissions)

// ─── Health Check ────────────────────────────────────────────────────
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json(
    new ApiResponse(200, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  );
});

// ─── Mount Routes ────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/problems", testcaseRoutes);     // /api/problems/:problemId/testcases
app.use("/api/testcases", testcaseRoutes);     // /api/testcases/:id (update/delete)
app.use("/api/submissions", submissionRoutes);
app.use("/api/compiler", compilerRoutes);     // /api/compiler/run (ad-hoc execution)
app.use("/api/analytics", analyticsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, "Route not found."));
});

// ─── Global Error Handler ────────────────────────────────────────────
// Express 5 automatically catches errors thrown in async handlers and
// forwards them here. This is the LAST middleware in the pipeline.
//
// It handles:
//   - ApiError instances (our custom errors with status codes)
//   - Unknown errors (treated as 500 Internal Server Error)

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Default to 500 if not an ApiError
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err instanceof ApiError ? err.message : "Internal Server Error";

  // Log the full error in development
  if (process.env.NODE_ENV !== "production") {
    console.error("─── Error ────────────────────────────────────────");
    console.error(`  Status: ${statusCode}`);
    console.error(`  Message: ${err.message}`);
    if (!(err instanceof ApiError)) {
      console.error(`  Stack: ${err.stack}`);
    }
    console.error("──────────────────────────────────────────────────");
  }

  res.status(statusCode).json(new ApiResponse(statusCode, undefined, process.env.NODE_ENV !== "production" ? `${message} | Stack: ${err.stack}` : message));
});

export default app;
