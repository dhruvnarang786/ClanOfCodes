// ─── Docker Executor Types ───────────────────────────────────────────
//
// These types define the input and output contract for the DockerExecutor.
// They are intentionally decoupled from the Prisma schema so the executor
// can be tested standalone without a database connection.

// ─── Execution Verdicts ──────────────────────────────────────────────
// These map 1:1 to the Prisma Verdict enum but are defined separately
// so the executor module has zero database dependencies.

export type ExecutionVerdict =
  | "ACCEPTED"              // Compiled and ran successfully (output correctness checked elsewhere)
  | "COMPILATION_ERROR"     // g++ returned a non-zero exit code
  | "RUNTIME_ERROR"         // Program crashed (segfault, exception, non-zero exit code)
  | "TIME_LIMIT_EXCEEDED"   // Execution exceeded the allowed time
  | "MEMORY_LIMIT_EXCEEDED" // Execution exceeded the allowed memory (OOM killed)
  | "SYSTEM_ERROR";         // Docker/infrastructure failure (not the student's fault)

// ─── Execution Request ───────────────────────────────────────────────
// Everything the executor needs to compile and run a single submission.

export interface ExecutionRequest {
  /** The C++ source code to compile and run */
  sourceCode: string;

  /** The stdin input to feed to the running program */
  stdin: string;

  /** Maximum execution time in milliseconds (compilation time excluded) */
  timeLimitMs: number;

  /** Maximum memory in megabytes */
  memoryLimitMb: number;
}

// ─── Execution Result ────────────────────────────────────────────────
// The structured outcome of compiling and running a submission.

export interface ExecutionResult {
  /** The verdict for this execution */
  verdict: ExecutionVerdict;

  /** The program's stdout output (empty string if compilation failed) */
  stdout: string;

  /** The program's stderr output (may contain runtime errors) */
  stderr: string;

  /** Execution time in milliseconds (null if compilation failed) */
  executionTimeMs: number | null;

  /** Compilation error message (null if compilation succeeded) */
  compileError: string | null;
}
