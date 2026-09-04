import { config } from "../config/env";
import type { ExecutionRequest, ExecutionResult, ExecutionVerdict } from "./types";

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const { sourceCode, stdin, timeLimitMs, memoryLimitMb } = request;

  console.log(`[JDoodleExecutor] 🚀 Sending execution request`);

  const url = `https://api.jdoodle.com/v1/execute`;

  const payload = {
    clientId: config.jdoodleClientId,
    clientSecret: config.jdoodleClientSecret,
    script: sourceCode,
    language: "cpp",
    versionIndex: "5", // GCC 11.1.0 or similar
    stdin: stdin || "",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[JDoodleExecutor] ❌ API Error ${response.status}: ${errorText}`);
      return {
        verdict: "SYSTEM_ERROR",
        stdout: "",
        stderr: `JDoodle API returned ${response.status}`,
        executionTimeMs: null,
        compileError: null,
      };
    }

    const data: any = await response.json();
    
    // JDoodle combines stdout and stderr into data.output
    const output = data.output || "";
    let verdict: ExecutionVerdict = "ACCEPTED";
    let compileError = null;

    // Very basic parsing since JDoodle doesn't return strict status codes for the run
    if (output.includes("Time Limit Exceeded")) {
        verdict = "TIME_LIMIT_EXCEEDED";
    } else if (output.includes("error:") && output.includes("compilation terminated")) {
        verdict = "COMPILATION_ERROR";
        compileError = output;
    } else if (output.includes("Memory Limit Exceeded")) {
        verdict = "MEMORY_LIMIT_EXCEEDED";
    } else if (output.includes("Exception in thread") || output.includes("Segmentation fault")) {
        verdict = "RUNTIME_ERROR";
    } else if (data.statusCode !== 200) {
        // e.g. 429 Daily Limit Reached
        verdict = "SYSTEM_ERROR";
    }

    const executionTimeMs = data.cpuTime ? parseFloat(data.cpuTime) * 1000 : 0;

    console.log(`[JDoodleExecutor] ✅ Execution finished. Verdict: ${verdict}, Time: ${executionTimeMs}ms`);

    return {
      verdict,
      stdout: output,
      stderr: "", // JDoodle merges stderr into stdout
      executionTimeMs: verdict === "COMPILATION_ERROR" ? null : executionTimeMs,
      compileError: verdict === "COMPILATION_ERROR" ? compileError : null,
    };
  } catch (error: any) {
    console.error(`[JDoodleExecutor] 💀 System error:`, error);
    return {
      verdict: "SYSTEM_ERROR",
      stdout: "",
      stderr: error.message || String(error),
      executionTimeMs: null,
      compileError: null,
    };
  }
}
