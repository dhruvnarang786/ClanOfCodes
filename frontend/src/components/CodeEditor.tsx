import React from "react";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

export interface RunResult {
  verdict: string;
  stdout: string;
  stderr: string;
  executionTimeMs: number | null;
  compileError: string | null;
}

export interface VerdictConfig {
  label: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
}

export function getVerdictConfig(verdict: string): VerdictConfig {
  switch (verdict) {
    case "ACCEPTED":
      return {
        label: "Accepted",
        color: "text-green-400",
        bg: "bg-green-400/10 border-green-400/30",
        Icon: CheckCircle2,
      };
    case "COMPILATION_ERROR":
      return {
        label: "Compilation Error",
        color: "text-red-400",
        bg: "bg-red-400/10 border-red-400/30",
        Icon: XCircle,
      };
    case "RUNTIME_ERROR":
      return {
        label: "Runtime Error",
        color: "text-red-400",
        bg: "bg-red-400/10 border-red-400/30",
        Icon: XCircle,
      };
    case "TIME_LIMIT_EXCEEDED":
      return {
        label: "Time Limit Exceeded",
        color: "text-yellow-400",
        bg: "bg-yellow-400/10 border-yellow-400/30",
        Icon: Clock,
      };
    case "MEMORY_LIMIT_EXCEEDED":
      return {
        label: "Memory Limit Exceeded",
        color: "text-orange-400",
        bg: "bg-orange-400/10 border-orange-400/30",
        Icon: AlertCircle,
      };
    case "WRONG_ANSWER":
      return {
        label: "Wrong Answer",
        color: "text-red-400",
        bg: "bg-red-400/10 border-red-400/30",
        Icon: XCircle,
      };
    default:
      return {
        label: verdict.replace(/_/g, " "),
        color: "text-muted",
        bg: "bg-surface border-border",
        Icon: AlertCircle,
      };
  }
}

// ─── CodeEditor ───────────────────────────────────────────────────────
// Simple line-numbered textarea editor (no external dep).

import Editor from "@monaco-editor/react";

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#0d1117]">
      <Editor
        height="100%"
        language="cpp"
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange?.(val || "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          lineHeight: 24,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          formatOnPaste: true,
          matchBrackets: "always",
          autoClosingBrackets: "always",
          autoIndent: "full",
        }}
        loading={
          <div className="flex h-full w-full items-center justify-center text-[#4b5563] font-mono text-sm">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}

// ─── RunOutputPanel ───────────────────────────────────────────────────
// Renders the output of a compiler run (not a judged submission).

export function RunOutputPanel({
  result,
  isRunning,
}: {
  result: RunResult | null;
  isRunning: boolean;
}) {
  if (isRunning) {
    return (
      <div className="flex items-center gap-3 text-brand-muted p-4 font-mono text-sm font-bold">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-primary" />
        <span>Executing in sandbox…</span>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-brand-muted font-mono text-sm font-bold">
        <span className="text-2xl opacity-50">▶</span>
        <p>Run your code to see output here.</p>
      </div>
    );
  }

  return (
    <div className="p-4 font-mono text-sm space-y-4">
      {result.compileError && (
        <div>
          <p className="text-red-500 text-xs uppercase tracking-wider mb-1.5 font-bold">
            Compilation Error
          </p>
          <pre className="text-brand-text font-bold whitespace-pre-wrap text-[13px] leading-relaxed bg-brand-bg border-2 border-brand-border p-3 rounded-lg overflow-x-auto">
            {result.compileError}
          </pre>
        </div>
      )}
      {!result.compileError && (
        <>
          {result.stdout ? (
            <div>
              <p className="text-brand-muted text-xs uppercase tracking-wider mb-1.5 font-bold">
                Stdout
              </p>
              <pre className="text-brand-text font-bold whitespace-pre-wrap text-[13px] leading-relaxed bg-brand-bg border-2 border-brand-border p-3 rounded-lg overflow-x-auto">
                {result.stdout}
              </pre>
            </div>
          ) : (
            <p className="text-brand-muted font-bold">(no output)</p>
          )}
          {result.stderr &&
            (result.verdict === "RUNTIME_ERROR" ||
              result.verdict === "TIME_LIMIT_EXCEEDED") && (
              <div className="mt-4">
                <p className="text-red-500 text-xs uppercase tracking-wider mb-1.5 font-bold">
                  Stderr
                </p>
                <pre className="text-brand-text font-bold whitespace-pre-wrap text-[13px] leading-relaxed bg-brand-bg border-2 border-brand-border p-3 rounded-lg overflow-x-auto">
                  {result.stderr}
                </pre>
              </div>
            )}
        </>
      )}
    </div>
  );
}

