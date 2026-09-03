import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Code2, CheckCircle2, XCircle, AlertCircle, Clock, FileText, ArrowRight, Target, Activity } from "lucide-react";

interface Submission {
  id: string;
  problem: { id: string; title: string; slug: string };
  language: string;
  status: "PENDING" | "JUDGING" | "COMPLETED" | "FAILED";
  verdict: string | null;
  executionTimeMs: number | null;
  createdAt: string;
}

function VerdictBadge({ verdict, status }: { verdict: string | null, status: string }) {
  if (status === "PENDING" || status === "JUDGING") {
    return <span className="px-2 py-1 bg-brand-muted/10 text-brand-muted text-xs font-bold rounded border border-brand-border flex items-center gap-1"><Clock className="w-3 h-3" /> {status}</span>;
  }
  if (verdict === "ACCEPTED") return <span className="px-2 py-1 bg-brand-accent/10 text-brand-accent text-xs font-bold rounded border border-brand-accent/20 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Accepted</span>;
  if (verdict === "WRONG_ANSWER") return <span className="px-2 py-1 bg-red-500/10 text-red-600 text-xs font-bold rounded border border-red-500/20 flex items-center gap-1"><XCircle className="w-3 h-3" /> Wrong Answer</span>;
  if (verdict === "COMPILATION_ERROR" || verdict === "RUNTIME_ERROR") return <span className="px-2 py-1 bg-amber-500/10 text-amber-600 text-xs font-bold rounded border border-amber-500/20 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {verdict === "COMPILATION_ERROR" ? "Compile Error" : "Runtime Error"}</span>;
  
  return <span className="px-2 py-1 bg-brand-bg text-brand-muted text-xs font-bold rounded border border-brand-border">{verdict?.replace(/_/g, " ") ?? "—"}</span>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, accepted: 0 });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch recent submissions for the list
        const { data } = await api.get("/submissions?limit=5");
        setRecentSubmissions(data.data.submissions ?? []);
        
        const total = data.data.pagination?.total || 0;
        
        // Fetch a larger sample to calculate acceptance accurately without modifying backend
        // We fetch up to 50 (max limit) to derive the stats
        const { data: statsData } = await api.get("/submissions?limit=50");
        const sampleSubmissions: Submission[] = statsData.data.submissions ?? [];
        
        let acceptedCount = 0;
        if (total > 0 && sampleSubmissions.length > 0) {
           const sampleAccepted = sampleSubmissions.filter(s => s.verdict === "ACCEPTED").length;
           // Project the accepted count if total > 50, otherwise use exact
           const rate = sampleAccepted / sampleSubmissions.length;
           acceptedCount = total <= 50 ? sampleAccepted : Math.round(total * rate);
        }
        
        setStats({ total, accepted: acceptedCount });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const latestSub = recentSubmissions[0];
  const acceptanceRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;
  
  // Find a problem to continue solving (prefer non-accepted recent submission)
  const problemToContinue = recentSubmissions.find(s => s.verdict !== "ACCEPTED") || latestSub;
  const isAccepted = problemToContinue?.verdict === "ACCEPTED";

  return (
    <div className="bg-brand-bg text-brand-text font-sans selection:bg-brand-primary/20 pb-8">
      <div className="container mx-auto max-w-6xl pt-8 pb-4 px-4 sm:px-6 space-y-8">
        
        {/* HERO SECTION - Reduced vertical spacing */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-4">
          <div className="space-y-5 flex-1 max-w-xl">
            {/* Slightly reduced font weight from extrabold to bold */}
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight text-brand-text">
              Code.<br/>Compile.<br/><span className="text-brand-accent">Conquer.</span>
            </h1>
            <p className="text-base text-brand-muted font-medium">
              Practice, compete and level up your skills with every line of code.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/problems" className="flex items-center gap-2 bg-brand-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-sm hover:shadow-md">
                Browse Problems <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/compiler" className="flex items-center gap-2 bg-brand-surface hover:bg-brand-bg text-brand-text border-2 border-brand-border px-5 py-2.5 rounded-lg font-bold transition-all shadow-sm hover:shadow-md">
                Open Compiler
              </Link>
            </div>
          </div>
          
          {/* Hero Decorative Card - Compacted slightly */}
          <div className="hidden lg:block flex-1 relative w-full max-w-sm">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/20 to-brand-accent/20 blur-3xl -z-10 rounded-full opacity-70 animate-pulse"></div>
            <div className="bg-brand-surface rounded-xl border-2 border-brand-border shadow-xl overflow-hidden text-[11px]">
              <div className="bg-brand-bg border-b-2 border-brand-border px-3 py-1.5 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-brand-accent"></div>
                <div className="ml-auto font-bold text-brand-muted flex items-center gap-1"><Code2 className="w-3 h-3"/> solution.cpp</div>
              </div>
              <div className="p-4 font-mono text-brand-muted leading-relaxed">
                <span className="text-pink-500">#include</span> &lt;iostream&gt;<br/>
                <span className="text-pink-500">using namespace</span> std;<br/><br/>
                <span className="text-brand-primary">int</span> <span className="text-brand-accent">main</span>() {'{'}<br/>
                &nbsp;&nbsp;cout &lt;&lt; <span className="text-amber-500">"Hello ClanOfCodes!"</span> &lt;&lt; endl;<br/>
                &nbsp;&nbsp;<span className="text-pink-500">return</span> <span className="text-brand-primary">0</span>;<br/>
                {'}'}
              </div>
            </div>
          </div>
        </div>

        {/* 3 BALANCED STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-brand-primary/40 transition-colors">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary shrink-0">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Submissions</div>
            </div>
          </div>
          
          <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-brand-accent/40 transition-colors">
            <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.accepted}</div>
              <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Accepted</div>
            </div>
          </div>

          <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-amber-500/40 transition-colors">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{acceptanceRate}%</div>
              <div className="text-xs text-brand-muted font-bold tracking-wide uppercase mt-0.5">Acceptance Rate</div>
            </div>
          </div>
        </div>

        {/* CONTINUE SOLVING & RECENT SUBMISSIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Continue Solving - takes 1/3 space on large screens */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-brand-text">Continue Solving</h2>
              </div>
            </div>
            
            <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              {problemToContinue ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight text-brand-text line-clamp-1">{problemToContinue.problem.title}</h3>
                      <p className="text-xs font-medium text-brand-muted mt-1">
                        {isAccepted ? "Completed on " : "Last attempted "}
                        {new Date(problemToContinue.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Link to={`/problems/${problemToContinue.problem.slug}`} className="inline-block w-full text-center bg-brand-bg hover:bg-brand-border text-brand-text font-bold py-2 rounded-lg transition-colors border-2 border-brand-border text-sm">
                    {isAccepted ? "View Problem" : "Resume Problem"}
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6 text-brand-muted">
                  <p className="text-sm font-medium">No recent problems found.</p>
                  <Link to="/problems" className="text-brand-primary font-bold text-sm hover:underline mt-2 inline-block">Browse Problems</Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Submissions - takes 2/3 space on large screens */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-brand-text">Recent Submissions</h2>
              </div>
              <Link to="/submissions" className="text-sm font-bold text-brand-primary hover:underline">
                View All
              </Link>
            </div>

            <div className="bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary" />
                </div>
              ) : recentSubmissions.length > 0 ? (
                <div className="divide-y-2 divide-brand-border">
                  {recentSubmissions.map((sub) => (
                    <Link 
                      key={sub.id} 
                      to={`/submissions/${sub.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-brand-bg hover:-translate-y-0.5 transition-all group gap-3 block hover:shadow-sm"
                    >
                      <div className="flex-1">
                        <span className="font-bold text-sm text-brand-text group-hover:text-brand-primary transition-colors line-clamp-1">
                          {sub.problem.title}
                        </span>
                        <div className="flex items-center gap-3 text-xs font-semibold text-brand-muted mt-1.5">
                          <span className="flex items-center gap-1"><Code2 className="w-3 h-3"/> {sub.language}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(sub.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          {sub.executionTimeMs !== null && (
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3"/> {sub.executionTimeMs}ms</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <VerdictBadge verdict={sub.verdict} status={sub.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-brand-muted text-sm font-medium">
                  No submissions yet.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
