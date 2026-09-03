import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { CodeEditor, getVerdictConfig } from "../components/CodeEditor";
import { ChevronLeft, Clock, Calendar, AlertCircle } from "lucide-react";

interface SubmissionDetail {
  id: string;
  code: string;
  language: string;
  status: "PENDING" | "JUDGING" | "COMPLETED" | "FAILED";
  verdict: string | null;
  executionTimeMs: number | null;
  memoryUsedMb: number | null;
  compileError: string | null;
  createdAt: string;
  problem: {
    id: string;
    title: string;
    slug: string;
    difficulty: string;
  };
}

export default function SubmissionDetails() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchSubmission = async () => {
      try {
        const { data } = await api.get(`/submissions/${id}`);
        setSubmission(data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load submission.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubmission();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
          <span className="font-bold text-sm text-brand-muted uppercase tracking-widest">Loading Submission...</span>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col gap-3 bg-brand-bg">
        <p className="text-red-500 font-bold bg-red-50 px-4 py-2 rounded-lg border-2 border-red-200">{error || "Submission not found."}</p>
        <Link to="/submissions" className="text-brand-primary text-sm font-bold hover:underline">
          ← Back to Submissions
        </Link>
      </div>
    );
  }

  const vc = submission.verdict ? getVerdictConfig(submission.verdict) : null;
  const isPending = submission.status === "PENDING" || submission.status === "JUDGING";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-brand-bg font-sans selection:bg-brand-primary/20 py-8">
      <div className="container mx-auto max-w-6xl px-4 flex flex-col h-[calc(100vh-8rem)]">
        
        {/* Header Section */}
        <div className="flex items-center gap-4 shrink-0 mb-6">
          <Link to="/submissions" className="text-brand-muted hover:text-brand-text transition-colors p-2 rounded-lg border-2 border-brand-border bg-brand-surface shadow-sm">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-brand-text flex items-center gap-2">
              Submission for 
              <Link to={`/problems/${submission.problem.slug}`} className="text-brand-primary hover:underline">
                {submission.problem.title}
              </Link>
            </h1>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          
          {/* Left column: Details */}
          <div className={`w-full ${showCode ? 'md:w-[30%] lg:w-[25%]' : 'max-w-2xl mx-auto'} space-y-4 shrink-0 transition-all duration-300`}>
            <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-6 shadow-sm space-y-6">
              
              <div>
                <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-3">Status</p>
                {isPending ? (
                  <span className="px-3 py-1.5 bg-brand-muted/10 text-brand-muted text-xs font-extrabold uppercase tracking-widest rounded-md border border-brand-border inline-block">
                    {submission.status}
                  </span>
                ) : vc ? (
                  <span className={`px-4 py-2 text-sm font-extrabold uppercase tracking-widest rounded-md border-2 flex items-center gap-2 w-fit ${vc.color === 'text-green-400' ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20' : vc.color === 'text-red-400' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                    <vc.Icon className="h-5 w-5" />
                    {vc.label}
                  </span>
                ) : (
                  <span className="px-3 py-1.5 bg-brand-bg text-brand-muted text-xs font-extrabold uppercase tracking-widest rounded-md border border-brand-border inline-block">
                    {submission.verdict ?? "—"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-1.5">Language</p>
                  <p className="text-brand-text font-bold text-base">{submission.language}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-1.5">Submitted</p>
                  <p className="text-brand-text font-bold text-base flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-brand-muted" />
                    {new Date(submission.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-1.5">Runtime</p>
                  <p className="text-brand-text font-bold text-base flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-brand-muted" />
                    {submission.executionTimeMs != null ? `${submission.executionTimeMs} ms` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-widest mb-1.5">Memory</p>
                  <p className="text-brand-text font-bold text-base">
                    {submission.memoryUsedMb != null ? `${submission.memoryUsedMb} MB` : "—"}
                  </p>
                </div>
              </div>
              
              {submission.compileError && (
                <div className="pt-4 border-t-2 border-brand-border/50">
                  <div className="bg-red-100/50 px-3 py-2 border-b-2 border-red-200 flex items-center gap-2 rounded-t-xl">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-red-600 text-xs font-bold uppercase tracking-widest">
                      Compilation Error
                    </p>
                  </div>
                  <pre className="text-black font-extrabold whitespace-pre-wrap text-[11px] leading-relaxed bg-red-50 p-4 border-2 border-t-0 border-red-200 rounded-b-xl overflow-x-auto">
                    {submission.compileError}
                  </pre>
                </div>
              )}

              {!showCode && (
                <div className="pt-4 mt-4 border-t-2 border-brand-border/50">
                  <button
                    onClick={() => setShowCode(true)}
                    className="w-full bg-brand-primary text-white font-extrabold text-sm py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    View Code
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column: Source code */}
          {showCode && (
            <div className="flex-1 flex flex-col min-w-0 border-2 border-brand-border rounded-xl overflow-hidden bg-[#0d1117] shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center px-5 py-3 bg-brand-surface border-b-2 border-brand-border shrink-0">
                <span className="text-[11px] font-extrabold text-brand-muted uppercase tracking-widest">Source Code</span>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <CodeEditor value={submission.code} readOnly={true} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
