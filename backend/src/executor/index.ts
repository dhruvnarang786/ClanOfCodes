import { config } from "../config/env";
import type { ExecutionRequest, ExecutionResult } from "./types";
import { executeCode as dockerExecute } from "./dockerExecutor";
import { executeCode as judge0Execute } from "./judge0Executor";

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  if (config.executorType === "judge0") {
    console.log("[Executor] Routing request to Judge0 API");
    return judge0Execute(request);
  } else {
    console.log("[Executor] Routing request to local Docker sandbox");
    return dockerExecute(request);
  }
}

export * from "./types";
