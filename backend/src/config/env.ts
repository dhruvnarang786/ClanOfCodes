import dotenv from "dotenv";
dotenv.config();

// ─── Required Environment Variables ──────────────────────────────────
// Validates that all required env vars exist at startup.
// If any are missing, the server fails fast with a clear error message.

const requiredVars = ["DATABASE_URL", "JWT_SECRET", "REDIS_URL"] as const;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}

// ─── Exported Config Object ──────────────────────────────────────────
// Single source of truth for all configuration values.
// Other files import from here instead of reading process.env directly.

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: "7d",
  bcryptSaltRounds: 12,
  judge0ApiUrl: process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com",
  judge0ApiKey: process.env.JUDGE0_API_KEY || "",
  executorType: (process.env.JUDGE0_API_KEY ? "judge0" : "docker") as "judge0" | "docker",
};
