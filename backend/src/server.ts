// ─── Server Entry Point ──────────────────────────────────────────────
//
// This is the file you run: `npx tsx src/server.ts`
//
// It imports the configured Express app and starts listening.
// Environment variables are loaded via config/env.ts (which calls dotenv).

import { config } from "./config/env";
import app from "./app";
import { prisma } from "./lib/prisma";
import { closeQueue } from "./queue/submissionQueue";
import { gracefulWorkerShutdown } from "./worker/submissionWorker";

const server = app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 CompilerJudge API Server                        ║
║                                                       ║
║   Port:        ${String(config.port).padEnd(39)}║
║   Environment: ${(process.env.NODE_ENV || "development").padEnd(39)}║
║   Health:      http://localhost:${config.port}/api/health${" ".repeat(Math.max(0, 18 - String(config.port).length))}║
║   Redis:       ${config.redisUrl.padEnd(39)}║
║                                                       ║
║   API Routes:                                         ║
║   ├── POST   /api/auth/register                       ║
║   ├── POST   /api/auth/login                          ║
║   ├── GET    /api/auth/me                             ║
║   ├── GET    /api/problems                            ║
║   ├── GET    /api/problems/:slug                      ║
║   ├── POST   /api/problems                            ║
║   ├── PUT    /api/problems/:id                        ║
║   ├── DELETE /api/problems/:id                        ║
║   ├── POST   /api/problems/:pid/testcases             ║
║   ├── GET    /api/problems/:pid/testcases             ║
║   ├── PUT    /api/testcases/:id                       ║
║   ├── DELETE /api/testcases/:id                       ║
║   ├── POST   /api/submissions                         ║
║   ├── GET    /api/submissions                         ║
║   └── GET    /api/submissions/:id                     ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────
// Cleanly close all resources: HTTP server, BullMQ queue, Prisma/pg pool.
// This prevents connection leaks and ensures in-flight requests complete.

async function gracefulShutdown(signal: string) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

  // 1. Stop accepting new HTTP requests
  server.close(() => {
    console.log("[Server] HTTP server closed.");
  });

  // 2. Close the BullMQ queue (Redis producer connection)
  await closeQueue();
  console.log("[Server] BullMQ queue closed.");

  // 3. Stop the worker cleanly
  await gracefulWorkerShutdown();

  // 4. Close Prisma (database connection)
  await prisma.$disconnect();
  console.log("[Server] Prisma disconnected.");

  console.log("[Server] Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
