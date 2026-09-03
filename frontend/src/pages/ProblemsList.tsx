import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Search, Code2, ArrowRight, Target, Activity, AlertCircle } from "lucide-react";

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  _count: { testCases: number; submissions: number };
}

function DiffBadge({ diff }: { diff: string }) {
  if (diff === "EASY") return <span className="px-2.5 py-1 bg-brand-accent/10 text-brand-accent text-[10px] font-extrabold rounded-md border border-brand-accent/20 uppercase tracking-widest">Easy</span>;
  if (diff === "MEDIUM") return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-extrabold rounded-md border border-amber-500/20 uppercase tracking-widest">Medium</span>;
  if (diff === "HARD") return <span className="px-2.5 py-1 bg-red-500/10 text-red-600 text-[10px] font-extrabold rounded-md border border-red-500/20 uppercase tracking-widest">Hard</span>;
  return <span className="px-2.5 py-1 bg-brand-bg text-brand-muted text-[10px] font-extrabold rounded-md border border-brand-border uppercase tracking-widest">{diff}</span>;
}

export default function ProblemsList() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState<"" | "EASY" | "MEDIUM" | "HARD">("");

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const url = diffFilter
          ? `/problems?limit=100&difficulty=${diffFilter}`
          : "/problems?limit=100";
        const { data } = await api.get(url);
        setProblems(data.data.problems ?? []);
      } catch {
        setError("Failed to load problems. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProblems();
  }, [diffFilter]);

  const filtered = problems.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-primary/20 pb-12">
      <div className="container mx-auto max-w-5xl pt-10 px-4 sm:px-6 space-y-8">
        
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold text-brand-text tracking-tight">Problems</h1>
          <p className="text-brand-muted font-medium text-base">Practice, solve, and level up your coding skills.</p>
        </div>

        {/* Controls Section */}
        <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted font-bold" />
            <input
              type="text"
              placeholder="Search problems…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-brand-border bg-brand-bg text-brand-text text-sm font-semibold focus:outline-none focus:border-brand-primary transition-colors placeholder:text-brand-muted/70"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={diffFilter}
              onChange={(e) => setDiffFilter(e.target.value as typeof diffFilter)}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-brand-border bg-brand-bg text-brand-text text-sm font-semibold focus:outline-none focus:border-brand-primary transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-600 font-semibold p-4 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Problems List */}
        <div className="bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-bg/50 border-b-2 border-brand-border text-[11px] uppercase tracking-widest text-brand-muted font-extrabold">
                  <th className="px-6 py-4 w-12 text-center">#</th>
                  <th className="px-6 py-4">Problem Title</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4 text-center">Test Cases</th>
                  <th className="px-6 py-4 text-center">Submissions</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-brand-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
                        <span className="text-sm font-semibold text-brand-muted">Loading problems...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-brand-bg/50 transition-colors group">
                      <td className="px-6 py-4 text-center font-bold text-brand-muted/50 text-sm">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/problems/${p.slug}`}
                          className="font-bold text-base text-brand-text group-hover:text-brand-primary transition-colors flex items-center gap-2"
                        >
                          <Code2 className="w-4 h-4 text-brand-muted group-hover:text-brand-primary transition-colors" />
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <DiffBadge diff={p.difficulty} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 font-bold text-sm text-brand-muted">
                          <Target className="w-4 h-4" />
                          {p._count?.testCases ?? "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 font-bold text-sm text-brand-muted">
                          <Activity className="w-4 h-4" />
                          {p._count?.submissions ?? "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/problems/${p.slug}`}
                          className="inline-flex items-center gap-2 text-sm font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 px-4 py-2 rounded-lg transition-colors"
                        >
                          Solve <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Search className="w-8 h-8 text-brand-muted/30 mb-2" />
                        <span className="text-base font-bold text-brand-text">No problems found</span>
                        <span className="text-sm font-medium text-brand-muted">
                          {search ? `We couldn't find anything matching "${search}".` : "Check back later for new challenges!"}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-brand-muted uppercase tracking-wider px-2">
          <span>Showing {filtered.length} problem{filtered.length !== 1 ? "s" : ""}</span>
          {(diffFilter || search) && (
            <span>Filtered results</span>
          )}
        </div>
      </div>
    </div>
  );
}
