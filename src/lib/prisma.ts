// ─── Prisma Client Singleton (Prisma 7 + Driver Adapter) ─────────────
//
// Prisma 7 requires a "driver adapter" — you must provide your own
// database driver (pg) instead of Prisma's built-in engine.
//
// Flow: pg Pool → PrismaPg adapter → PrismaClient
//
// We use the singleton pattern to prevent creating multiple connections
// during development hot-reloads.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "../config/env";

// 1. Create a connection pool using the native 'pg' driver
const pool = new Pool({
  connectionString: config.databaseUrl,
});

// 2. Wrap it in Prisma's PostgreSQL adapter
const adapter = new PrismaPg(pool);

// 3. Create the PrismaClient with the adapter
export const prisma = new PrismaClient({ adapter });

// 4. Graceful shutdown: close the database connection when the process exits
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  await pool.end();
});
