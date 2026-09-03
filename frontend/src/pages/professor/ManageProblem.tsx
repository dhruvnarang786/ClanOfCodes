import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../lib/api";
import ProblemForm from "./ProblemForm";
import TestCaseManager from "./TestCaseManager";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, ExternalLink, Settings, TestTube2, Users, BarChart3, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";

interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  creatorId: string;
}

type Tab = "details" | "testcases" | "submissions" | "analytics";

export default function ManageProblem() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("details");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/problems?limit=100`);
        const all = data.data.problems as Problem[];
        const found = all.find((p: Problem) => p.id === problemId);
        if (!found) {
          setError("Problem not found or you do not have access.");
        } else {
          setProblem(found);
        }
      } catch {
        setError("Failed to load problem.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [problemId]);

  if (isLoading) {
    return (
      <div className="bg-brand-bg min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="bg-brand-bg min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 font-bold mb-4">{error || "Problem not found."}</p>
          <Button variant="ghost" className="font-bold" onClick={() => navigate("/professor/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const diffBadgeColor: Record<string, string> = {
    EASY: "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
    MEDIUM: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    HARD: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  const getTabIcon = (tab: Tab) => {
    switch (tab) {
      case "details": return <Settings className="w-4 h-4 mr-2" />;
      case "testcases": return <TestTube2 className="w-4 h-4 mr-2" />;
      case "submissions": return <Users className="w-4 h-4 mr-2" />;
      case "analytics": return <BarChart3 className="w-4 h-4 mr-2" />;
    }
  };

  return (
    <div className="bg-brand-bg text-brand-text font-sans min-h-[calc(100vh-4rem)] pb-12 selection:bg-brand-primary/20">
      <div className="container mx-auto max-w-5xl pt-8 px-4 sm:px-6 space-y-6">
        
        {/* Top bar */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/professor/dashboard")}
              className="flex items-center gap-2 text-xs font-extrabold text-brand-muted hover:text-brand-text uppercase tracking-widest transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-extrabold text-brand-text tracking-tight truncate mb-3">
              {problem.title}
            </h1>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded border ${diffBadgeColor[problem.difficulty]}`}>
                {problem.difficulty}
              </span>
              <span className="text-xs font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {problem.timeLimitMs}ms
              </span>
              <span className="text-xs font-bold text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> {problem.memoryLimitMb}MB
              </span>
            </div>
          </div>
          <Link
            to={`/problems/${problem.slug}`}
            target="_blank"
            className="flex items-center gap-2 text-xs font-extrabold bg-brand-surface border-2 border-brand-border px-4 py-2 rounded-lg hover:border-brand-primary/50 hover:text-brand-primary transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
            Student View
          </Link>
        </div>

        {/* Workspace Container */}
        <div className="bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm overflow-hidden">
          
          {/* Tabs */}
          <div className="flex items-center border-b-2 border-brand-border bg-brand-bg px-2 pt-2 gap-1 overflow-x-auto shadow-sm">
            {(["details", "testcases", "submissions", "analytics"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors border-2 border-b-0 whitespace-nowrap flex items-center ${
                  activeTab === tab
                    ? "bg-brand-surface text-brand-text border-brand-border"
                    : "bg-transparent text-brand-muted border-transparent hover:text-brand-text hover:bg-brand-border/30"
                }`}
              >
                {getTabIcon(tab)}
                {tab === "testcases" ? "Test Cases" : tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6 sm:p-8 min-h-[500px]">
            {activeTab === "details" && (
              <ProblemForm
                problemId={problem.id}
                initialData={{
                  title: problem.title,
                  description: problem.description,
                  difficulty: problem.difficulty,
                  timeLimitMs: problem.timeLimitMs,
                  memoryLimitMb: problem.memoryLimitMb,
                }}
                onSuccess={() => {
                  window.location.reload();
                }}
              />
            )}

            {activeTab === "testcases" && (
              <TestCaseManager problemId={problem.id} />
            )}

            {activeTab === "submissions" && (
              <SubmissionsTab problemId={problem.id} />
            )}

            {activeTab === "analytics" && (
              <AnalyticsTab problemId={problem.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics sub-tab ────────────────────────────────────────────────

function AnalyticsTab({ problemId }: { problemId: string }) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/analytics/problems/${problemId}`);
        setStats(data.data);
      } catch {
        setError("Failed to load analytics.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [problemId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-500/10 text-red-600 text-sm font-bold border-2 border-red-500/20 rounded-xl p-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        {error || "No data available."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-brand-bg border-2 border-brand-border p-5 rounded-xl">
        <p className="text-xs text-brand-muted uppercase tracking-widest font-extrabold mb-2">Total Submissions</p>
        <p className="text-3xl font-black text-brand-text">{stats.totalSubmissions}</p>
      </div>
      <div className="bg-brand-bg border-2 border-brand-border p-5 rounded-xl">
        <p className="text-xs text-brand-muted uppercase tracking-widest font-extrabold mb-2">Acceptance Rate</p>
        <p className="text-3xl font-black text-brand-text">{stats.acceptanceRate}%</p>
      </div>
      <div className="bg-brand-accent/5 border-2 border-brand-accent/20 p-5 rounded-xl">
        <p className="text-xs text-brand-accent uppercase tracking-widest font-extrabold mb-2">Accepted</p>
        <p className="text-3xl font-black text-brand-accent">{stats.accepted}</p>
      </div>
      <div className="bg-red-500/5 border-2 border-red-500/20 p-5 rounded-xl">
        <p className="text-xs text-red-600 uppercase tracking-widest font-extrabold mb-2">Wrong Answer</p>
        <p className="text-3xl font-black text-red-600">{stats.wrongAnswer}</p>
      </div>
      <div className="bg-orange-500/5 border-2 border-orange-500/20 p-5 rounded-xl">
        <p className="text-xs text-orange-500 uppercase tracking-widest font-extrabold mb-2">Compile Error</p>
        <p className="text-3xl font-black text-orange-500">{stats.compilationError}</p>
      </div>
      <div className="bg-red-500/5 border-2 border-red-500/20 p-5 rounded-xl">
        <p className="text-xs text-red-600 uppercase tracking-widest font-extrabold mb-2">Runtime Error</p>
        <p className="text-3xl font-black text-red-600">{stats.runtimeError}</p>
      </div>
      <div className="bg-amber-500/5 border-2 border-amber-500/20 p-5 rounded-xl">
        <p className="text-xs text-amber-500 uppercase tracking-widest font-extrabold mb-2">Time Limit</p>
        <p className="text-3xl font-black text-amber-500">{stats.timeLimitExceeded}</p>
      </div>
    </div>
  );
}

// ─── Submissions sub-tab ───────────────────────────────────────────────

import { getVerdictConfig } from "../../components/CodeEditor";

function SubmissionsTab({ problemId }: { problemId: string }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/submissions?problemId=${problemId}&limit=50`);
        setSubmissions(data.data.submissions ?? []);
      } catch {
        setError("Failed to load submissions.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [problemId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 text-red-600 text-sm font-bold border-2 border-red-500/20 rounded-xl p-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        {error}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-brand-muted">
        <Users className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-extrabold uppercase tracking-widest">No submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left bg-brand-bg border-2 border-brand-border rounded-xl border-separate border-spacing-0 overflow-hidden">
        <thead className="bg-brand-bg">
          <tr>
            <th className="px-5 py-4 border-b-2 border-brand-border text-xs font-extrabold text-brand-muted uppercase tracking-widest">Student</th>
            <th className="px-5 py-4 border-b-2 border-brand-border text-xs font-extrabold text-brand-muted uppercase tracking-widest">Status</th>
            <th className="px-5 py-4 border-b-2 border-brand-border text-xs font-extrabold text-brand-muted uppercase tracking-widest">Verdict</th>
            <th className="px-5 py-4 border-b-2 border-brand-border text-xs font-extrabold text-brand-muted uppercase tracking-widest">Runtime</th>
            <th className="px-5 py-4 border-b-2 border-brand-border text-xs font-extrabold text-brand-muted uppercase tracking-widest">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-brand-border">
          {submissions.map((sub) => {
            const vc = sub.verdict ? getVerdictConfig(sub.verdict) : null;
            return (
              <tr key={sub.id} className="hover:bg-brand-surface transition-colors">
                <td className="px-5 py-4 font-bold text-sm text-brand-text">{sub.user?.name ?? "—"}</td>
                <td className="px-5 py-4">
                  <span className="bg-brand-surface border-2 border-brand-border px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest text-brand-text">
                    {sub.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Link to={`/submissions/${sub.id}`} target="_blank" className="hover:opacity-80 inline-block">
                    {vc ? (
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-extrabold uppercase tracking-widest ${vc.color === 'text-green-400' ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20' : vc.color === 'text-red-400' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                        <vc.Icon className="h-3.5 w-3.5" />
                        {vc.label}
                      </div>
                    ) : (
                      <span className="bg-brand-surface border-2 border-brand-border px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                        {sub.verdict ?? "—"}
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-5 py-4 text-xs font-bold text-brand-muted uppercase tracking-widest">
                  {sub.executionTimeMs != null ? `${sub.executionTimeMs}ms` : "—"}
                </td>
                <td className="px-5 py-4 text-[11px] font-bold text-brand-muted uppercase tracking-widest">
                  {new Date(sub.createdAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
