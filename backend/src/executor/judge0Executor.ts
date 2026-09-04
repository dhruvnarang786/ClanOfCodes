import { config } from "../config/env";
import type { ExecutionRequest, ExecutionResult, ExecutionVerdict } from "./types";

/**
 * Maps Judge0 status IDs to our ExecutionVerdict.
 * 
 * Judge0 Status IDs:
 * 1: In Queue
 * 2: Processing
 * 3: Accepted
 * 4: Wrong Answer (we handle WA ourselves, so Judge0 won't return this if we just run code)
 * 5: Time Limit Exceeded
 * 6: Compilation Error
 * 7: Runtime Error (SIGSEGV)
 * 8: Runtime Error (SIGXFSZ)
 * 9: Runtime Error (SIGFPE)
 * 10: Runtime Error (SIGABRT)
 * 11: Runtime Error (NZEC)
 * 12: Runtime Error (Other)
 * 13: Internal Error
 * 14: Exec Format Error
 */
function mapStatusToVerdict(statusId: number): ExecutionVerdict {
  if (statusId === 3) return "ACCEPTED";
  if (statusId === 5) return "TIME_LIMIT_EXCEEDED";
  if (statusId === 6) return "COMPILATION_ERROR";
  if (statusId >= 7 && statusId <= 12) return "RUNTIME_ERROR";
  return "SYSTEM_ERROR";
}

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const { sourceCode, stdin, timeLimitMs, memoryLimitMb } = request;

  console.log(`[Judge0Executor] 🚀 Sending execution request (timeLimit=${timeLimitMs}ms)`);

  const url = `${config.judge0ApiUrl}/submissions?base64_encoded=false&wait=true`;
  const timeLimitS = Math.max(1, Math.ceil(timeLimitMs / 1000));
  const memoryLimitKb = memoryLimitMb * 1024;

  const payload = {
    source_code: sourceCode,
    language_id: 54, // C++ (GCC 9.2.0)
    stdin: stdin || "",
    cpu_time_limit: timeLimitS,
    memory_limit: memoryLimitKb,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": config.judge0ApiKey,
        "X-RapidAPI-Host": new URL(config.judge0ApiUrl).host,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Judge0Executor] ❌ API Error ${response.status}: ${errorText}`);
      return {
        verdict: "SYSTEM_ERROR",
        stdout: "",
        stderr: `Judge0 API returned ${response.status}`,
        executionTimeMs: null,
        compileError: null,
      };
    }

    const data: any = await response.json();
    const statusId = data.status?.id || 13;
    const verdict = mapStatusToVerdict(statusId);

    const stdout = data.stdout || "";
    const stderr = data.stderr || "";
    const compileError = data.compile_output || null;
    const executionTimeMs = data.time ? parseFloat(data.time) * 1000 : 0;

    console.log(`[Judge0Executor] ✅ Execution finished. Verdict: ${verdict}, Time: ${executionTimeMs}ms`);

    return {
      verdict,
      stdout,
      stderr,
      executionTimeMs: verdict === "COMPILATION_ERROR" ? null : executionTimeMs,
      compileError: verdict === "COMPILATION_ERROR" ? compileError : null,
    };
  } catch (error: any) {
    console.error(`[Judge0Executor] 💀 System error:`, error);
    return {
      verdict: "SYSTEM_ERROR",
      stdout: "",
      stderr: error.message || String(error),
      executionTimeMs: null,
      compileError: null,
    };
  }
}
