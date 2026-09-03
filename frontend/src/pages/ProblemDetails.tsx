import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import { CodeEditor, RunOutputPanel, getVerdictConfig } from "../components/CodeEditor";
import type { RunResult } from "../components/CodeEditor";
import {
  Play,
  Send,
  Terminal,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Keyboard,
  Activity,
  Code2
} from "lucide-react";

import { CodeDiffViewer } from "../components/CodeDiffViewer";

// ─── Types ────────────────────────────────────────────────────────────

interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  slug: string;
}

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Submission {
  id: string;
  status: "PENDING" | "JUDGING" | "COMPLETED" | "FAILED";
  verdict: string | null;
  executionTimeMs: number | null;
  compileError: string | null;
  createdAt: string;
  code?: string; // added to store fetched code for comparison
}

// ─── Default Code Template ────────────────────────────────────────────

const DEFAULT_CODE = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    
    return 0;
}`;

function DiffBadge({ diff }: { diff: string }) {
  if (diff === "EASY") return <span className="px-2.5 py-1 bg-brand-accent/10 text-brand-accent text-[10px] font-extrabold rounded-md border border-brand-accent/20 uppercase tracking-widest">Easy</span>;
  if (diff === "MEDIUM") return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-extrabold rounded-md border border-amber-500/20 uppercase tracking-widest">Medium</span>;
  if (diff === "HARD") return <span className="px-2.5 py-1 bg-red-500/10 text-red-600 text-[10px] font-extrabold rounded-md border border-red-500/20 uppercase tracking-widest">Hard</span>;
  return <span className="px-2.5 py-1 bg-brand-bg text-brand-muted text-[10px] font-extrabold rounded-md border border-brand-border uppercase tracking-widest">{diff}</span>;
}

// ─── Submission Verdict Display ───────────────────────────────────────

function SubmissionPanel({ submission }: { submission: Submission }) {
  const isPending = submission.status === "PENDING" || submission.status === "JUDGING";
  const vc = submission.verdict ? getVerdictConfig(submission.verdict) : null;

  return (
    <div className="p-5 space-y-4 font-mono text-sm text-brand-text h-full flex flex-col">
      {isPending ? (
        <div className="flex flex-col items-center justify-center gap-4 flex-1 text-brand-muted">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
          <span className="text-xs font-bold uppercase tracking-widest">
            {submission.status === "JUDGING" ? "Judging…" : "Queued for judging…"}
          </span>
          <p className="text-xs font-medium text-center max-w-xs">
            Worker is running your code against all test cases. This usually takes a few seconds.
          </p>
        </div>
      ) : vc ? (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 shadow-sm bg-brand-surface ${vc.color === 'text-green-400' ? 'border-brand-accent text-brand-accent' : vc.color === 'text-red-400' ? 'border-red-500 text-red-600' : 'border-amber-500 text-amber-600'}`}>
            <vc.Icon className="h-6 w-6" />
            <span className="font-extrabold uppercase tracking-widest text-sm">{vc.label}</span>
            {submission.executionTimeMs != null && (
              <span className="ml-auto text-xs font-bold flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {submission.executionTimeMs}ms
              </span>
            )}
          </div>
          {submission.compileError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl overflow-hidden flex-1">
              <div className="bg-red-100/50 px-4 py-3 border-b-2 border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-red-600 text-xs font-bold uppercase tracking-widest">
                  Compilation Error
                </p>
              </div>
              <pre className="text-black whitespace-pre-wrap text-[11px] leading-relaxed p-4 font-mono font-extrabold overflow-auto">
                {submission.compileError}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1">
          <p className="text-brand-muted font-bold">Submission completed.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export default function ProblemDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  // Problem data
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sampleTestCases, setSampleTestCases] = useState<TestCase[]>([]);
  const [problemError, setProblemError] = useState("");
  const [isLoadingProblem, setIsLoadingProblem] = useState(true);

  // Code editor state
  const [code, setCode] = useState(DEFAULT_CODE);

  // Run Code state
  const [stdin, setStdin] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitError, setSubmitError] = useState("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI tabs
  type LeftTab = "description" | "submissions";
  type BottomTab = "input" | "output" | "verdict";
  const [leftTab, setLeftTab] = useState<LeftTab>("description");
  const [bottomTab, setBottomTab] = useState<BottomTab>("input");
  
  // Problem submissions history
  const [problemSubmissions, setProblemSubmissions] = useState<Submission[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Comparison State
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [isFetchingCompare, setIsFetchingCompare] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [diffData, setDiffData] = useState<{ original: Submission; modified: Submission } | null>(null);

  const handleToggleCompare = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id];
    });
  };

  const handleCompareSubmissions = async () => {
    if (selectedCompareIds.length !== 2) return;
    setIsFetchingCompare(true);
    setCompareError("");
    setDiffData(null);
    try {
      const [res1, res2] = await Promise.all([
        api.get(`/submissions/${selectedCompareIds[0]}`),
        api.get(`/submissions/${selectedCompareIds[1]}`)
      ]);
      const sub1 = res1.data.data;
      const sub2 = res2.data.data;

      const [original, modified] = new Date(sub1.createdAt).getTime() < new Date(sub2.createdAt).getTime()
        ? [sub1, sub2]
        : [sub2, sub1];

      setDiffData({ original, modified });
      setIsComparing(true);
    } catch (err: any) {
      setCompareError(err.response?.data?.message || "Failed to load submissions for comparison.");
    } finally {
      setIsFetchingCompare(false);
    }
  };

  // ─── Load problem history ──────────────────────────────────────────
  const fetchProblemHistory = useCallback(async () => {
    if (!problem) return;
    setIsLoadingHistory(true);
    try {
      const { data } = await api.get(`/submissions?problemId=${problem.id}&limit=20`);
      setProblemSubmissions(data.data.submissions ?? []);
    } catch (err) {
      console.error("Failed to load submission history");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [problem]);

  useEffect(() => {
    if (leftTab === "submissions" && problem) {
      fetchProblemHistory();
      setSelectedCompareIds([]);
      setCompareError("");
    }
  }, [leftTab, problem, fetchProblemHistory]);

  // Refresh history automatically when a new submission finishes
  useEffect(() => {
    if (submission && (submission.status === "COMPLETED" || submission.status === "FAILED") && leftTab === "submissions") {
      fetchProblemHistory();
    }
  }, [submission?.status, leftTab, fetchProblemHistory]);

  // ─── Load problem + sample test cases ──────────────────────────────
  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setIsLoadingProblem(true);
      setProblemError("");
      try {
        const { data } = await api.get(`/problems/${slug}`);
        const p: Problem = data.data;
        setProblem(p);

        const tcRes = await api.get(`/problems/${p.id}/testcases`);
        const allTc: TestCase[] = tcRes.data.data.testCases ?? [];
        setSampleTestCases(allTc.filter((tc) => !tc.isHidden));
      } catch (err: any) {
        setProblemError(err.response?.data?.message || "Failed to load problem.");
      } finally {
        setIsLoadingProblem(false);
      }
    };
    load();
  }, [slug]);

  // ─── Poll submission until judged ────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (submissionId: string) => {
      stopPolling();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/submissions/${submissionId}`);
          const updated: Submission = data.data;
          setSubmission(updated);
          if (updated.status === "COMPLETED" || updated.status === "FAILED") {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, 1500);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ─── Run Code ─────────────────────────────────────────────────────
  const handleRun = async () => {
    if (isRunning || !problem) return;
    setIsRunning(true);
    setRunResult(null);
    setBottomTab("output");
    try {
      const { data } = await api.post("/compiler/run", {
        sourceCode: code,
        stdin,
        timeLimitMs: 10000,
      });
      setRunResult(data.data);
    } catch (err: any) {
      setRunResult({
        verdict: "SYSTEM_ERROR",
        stdout: "",
        stderr: err.response?.data?.message || "An error occurred while communicating with the server.",
        executionTimeMs: null,
        compileError: null,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // ─── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting || !problem) return;
    setIsSubmitting(true);
    setSubmitError("");
    setSubmission(null);
    setBottomTab("verdict");
    stopPolling();
    try {
      const { data } = await api.post("/submissions", {
        problemId: problem.id,
        code,
        language: "CPP",
      });
      const newSubmission: Submission = {
        id: data.data.id,
        status: data.data.status,
        verdict: null,
        executionTimeMs: null,
        compileError: null,
        createdAt: data.data.createdAt,
      };
      setSubmission(newSubmission);
      startPolling(newSubmission.id);
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────

  if (isLoadingProblem) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
          <span className="font-bold text-sm text-brand-muted uppercase tracking-widest">Loading IDE...</span>
        </div>
      </div>
    );
  }

  if (problemError || !problem) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col gap-3 bg-brand-bg">
        <p className="text-red-500 font-bold bg-red-50 px-4 py-2 rounded-lg border-2 border-red-200">{problemError || "Problem not found."}</p>
        <Link to="/problems" className="text-brand-primary text-sm font-bold hover:underline">
          ← Back to Problems
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-brand-bg font-sans selection:bg-brand-primary/20 overflow-hidden">
      
      {/* ═══════════════════════════════════════════════════════════
          LEFT PANEL — Problem Description (35% width on desktop)
          ═══════════════════════════════════════════════════════════ */}
      <div className="w-full md:w-[35%] lg:w-[35%] flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-brand-border bg-brand-surface overflow-hidden shrink-0 z-10 shadow-sm relative">
        
        {/* Left Tabs */}
        <div className="flex border-b-2 border-brand-border bg-brand-bg shrink-0 px-2 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setLeftTab("description")}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
              leftTab === "description"
                ? "bg-brand-surface text-brand-primary border-brand-border"
                : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setLeftTab("submissions")}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
              leftTab === "submissions"
                ? "bg-brand-surface text-brand-primary border-brand-border"
                : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
            }`}
          >
            Submissions
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {leftTab === "description" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="text-2xl font-extrabold text-brand-text leading-tight">{problem.title}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <DiffBadge diff={problem.difficulty} />
                  <span className="text-brand-muted font-bold text-[11px] uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {problem.timeLimitMs}ms
                  </span>
                  <span className="text-brand-muted font-bold text-[11px] uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {problem.memoryLimitMb}MB
                  </span>
                </div>
              </div>

              <div className="text-sm text-brand-text font-medium leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans">{problem.description}</pre>
              </div>

              {sampleTestCases.length > 0 && (
                <div className="space-y-4 pt-5 mt-5 border-t-2 border-brand-border/50">
                  <h2 className="text-sm font-extrabold text-brand-text flex items-center gap-2 uppercase tracking-widest">
                    <Eye className="h-4 w-4 text-brand-primary" />
                    Sample Examples
                  </h2>
                  <div className="space-y-4">
                    {sampleTestCases.map((tc, i) => (
                      <div key={tc.id} className="rounded-xl border-2 border-brand-border bg-brand-bg overflow-hidden shadow-sm">
                        <div className="bg-brand-surface px-4 py-2 border-b-2 border-brand-border flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-brand-primary/50"></div>
                          <span className="text-brand-muted font-bold uppercase tracking-widest text-[10px]">Example {i + 1}</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x-2 divide-brand-border/50">
                          <div className="sm:pr-4">
                            <p className="text-brand-text font-extrabold uppercase tracking-widest text-[10px] mb-2">Input</p>
                            <pre className="text-brand-text font-mono text-[11px] font-semibold whitespace-pre-wrap bg-brand-surface p-3 rounded-lg border-2 border-brand-border/50">{tc.input}</pre>
                          </div>
                          <div className="pt-4 sm:pt-0 sm:pl-4">
                            <p className="text-brand-text font-extrabold uppercase tracking-widest text-[10px] mb-2">Output</p>
                            <pre className="text-brand-text font-mono text-[11px] font-semibold whitespace-pre-wrap bg-brand-surface p-3 rounded-lg border-2 border-brand-border/50">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {leftTab === "submissions" && (
            <div className="space-y-4">
              {isLoadingHistory ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
                </div>
              ) : problemSubmissions.length > 0 ? (
                <div className="flex flex-col h-full bg-brand-surface border-2 border-brand-border rounded-xl overflow-hidden relative">
                  <div className="bg-brand-bg border-b-2 border-brand-border p-3 shrink-0 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
                      {selectedCompareIds.length === 1
                        ? "Select one more version to compare"
                        : selectedCompareIds.length === 2
                        ? "2 versions selected"
                        : "Select runs to compare"}
                    </span>
                    <Button
                      disabled={selectedCompareIds.length !== 2 || isFetchingCompare}
                      onClick={handleCompareSubmissions}
                      className="bg-brand-primary text-white hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-brand-primary h-8 px-4 text-[11px] font-extrabold uppercase tracking-widest"
                    >
                      {isFetchingCompare ? "Loading..." : "Compare Selected"}
                    </Button>
                  </div>
                  {compareError && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs font-bold border-b-2 border-red-200 uppercase tracking-widest">
                      {compareError}
                    </div>
                  )}
                  <div className="divide-y-2 divide-brand-border overflow-y-auto">
                    {problemSubmissions.map((sub) => {
                      const isPending = sub.status === "PENDING" || sub.status === "JUDGING";
                      const vc = sub.verdict ? getVerdictConfig(sub.verdict) : null;
                      const isSelected = selectedCompareIds.includes(sub.id);
                      return (
                        <div
                          key={sub.id}
                          className={`flex items-start gap-3 p-4 hover:bg-brand-bg transition-colors group relative ${isSelected ? 'bg-brand-primary/5 hover:bg-brand-primary/10' : ''}`}
                        >
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleCompare(sub.id, e as any)}
                              className="w-4 h-4 rounded border-2 border-brand-border text-brand-primary focus:ring-brand-primary bg-brand-surface cursor-pointer z-10 relative"
                            />
                          </div>
                          <Link
                            to={`/submissions/${sub.id}`}
                            target="_blank"
                            className="flex-1 min-w-0 flex flex-col cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-brand-muted group-hover:text-brand-text transition-colors">
                                {new Date(sub.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isPending ? (
                                <span className="px-2 py-1 bg-brand-muted/10 text-brand-muted text-[10px] font-extrabold uppercase tracking-widest rounded-md border border-brand-border">
                                  {sub.status}
                                </span>
                              ) : vc ? (
                                <span className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-md border flex items-center gap-1 ${vc.color === 'text-green-400' ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20' : vc.color === 'text-red-400' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                                  {vc.label}
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-brand-bg text-brand-muted text-[10px] font-extrabold uppercase tracking-widest rounded-md border border-brand-border">
                                  {sub.verdict ?? "—"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold text-brand-muted">
                              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {sub.executionTimeMs != null ? `${sub.executionTimeMs}ms` : "— ms"}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5"/> CPP</span>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <Activity className="w-10 h-10 text-brand-muted/30" />
                  <p className="text-sm font-bold text-brand-muted">No submissions yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT PANEL — Code Editor (Top) & Input/Output (Bottom)
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-brand-bg overflow-hidden h-full z-0">
        
        {/* Editor Half (60% height on desktop, flexible) */}
        <div className="flex-[5] flex flex-col border-b-2 border-brand-border min-h-[300px] bg-[#0d1117] relative">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-brand-surface border-b-2 border-brand-border shrink-0">
            <div className="relative">
              <select className="appearance-none bg-brand-bg border-2 border-brand-border text-brand-text text-xs font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-brand-primary transition-colors cursor-pointer">
                <option value="cpp">C++ 17</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted font-bold" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted ml-auto">
              {code.split("\n").length} lines
            </span>
          </div>

          {/* Editor Container */}
          <div className="flex-1 overflow-hidden relative">
            <CodeEditor value={code} onChange={setCode} />
          </div>
        </div>

        {/* Input/Output/Submit Half (40% height on desktop, flexible) */}
        <div className="flex-[3] flex flex-col bg-brand-surface min-h-[250px] shrink-0">
          
          {/* I/O Tabs */}
          <div className="flex items-center border-b-2 border-brand-border bg-brand-bg shrink-0 px-2 pt-2 gap-1 overflow-x-auto">
            <button
              onClick={() => setBottomTab("input")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
                bottomTab === "input"
                  ? "bg-brand-surface text-brand-text border-brand-border"
                  : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
              }`}
            >
              <Keyboard className="h-4 w-4 inline mr-2" />
              Custom Input
            </button>
            <button
              onClick={() => setBottomTab("output")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
                bottomTab === "output"
                  ? "bg-brand-surface text-brand-primary border-brand-border"
                  : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
              }`}
            >
              <Terminal className="h-4 w-4 inline mr-2" />
              Run Output
            </button>
            <button
              onClick={() => setBottomTab("verdict")}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
                bottomTab === "verdict"
                  ? "bg-brand-surface text-brand-accent border-brand-border"
                  : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 inline mr-2" />
              Verdict
            </button>
          </div>

          {/* I/O Content Area */}
          <div className="flex-1 overflow-auto bg-brand-bg relative">
            {bottomTab === "input" && (
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter custom stdin here..."
                className="absolute inset-0 w-full h-full bg-transparent text-brand-text font-mono text-[13px] font-semibold p-5 resize-none focus:outline-none placeholder:text-brand-muted/50"
                spellCheck={false}
              />
            )}

            {bottomTab === "output" && (
              <div className="h-full p-5">
                {runResult ? (
                  <RunOutputPanel result={runResult} isRunning={isRunning} />
                ) : isRunning ? (
                  <div className="flex h-full items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary" />
                    <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">Executing Code...</span>
                  </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-brand-muted">
                    <Terminal className="w-8 h-8 opacity-30 mb-3" />
                    <span className="text-xs font-bold uppercase tracking-widest">Run your code to see output here.</span>
                  </div>
                )}
              </div>
            )}

            {bottomTab === "verdict" && (
              <div className="h-full">
                {submitError ? (
                  <div className="m-5 text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {submitError}
                  </div>
                ) : submission ? (
                  <SubmissionPanel submission={submission} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-brand-muted py-8">
                    <Send className="h-8 w-8 opacity-30 mb-1" />
                    <p className="text-xs font-bold uppercase tracking-widest text-center">
                      Submit your solution to judge it.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-end gap-3 px-5 py-3 bg-brand-surface border-t-2 border-brand-border shrink-0 shadow-sm z-10">
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mr-auto hidden sm:block">
              Shortcuts active
            </span>
            <Button
              onClick={handleRun}
              disabled={isRunning || isSubmitting}
              className="gap-2 bg-brand-surface text-brand-text border-2 border-brand-border hover:bg-brand-bg hover:border-brand-primary/50 hover:text-brand-primary text-xs font-extrabold px-6 h-10 transition-all shadow-sm"
            >
              {!isRunning && <Play className="h-4 w-4" />}
              {isRunning ? "Running..." : "Run Code"}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isRunning || isSubmitting}
              className="gap-2 bg-brand-primary text-white hover:bg-blue-600 border-0 text-xs font-extrabold px-8 h-10 transition-all shadow-sm"
            >
              {!isSubmitting && <Send className="h-4 w-4" />}
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>

        </div>
      </div>
      
      {isComparing && diffData && (
        <CodeDiffViewer
          originalCode={diffData.original.code ?? "Code unavailable"}
          modifiedCode={diffData.modified.code ?? "Code unavailable"}
          originalTitle={`Submission #${diffData.original.id.substring(0, 8)} (${new Date(diffData.original.createdAt).toLocaleString()})`}
          modifiedTitle={`Submission #${diffData.modified.id.substring(0, 8)} (${new Date(diffData.modified.createdAt).toLocaleString()})`}
          title="Compare Submissions"
          onClose={() => setIsComparing(false)}
        />
      )}
    </div>
  );
}
