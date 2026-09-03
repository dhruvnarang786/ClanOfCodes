import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import { Pencil, Trash2, TestTube2, Eye, Plus, Users, Code2, CheckCircle2, Target, AlertCircle } from "lucide-react";

interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  creator: { id: string; name: string };
  _count: { testCases: number; submissions: number };
}

interface Analytics {
  totalProblems: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
}

// ─── Confirmation dialog ──────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-sm font-semibold text-brand-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={isDeleting} className="font-bold">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isDeleting} className="bg-red-500 hover:bg-red-600 text-white font-bold border-0 shadow-sm">
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────

export default function ProfessorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const fetchProblemsAndAnalytics = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError("");
    try {
      const [problemsRes, analyticsRes] = await Promise.all([
        api.get(`/problems?limit=100&creatorId=${user.id}`),
        api.get("/analytics/dashboard"),
      ]);
      setProblems(problemsRes.data.data.problems ?? []);
      setAnalytics(analyticsRes.data.data);
    } catch {
      setError("Failed to load dashboard data. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProblemsAndAnalytics();
  }, [fetchProblemsAndAnalytics]);

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/problems/${deletingId}`);
      setDeletingId(null);
      setSuccessMsg("Problem deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchProblemsAndAnalytics();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete problem.");
      setDeletingId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const diffBadgeColor: Record<string, string> = {
    EASY: "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
    MEDIUM: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    HARD: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <div className="bg-brand-bg text-brand-text font-sans min-h-[calc(100vh-4rem)] pb-12 selection:bg-brand-primary/20">
      <div className="container mx-auto max-w-6xl pt-8 px-4 sm:px-6 space-y-8">
        
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-text">
              Professor Dashboard
            </h1>
            <p className="text-sm font-semibold text-brand-muted">
              Create problems, manage test cases, and track student performance.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/professor/problems/create")} 
            className="gap-2 bg-brand-primary text-white hover:bg-blue-600 border-0 font-extrabold shadow-sm px-6 py-2.5 h-auto text-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create New Problem
          </Button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="bg-brand-accent/10 text-brand-accent text-sm font-bold border-2 border-brand-accent/20 rounded-xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 text-red-600 text-sm font-bold border-2 border-red-500/20 rounded-xl p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-brand-primary/40 transition-colors">
              <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary shrink-0">
                <Code2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics.totalProblems}</div>
                <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Total Problems</div>
              </div>
            </div>

            <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-purple-500/40 transition-colors">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics.totalSubmissions}</div>
                <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Submissions</div>
              </div>
            </div>

            <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-brand-accent/40 transition-colors">
              <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics.acceptedSubmissions}</div>
                <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Accepted</div>
              </div>
            </div>

            <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics.acceptanceRate}%</div>
                <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Acceptance Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Problems section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-text">Your Problems</h2>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-muted bg-brand-surface border-2 border-brand-border px-3 py-1 rounded-md">
              {problems.length} total
            </span>
          </div>
          
          <div className="bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
              </div>
            ) : problems.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-brand-bg border-2 border-brand-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <TestTube2 className="h-8 w-8 text-brand-muted" />
                </div>
                <h3 className="text-lg font-extrabold text-brand-text mb-2">No problems created yet</h3>
                <p className="text-sm font-semibold text-brand-muted mb-6 max-w-md mx-auto">
                  Get started by creating your first coding problem. You'll be able to manage test cases and view student submissions here.
                </p>
                <Button 
                  onClick={() => navigate("/professor/problems/create")} 
                  className="bg-brand-primary text-white hover:bg-blue-600 border-0 font-extrabold shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Problem
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-bg border-b-2 border-brand-border">
                    <tr>
                      <th className="px-5 py-4 text-xs font-extrabold text-brand-muted uppercase tracking-widest">Problem</th>
                      <th className="px-5 py-4 text-xs font-extrabold text-brand-muted uppercase tracking-widest">Difficulty</th>
                      <th className="px-5 py-4 text-xs font-extrabold text-brand-muted uppercase tracking-widest text-center">Test Cases</th>
                      <th className="px-5 py-4 text-xs font-extrabold text-brand-muted uppercase tracking-widest text-center">Submissions</th>
                      <th className="px-5 py-4 text-xs font-extrabold text-brand-muted uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-brand-border">
                    {problems.map((prob) => (
                      <tr key={prob.id} className="hover:bg-brand-bg/50 transition-colors group">
                        <td className="px-5 py-4">
                          <span className="font-bold text-sm text-brand-text block">{prob.title}</span>
                          <span className="text-[11px] font-semibold text-brand-muted mt-1 uppercase tracking-widest">/{prob.slug}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded border inline-block ${diffBadgeColor[prob.difficulty]}`}>
                            {prob.difficulty}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-brand-surface border-2 border-brand-border rounded-md px-2.5 py-1 text-xs font-bold text-brand-text">
                            {prob._count.testCases}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-brand-surface border-2 border-brand-border rounded-md px-2.5 py-1 text-xs font-bold text-brand-text">
                            {prob._count.submissions}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <Link to={`/problems/${prob.slug}`} title="Student View">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/professor/problems/${prob.id}/manage`} title="Manage Problem">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-brand-muted hover:text-brand-text hover:bg-brand-border rounded-lg">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-brand-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                              title="Delete Problem"
                              onClick={() => setDeletingId(prob.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deletingId && (
        <ConfirmDialog
          title="Delete Problem"
          message="Are you sure you want to delete this problem? All associated test cases and submissions will also be permanently deleted. This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
