import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Pencil, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  createdAt: string;
}

interface TestCaseManagerProps {
  problemId: string;
}

// Confirmation dialog
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-brand-surface border-2 border-brand-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="text-lg font-bold">Delete Test Case</h3>
        </div>
        <p className="text-sm font-semibold text-brand-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} className="font-bold text-brand-muted hover:text-brand-text">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white font-bold border-0 shadow-sm">
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// Inline add/edit form for a single test case
function TestCaseForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<TestCase>;
  onSave: (data: { input: string; expectedOutput: string; isHidden: boolean }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [input, setInput] = useState(initial?.input ?? "");
  const [expectedOutput, setExpectedOutput] = useState(initial?.expectedOutput ?? "");
  const [isHidden, setIsHidden] = useState(initial?.isHidden ?? true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !expectedOutput.trim()) return;
    onSave({ input, expectedOutput, isHidden });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 bg-brand-bg border-2 border-brand-border rounded-xl p-5 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Input</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            className="w-full rounded-lg border-2 border-brand-border bg-brand-surface px-4 py-3 text-[13px] font-mono font-semibold text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-primary transition-colors resize-y"
            placeholder="Input data..."
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-brand-muted uppercase tracking-widest">Expected Output</label>
          <textarea
            value={expectedOutput}
            onChange={(e) => setExpectedOutput(e.target.value)}
            rows={4}
            className="w-full rounded-lg border-2 border-brand-border bg-brand-surface px-4 py-3 text-[13px] font-mono font-semibold text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-primary transition-colors resize-y"
            placeholder="Expected output..."
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-between pt-2 border-t-2 border-brand-border/50">
        <label className="flex items-center gap-3 cursor-pointer select-none text-sm font-bold text-brand-muted hover:text-brand-text transition-colors mt-2">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isHidden ? 'bg-brand-primary border-brand-primary text-white' : 'border-brand-border bg-brand-surface'}`}>
            {isHidden && <CheckCircle2 className="w-3.5 h-3.5" />}
          </div>
          <input
            type="checkbox"
            checked={isHidden}
            onChange={(e) => setIsHidden(e.target.checked)}
            className="hidden"
          />
          Hidden (not shown to students)
        </label>
        <div className="flex gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="font-bold text-brand-muted hover:text-brand-text">Cancel</Button>
          <Button type="submit" isLoading={isSaving} className="bg-brand-primary text-white hover:bg-blue-600 border-0 font-extrabold shadow-sm">
            Save Test Case
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function TestCaseManager({ problemId }: TestCaseManagerProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTestCases = async () => {
    try {
      const { data } = await api.get(`/problems/${problemId}/testcases`);
      setTestCases(data.data.testCases ?? []);
    } catch {
      setError("Failed to load test cases.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestCases();
  }, [problemId]);

  const handleAdd = async (fields: { input: string; expectedOutput: string; isHidden: boolean }) => {
    setIsSaving(true);
    try {
      await api.post(`/problems/${problemId}/testcases`, fields);
      setShowAddForm(false);
      fetchTestCases();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add test case.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (
    id: string,
    fields: { input: string; expectedOutput: string; isHidden: boolean }
  ) => {
    setIsSaving(true);
    try {
      await api.put(`/testcases/${id}`, fields);
      setEditingId(null);
      fetchTestCases();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update test case.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/testcases/${id}`);
      setDeletingId(null);
      fetchTestCases();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete test case.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-brand-text flex items-center gap-3">
          Test Cases
          <span className="text-xs font-bold uppercase tracking-widest text-brand-muted bg-brand-bg border-2 border-brand-border px-3 py-1 rounded-md">
            {testCases.length} total
          </span>
        </h3>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="gap-2 bg-brand-primary text-white hover:bg-blue-600 border-0 font-extrabold shadow-sm">
            <Plus className="h-4 w-4" />
            Add Test Case
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-600 text-sm font-bold border-2 border-red-500/20 rounded-xl p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <TestCaseForm
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isSaving={isSaving}
        />
      )}

      {/* List */}
      {testCases.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-brand-muted border-2 border-dashed border-brand-border rounded-xl bg-brand-bg/50">
          <div className="w-12 h-12 bg-brand-surface border-2 border-brand-border rounded-xl flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-brand-muted" />
          </div>
          <p className="text-sm font-extrabold uppercase tracking-widest">No test cases yet.</p>
          <p className="text-xs font-semibold text-brand-muted/70 mt-1">Add one to start judging submissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {testCases.map((tc, i) => (
            <div key={tc.id}>
              {editingId === tc.id ? (
                <TestCaseForm
                  initial={tc}
                  onSave={(fields) => handleEdit(tc.id, fields)}
                  onCancel={() => setEditingId(null)}
                  isSaving={isSaving}
                />
              ) : (
                <div className="border-2 border-brand-border rounded-xl bg-brand-bg overflow-hidden shadow-sm hover:border-brand-primary/30 transition-colors">
                  {/* Row header */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    <span className="text-xs font-extrabold text-brand-muted uppercase tracking-widest w-6 shrink-0">#{i + 1}</span>
                    <span className={`px-2 py-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest rounded border shrink-0 ${
                      tc.isHidden 
                        ? 'bg-brand-surface text-brand-muted border-brand-border' 
                        : 'bg-brand-accent/10 text-brand-accent border-brand-accent/20'
                    }`}>
                      {tc.isHidden ? (
                        <><EyeOff className="h-3.5 w-3.5" />Hidden</>
                      ) : (
                        <><Eye className="h-3.5 w-3.5" />Sample</>
                      )}
                    </span>
                    <span className="text-xs font-mono font-semibold text-brand-muted truncate max-w-[200px] sm:max-w-md flex-1">
                      {tc.input.substring(0, 80)}{tc.input.length > 80 ? "…" : ""}
                    </span>
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-brand-muted hover:text-brand-text hover:bg-brand-surface rounded-lg"
                        title={expandedId === tc.id ? "Collapse" : "Expand"}
                        onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
                      >
                        {expandedId === tc.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg"
                        title="Edit"
                        onClick={() => setEditingId(tc.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-brand-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                        title="Delete"
                        onClick={() => setDeletingId(tc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {expandedId === tc.id && (
                    <div className="border-t-2 border-brand-border grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-brand-border bg-brand-surface">
                      <div className="p-4">
                        <p className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-2">Input</p>
                        <pre className="text-[13px] text-brand-text font-mono font-semibold whitespace-pre-wrap break-all bg-brand-bg border-2 border-brand-border p-3 rounded-lg max-h-48 overflow-y-auto">
                          {tc.input}
                        </pre>
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-extrabold text-brand-muted uppercase tracking-widest mb-2">Expected Output</p>
                        <pre className="text-[13px] text-brand-text font-mono font-semibold whitespace-pre-wrap break-all bg-brand-bg border-2 border-brand-border p-3 rounded-lg max-h-48 overflow-y-auto">
                          {tc.expectedOutput}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingId && (
        <ConfirmDialog
          message="Are you sure you want to delete this test case? This cannot be undone and may affect active submissions."
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
