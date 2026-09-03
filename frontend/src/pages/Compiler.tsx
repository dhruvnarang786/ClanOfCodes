import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import { Play, ChevronDown, Terminal, Clock, Keyboard, History, Trash2, ArrowLeft, CheckCircle2, XCircle, AlertCircle, Code2, Activity } from "lucide-react";
import {
  CodeEditor,
  RunOutputPanel,
  getVerdictConfig,
} from "../components/CodeEditor";
import type { RunResult } from "../components/CodeEditor";
import { CodeDiffViewer } from "../components/CodeDiffViewer";

// ─── Types ─────────────────────────────────────────────────────────────

interface CompilerHistoryEntry {
  id: string;
  code: string;
  language: string;
  stdin: string;
  stdout: string;
  stderr: string;
  compileError: string | null;
  verdict: string;
  executionTimeMs: number | null;
  createdAt: string;
}

// ─── Default C++17 Template ────────────────────────────────────────────

const DEFAULT_CODE = `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    cout << "Hello, World!" << endl;
    
    return 0;
}`;

// ─── Main Component ────────────────────────────────────────────────────

export default function Compiler() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [stdin, setStdin] = useState("");
  const [timeLimitMs, setTimeLimitMs] = useState(10000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<"input" | "output" | "history">("input");
  
  const [history, setHistory] = useState<CompilerHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<CompilerHistoryEntry | null>(null);

  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const fetchHistory = async () => {

    try {
      setIsLoadingHistory(true);
      const { data } = await api.get("/compiler/history");
      setHistory(data.data);
    } catch (err: any) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeOutputTab === "history") {
      fetchHistory();
      setSelectedHistory(null);
      setSelectedCompareIds([]);
      setIsComparing(false);
    }
  }, [activeOutputTab]);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    setActiveOutputTab("output");
    try {
      const { data } = await api.post("/compiler/run", {
        sourceCode: code,
        stdin,
        timeLimitMs,
      });
      setResult(data.data);
    } catch (err: any) {
      setResult({
        verdict: "SYSTEM_ERROR",
        stdout: "",
        stderr: err.response?.data?.message || "Unknown error communicating with the server.",
        executionTimeMs: null,
        compileError: null,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id]; // keep the last 2 selections
    });
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/compiler/history/${id}`);
      setHistory((prev) => prev.filter(h => h.id !== id));
      if (selectedHistory?.id === id) {
        setSelectedHistory(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadIntoEditor = () => {
    if (selectedHistory) {
      setCode(selectedHistory.code);
      setStdin(selectedHistory.stdin);
      setActiveOutputTab("input");
    }
  };

  const vc = result ? getVerdictConfig(result.verdict) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-brand-bg font-sans selection:bg-brand-primary/20">
      
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-brand-text tracking-tight flex items-center gap-2">
            Online Compiler
          </h1>
          <p className="text-brand-muted font-bold text-[11px] uppercase tracking-widest mt-0.5">
            Write, run, and experiment with code.
          </p>
        </div>
        
        {/* Run / Verdict Bar placed here for visibility when panel is small */}
        {result && vc && (
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-brand-surface border-2 border-brand-border rounded-lg shadow-sm">
            <span className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest ${vc.color === 'text-green-400' ? 'text-brand-accent' : vc.color === 'text-red-400' ? 'text-red-600' : 'text-amber-600'}`}>
              <vc.Icon className="h-4 w-4" />
              {vc.label}
            </span>
            {result.executionTimeMs !== null && (
              <>
                <span className="text-brand-border font-bold">|</span>
                <span className="text-[11px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {result.executionTimeMs}ms
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Main Unified Workspace ────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col mx-6 mb-6 border-2 border-brand-border rounded-xl shadow-sm bg-brand-surface">
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* ── LEFT: Code Editor ─────────────────────────────── */}
          <div className="flex flex-col w-full md:w-[60%] lg:w-[65%] border-b-2 md:border-b-0 md:border-r-2 border-brand-border bg-[#0d1117] relative shrink-0 overflow-hidden z-10">
            <div className="flex items-center gap-3 px-5 py-3 bg-brand-surface border-b-2 border-brand-border shrink-0">
              <span className="text-[11px] font-extrabold text-brand-muted uppercase tracking-widest mr-auto">
                Source Code
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted ml-auto">
                {code.split("\n").length} lines
              </span>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <CodeEditor value={code} onChange={setCode} />
            </div>
          </div>

          {/* ── RIGHT: Input / Output / History ─────────────────────────── */}
          <div className="flex flex-col w-full md:w-[40%] lg:w-[35%] overflow-hidden bg-brand-surface z-0 relative">
            
            {/* I/O Tabs */}
            <div className="flex items-center border-b-2 border-brand-border bg-brand-bg shrink-0 px-2 pt-2 gap-1 overflow-x-auto shadow-sm z-10">
              <button
                onClick={() => setActiveOutputTab("input")}
                className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
                  activeOutputTab === "input"
                    ? "bg-brand-surface text-brand-text border-brand-border"
                    : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
                }`}
              >
                <Keyboard className="h-4 w-4 inline mr-2" />
                Custom Input
              </button>
              <button
                onClick={() => setActiveOutputTab("output")}
                className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
                  activeOutputTab === "output"
                    ? "bg-brand-surface text-brand-primary border-brand-border"
                    : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
                }`}
              >
                <Terminal className="h-4 w-4 inline mr-2" />
                Run Output
              </button>
              <button
                onClick={() => setActiveOutputTab("history")}
                className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap ${
                  activeOutputTab === "history"
                    ? "bg-brand-surface text-brand-text border-brand-border"
                    : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
                }`}
              >
                <History className="h-4 w-4 inline mr-2" />
                History
              </button>
            </div>

            {/* Mobile Verdict Bar */}
            {result && vc && activeOutputTab !== "history" && (
              <div className="sm:hidden flex items-center justify-between px-4 py-3 bg-brand-bg border-b-2 border-brand-border shrink-0">
                <span className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest ${vc.color === 'text-green-400' ? 'text-brand-accent' : vc.color === 'text-red-400' ? 'text-red-600' : 'text-amber-600'}`}>
                  <vc.Icon className="h-4 w-4" />
                  {vc.label}
                </span>
                {result.executionTimeMs !== null && (
                  <span className="text-[11px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {result.executionTimeMs}ms
                  </span>
                )}
              </div>
            )}

            {/* Panel content */}
            <div className="flex-1 overflow-auto bg-brand-bg relative">
              {activeOutputTab === "input" ? (
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter custom stdin here..."
                  className="absolute inset-0 w-full h-full bg-transparent text-brand-text font-mono text-[13px] font-semibold p-5 resize-none focus:outline-none placeholder:text-brand-muted/50"
                  spellCheck={false}
                />
              ) : activeOutputTab === "output" ? (
                <div className="h-full p-5">
                  {result ? (
                    <RunOutputPanel result={result} isRunning={isRunning} />
                  ) : isRunning ? (
                    <div className="flex h-full items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary" />
                      <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">Executing Code...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full items-center justify-center text-brand-muted">
                      <Terminal className="w-8 h-8 opacity-30 mb-3" />
                      <span className="text-xs font-bold uppercase tracking-widest">Run your code to see the output here.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full">
                  {selectedHistory ? (
                    <div className="flex flex-col h-full bg-brand-bg">
                      <div className="flex items-center justify-between p-4 border-b-2 border-brand-border bg-brand-surface shrink-0">
                        <button 
                          onClick={() => setSelectedHistory(null)}
                          className="flex items-center gap-2 text-xs font-extrabold text-brand-muted hover:text-brand-text uppercase tracking-widest transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                        <button 
                          onClick={(e) => handleDeleteHistory(selectedHistory.id, e)}
                          className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-colors"
                          title="Delete History Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-5 space-y-6">
                        <div className="flex items-center justify-between">
                          <span className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest rounded-md border flex items-center gap-2 w-fit ${selectedHistory.verdict === 'SUCCESS' || selectedHistory.verdict === 'ACCEPTED' ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                            {selectedHistory.verdict === 'SUCCESS' || selectedHistory.verdict === 'ACCEPTED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {selectedHistory.verdict.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(selectedHistory.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-2">Code Snippet</p>
                          <div className="bg-[#0d1117] border-2 border-brand-border rounded-lg p-3 text-[11px] font-mono text-[#c9d1d9] max-h-40 overflow-y-auto whitespace-pre-wrap">
                            {selectedHistory.code}
                          </div>
                        </div>

                        {selectedHistory.stdin && (
                          <div>
                            <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-2">Input</p>
                            <div className="bg-brand-surface border-2 border-brand-border rounded-lg p-3 text-[11px] font-mono text-brand-text whitespace-pre-wrap break-words">
                              {selectedHistory.stdin}
                            </div>
                          </div>
                        )}

                        <RunOutputPanel 
                          result={{
                            verdict: selectedHistory.verdict,
                            stdout: selectedHistory.stdout,
                            stderr: selectedHistory.stderr,
                            compileError: selectedHistory.compileError,
                            executionTimeMs: selectedHistory.executionTimeMs
                          }} 
                          isRunning={false} 
                        />
                      </div>
                      <div className="p-4 border-t-2 border-brand-border bg-brand-surface shrink-0">
                        <Button 
                          onClick={loadIntoEditor}
                          className="w-full bg-brand-text text-brand-surface hover:bg-brand-text/90 font-extrabold text-xs"
                        >
                          <Code2 className="w-4 h-4 mr-2" />
                          Load into Editor
                        </Button>
                      </div>
                    </div>
                  ) : isLoadingHistory ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary" />
                    </div>
                  ) : history.length > 0 ? (
                    <div className="flex flex-col h-full bg-brand-bg relative">
                      <div className="bg-brand-surface border-b-2 border-brand-border p-3 shrink-0 flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
                          {selectedCompareIds.length === 1
                            ? "Select one more version to compare"
                            : selectedCompareIds.length === 2
                            ? "2 versions selected"
                            : "Select runs to compare"}
                        </span>
                        <Button
                          disabled={selectedCompareIds.length !== 2}
                          onClick={() => setIsComparing(true)}
                          className="bg-brand-primary text-white hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-brand-primary h-8 px-4 text-[11px] font-extrabold uppercase tracking-widest"
                        >
                          Compare Selected
                        </Button>
                      </div>
                      <div className="flex-1 overflow-auto divide-y-2 divide-brand-border">
                        {history.map((entry) => {
                          const isSuccess = entry.verdict === 'SUCCESS' || entry.verdict === 'ACCEPTED';
                          const isSelected = selectedCompareIds.includes(entry.id);
                          return (
                            <div 
                              key={entry.id} 
                              onClick={() => setSelectedHistory(entry)}
                              className={`flex items-start gap-3 p-4 hover:bg-brand-surface transition-colors cursor-pointer group ${isSelected ? 'bg-brand-primary/5 hover:bg-brand-primary/10' : ''}`}
                            >
                              <div className="pt-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onClick={(e) => handleToggleCompare(entry.id, e)}
                                  className="w-4 h-4 rounded border-2 border-brand-border text-brand-primary focus:ring-brand-primary bg-brand-surface cursor-pointer"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${isSuccess ? 'text-brand-accent' : 'text-red-600'}`}>
                                    {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                    {entry.verdict.replace(/_/g, ' ')}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                                      {new Date(entry.createdAt).toLocaleDateString()}
                                    </span>
                                    <button 
                                      onClick={(e) => handleDeleteHistory(entry.id, e)}
                                      className="text-brand-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-[11px] font-bold text-brand-muted uppercase tracking-widest">
                                  <span className="flex items-center gap-1"><Code2 className="w-3.5 h-3.5" /> {entry.language}</span>
                                  {entry.executionTimeMs !== null && (
                                    <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> {entry.executionTimeMs}ms</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full items-center justify-center text-brand-muted">
                      <History className="w-8 h-8 opacity-30 mb-3" />
                      <span className="text-xs font-bold uppercase tracking-widest">No compiler history yet.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Toolbar (Bottom of Workspace) ────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 bg-brand-surface border-t-2 border-brand-border shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <select className="appearance-none bg-brand-bg border-2 border-brand-border text-brand-text text-xs font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-brand-primary transition-colors cursor-pointer">
                <option value="cpp">C++ 17</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted font-bold" />
            </div>
            
            <div className="relative hidden sm:block">
              <select
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(Number(e.target.value))}
                className="appearance-none bg-brand-bg border-2 border-brand-border text-brand-text text-xs font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-brand-primary transition-colors cursor-pointer"
              >
                <option value={2000}>2s limit</option>
                <option value={5000}>5s limit</option>
                <option value={10000}>10s limit</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted font-bold" />
            </div>
          </div>
          
          <Button
            onClick={handleRun}
            disabled={isRunning}
            className="gap-2 bg-brand-primary text-white hover:bg-blue-600 border-0 text-xs font-extrabold px-8 h-10 transition-all shadow-sm"
          >
            {!isRunning && <Play className="h-4 w-4" />}
            {isRunning ? "Running..." : "Run Code"}
          </Button>
        </div>

      </div>

      {isComparing && selectedCompareIds.length === 2 && (
        (() => {
          const item1 = history.find(h => h.id === selectedCompareIds[0]);
          const item2 = history.find(h => h.id === selectedCompareIds[1]);
          if (!item1 || !item2) return null;
          
          // Sort by date: older is original, newer is modified
          const [original, modified] = new Date(item1.createdAt).getTime() < new Date(item2.createdAt).getTime() 
            ? [item1, item2] 
            : [item2, item1];

          return (
            <CodeDiffViewer
              originalCode={original.code}
              modifiedCode={modified.code}
              originalTitle={`Run #${original.id.substring(0, 8)} (${new Date(original.createdAt).toLocaleString()})`}
              modifiedTitle={`Run #${modified.id.substring(0, 8)} (${new Date(modified.createdAt).toLocaleString()})`}
              title="Compare Compiler Runs"
              onClose={() => setIsComparing(false)}
            />
          );
        })()
      )}
    </div>
  );
}
