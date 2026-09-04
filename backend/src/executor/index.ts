// ─── Executor Entry Point ─────────────────────────────────────────────
//
// All code execution is routed through the ProcessExecutor.
// Code is compiled and run DIRECTLY inside this container using
// g++ (C++) and python3 (Python). No Docker daemon is required.

import type { ExecutionRequest, ExecutionResult } from "./types";
import { executeCode as processExecute } from "./processExecutor";

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  console.log(`[Executor] Routing to ProcessExecutor (lang=${request.language ?? "CPP"})`);
  return processExecute(request);
}

export * from "./types";
