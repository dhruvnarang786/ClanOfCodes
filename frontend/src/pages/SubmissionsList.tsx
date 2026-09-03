import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { getVerdictConfig } from "../components/CodeEditor";
import { ChevronLeft, ChevronRight, Activity, Clock, Code2 } from "lucide-react";
import { Button } from "../components/ui/Button";

interface Submission {
  id: string;
  problem: { id: string; title: string; slug: string };
  status: "PENDING" | "JUDGING" | "COMPLETED" | "FAILED";
  verdict: string | null;
  executionTimeMs: number | null;
  language: string;
  createdAt: string;
}

function getVerdictBadge(verdict: string | null, status: string) {
  if (status === "PENDING" || status === "JUDGING") {
    return (
      <span className="px-2.5 py-1 bg-brand-muted/10 text-brand-muted text-[10px] font-extrabold uppercase tracking-widest rounded-md border border-brand-border">
        {status}
      </span>
    );
  }
  
  const vc = verdict ? getVerdictConfig(verdict) : null;
  if (!vc) {
    return (
      <span className="px-2.5 py-1 bg-brand-bg text-brand-muted text-[10px] font-extrabold uppercase tracking-widest rounded-md border border-brand-border">
        {verdict ?? "—"}
      </span>
    );
  }

  // Map the generic tailwind colors from CodeEditor config to our brand colors
  const colorClass = 
    vc.color === 'text-green-400' ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20' : 
    vc.color === 'text-red-400' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
    'bg-amber-500/10 text-amber-600 border-amber-500/20';

  return (
    <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-md border flex items-center gap-1.5 w-fit ${colorClass}`}>
      <vc.Icon className="h-3.5 w-3.5" />
      {vc.label}
    </span>
  );
}

export default function SubmissionsList() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(`/submissions?limit=15&page=${page}`);
        setSubmissions(data.data.submissions ?? []);
        setTotalPages(data.data.pagination.totalPages || 1);
      } catch {
        setError("Failed to load submissions. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubmissions();
  }, [page]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-brand-bg py-12 font-sans selection:bg-brand-primary/20">
      <div className="container mx-auto max-w-5xl px-4 space-y-8">
        
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-text tracking-tight">
            Submission History
          </h1>
          <p className="text-brand-muted font-medium text-sm md:text-base max-w-2xl">
            Track your coding attempts and results.
          </p>
        </div>

        {error && (
          <div className="text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            {error}
          </div>
        )}

        <div className="bg-brand-surface rounded-2xl border-2 border-brand-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-bg/50 border-b-2 border-brand-border">
                  <th className="px-6 py-4 text-[10px] font-extrabold text-brand-muted uppercase tracking-widest whitespace-nowrap">Problem</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-brand-muted uppercase tracking-widest whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-brand-muted uppercase tracking-widest whitespace-nowrap hidden sm:table-cell">Details</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-brand-muted uppercase tracking-widest whitespace-nowrap text-right">Time Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-brand-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
                        <span className="font-bold text-sm text-brand-muted uppercase tracking-widest">Loading Submissions...</span>
                      </div>
                    </td>
                  </tr>
                ) : submissions.length > 0 ? (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="group hover:bg-brand-bg transition-colors relative">
                      <td className="px-6 py-5">
                        <Link to={`/submissions/${sub.id}`} className="absolute inset-0 z-0" aria-hidden="true"></Link>
                        <Link
                          to={`/problems/${sub.problem.slug}`}
                          className="relative z-10 font-extrabold text-brand-text hover:text-brand-primary transition-colors text-sm"
                        >
                          {sub.problem.title}
                        </Link>
                      </td>
                      <td className="px-6 py-5 relative z-10">
                        <Link to={`/submissions/${sub.id}`}>
                          {getVerdictBadge(sub.verdict, sub.status)}
                        </Link>
                      </td>
                      <td className="px-6 py-5 hidden sm:table-cell relative z-10">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand-muted uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" />
                            {sub.executionTimeMs != null ? `${sub.executionTimeMs}ms` : "—"}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand-muted uppercase tracking-widest">
                            <Code2 className="w-3.5 h-3.5" />
                            {sub.language}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right relative z-10">
                        <span className="text-xs font-bold text-brand-muted group-hover:text-brand-text transition-colors">
                          {new Date(sub.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-24">
                      <div className="flex flex-col items-center justify-center gap-4 text-brand-muted">
                        <Activity className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest">No submissions yet.</p>
                        <p className="text-xs font-medium max-w-sm text-center">Start solving problems to build your coding history and track your progress.</p>
                        <Link to="/problems" className="mt-2 relative z-10">
                          <Button className="bg-brand-primary text-white hover:bg-blue-600 border-0 text-xs font-extrabold px-6 h-10 transition-all shadow-sm">
                            Browse Problems
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t-2 border-brand-border bg-brand-surface flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-muted uppercase tracking-widest">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="p-2 rounded-lg border-2 border-brand-border bg-brand-bg text-brand-muted hover:text-brand-text hover:border-brand-primary/50 disabled:opacity-50 disabled:hover:border-brand-border transition-colors disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isLoading}
                  className="p-2 rounded-lg border-2 border-brand-border bg-brand-bg text-brand-muted hover:text-brand-text hover:border-brand-primary/50 disabled:opacity-50 disabled:hover:border-brand-border transition-colors disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
