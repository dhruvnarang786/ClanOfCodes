import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ProblemFormProps {
  /** If provided, the form is in edit mode */
  problemId?: string;
  initialData?: {
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    timeLimitMs: number;
    memoryLimitMb: number;
  };
  onSuccess?: (problem: { id: string; slug: string }) => void;
}

export default function ProblemForm({ problemId, initialData, onSuccess }: ProblemFormProps) {
  const navigate = useNavigate();
  const isEdit = !!problemId;

  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    difficulty: initialData?.difficulty ?? "EASY",
    timeLimitMs: initialData?.timeLimitMs ?? 2000,
    memoryLimitMb: initialData?.memoryLimitMb ?? 256,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const set = (field: string, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.title.trim()) return setError("Title is required.");
    if (!form.description.trim()) return setError("Description is required.");

    setIsSubmitting(true);
    try {
      let res;
      if (isEdit) {
        res = await api.put(`/problems/${problemId}`, form);
        setSuccessMsg("Problem updated successfully.");
      } else {
        res = await api.post("/problems", form);
        setSuccessMsg("Problem created successfully.");
      }
      onSuccess?.(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 text-red-600 text-sm font-bold border-2 border-red-500/20 rounded-xl p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-brand-accent/10 text-brand-accent text-sm font-bold border-2 border-brand-accent/20 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {successMsg}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Title *</label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Two Sum"
          className="w-full bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 focus:outline-none focus:border-brand-primary transition-colors placeholder:text-brand-muted/50"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Description *</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={8}
          placeholder="Write the problem statement here. Markdown is supported."
          className="w-full bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-3 focus:outline-none focus:border-brand-primary transition-colors placeholder:text-brand-muted/50 resize-y"
          required
        />
      </div>

      {/* Difficulty + limits in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Difficulty</label>
          <select
            value={form.difficulty}
            onChange={(e) => set("difficulty", e.target.value)}
            className="w-full bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 focus:outline-none focus:border-brand-primary transition-colors cursor-pointer appearance-none"
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Time Limit (ms)</label>
          <input
            type="number"
            min={100}
            max={30000}
            value={form.timeLimitMs}
            onChange={(e) => set("timeLimitMs", parseInt(e.target.value) || 2000)}
            className="w-full bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 focus:outline-none focus:border-brand-primary transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Memory Limit (MB)</label>
          <input
            type="number"
            min={16}
            max={512}
            value={form.memoryLimitMb}
            onChange={(e) => set("memoryLimitMb", parseInt(e.target.value) || 256)}
            className="w-full bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 focus:outline-none focus:border-brand-primary transition-colors"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <Button 
          type="submit" 
          isLoading={isSubmitting}
          className="bg-brand-primary text-white hover:bg-blue-600 border-0 font-extrabold shadow-sm px-8"
        >
          {isEdit ? "Save Changes" : "Create Problem"}
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => navigate(isEdit ? "/professor/dashboard" : "/professor/dashboard")}
          className="font-bold text-brand-muted hover:text-brand-text"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
