// ─── Redis Connection for BullMQ ─────────────────────────────────────
//
// Why a separate connection module?
// BullMQ uses ioredis internally. Both the Queue (producer/API side)
// and the Worker (consumer side) need Redis connections, but they run
// in SEPARATE processes. This module provides a shared connection config
// that both can import.
//
// Architecture:
//   API Server process  →  Queue (producer)  →  Redis
//   Worker process      →  Worker (consumer) ←  Redis
//
// BullMQ does NOT accept a redis:// URL string directly.
// It needs an ioredis-compatible connection options object.
// We parse the REDIS_URL to extract host/port/password.

// import { config } from "../config/env";

/**
 * Parse a redis:// URL into ioredis-compatible connection options.
 *
 * Examples:
 *   "redis://localhost:6379"           → { host: "localhost", port: 6379 }
 *   "redis://:password@host:6379"      → { host: "host", port: 6379, password: "password" }
 *   "redis://user:pass@host:6379/0"    → { host: "host", port: 6379, password: "pass", db: 0 }
 */
// function parseRedisUrl(url: string) {
//   const parsed = new URL(url);
//   return {
//     host: parsed.hostname || "localhost",
//     port: parseInt(parsed.port || "6379", 10),
//     password: parsed.password || undefined,
//     db: parsed.pathname ? parseInt(parsed.pathname.slice(1) || "0", 10) : 0,
//     maxRetriesPerRequest: null as null, // Required by BullMQ — prevents ioredis from throwing on retries
//   };
// }

/**
 * Shared Redis connection options.
 * Used by both the Queue (API side) and the Worker (consumer side).
 */
// export const redisConnection = parseRedisUrl(config.redisUrl);



// ─── Redis Connection for BullMQ ─────────────────────────────────────

import { config } from "../config/env";

/**
 * Parse Redis URL into BullMQ/ioredis-compatible connection options.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);

  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname
      ? parseInt(parsed.pathname.slice(1) || "0", 10)
      : 0,

    // Upstash uses rediss://, which requires TLS.
    ...(parsed.protocol === "rediss:" && {
      tls: {},
    }),

    // Required by BullMQ.
    maxRetriesPerRequest: null as null,
  };
}

export const redisConnection = parseRedisUrl(config.redisUrl);