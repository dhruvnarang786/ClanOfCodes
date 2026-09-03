import React from "react";
import { DiffEditor } from "@monaco-editor/react";
import { X, ArrowLeftRight } from "lucide-react";

interface CodeDiffViewerProps {
  originalCode: string;
  modifiedCode: string;
  originalTitle: React.ReactNode;
  modifiedTitle: React.ReactNode;
  title: string;
  onClose: () => void;
}

export function CodeDiffViewer({
  originalCode,
  modifiedCode,
  originalTitle,
  modifiedTitle,
  title,
  onClose,
}: CodeDiffViewerProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-brand-bg flex flex-col font-sans selection:bg-brand-primary/20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-brand-surface border-b-2 border-brand-border shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-extrabold text-brand-text flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-brand-primary" />
            {title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bg border-2 border-transparent hover:border-brand-border transition-colors flex items-center gap-2 font-bold text-sm uppercase tracking-widest"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Subheader / Legend */}
      <div className="flex bg-brand-surface border-b-2 border-brand-border shrink-0 text-sm font-bold divide-x-2 divide-brand-border shadow-sm">
        <div className="flex-1 px-6 py-3 flex items-center gap-3 text-brand-muted">
          <span className="uppercase tracking-widest text-[10px] bg-brand-bg px-2 py-1 rounded border-2 border-brand-border">
            Original (Older)
          </span>
          <div className="truncate">{originalTitle}</div>
        </div>
        <div className="flex-1 px-6 py-3 flex items-center gap-3 text-brand-muted">
          <span className="uppercase tracking-widest text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-1 rounded border-2 border-brand-primary/20">
            Modified (Newer)
          </span>
          <div className="truncate">{modifiedTitle}</div>
        </div>
      </div>

      {/* Diff Editor */}
      <div className="flex-1 bg-[#0d1117] relative">
        <DiffEditor
          height="100%"
          language="cpp"
          theme="vs-dark"
          original={originalCode}
          modified={modifiedCode}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            lineHeight: 24,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            renderSideBySide: true,
            ignoreTrimWhitespace: false,
            renderIndicators: true,
          }}
          loading={
            <div className="flex h-full w-full items-center justify-center text-brand-muted font-mono text-sm font-bold">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-primary mr-3" />
              Loading Diff Editor...
            </div>
          }
        />
      </div>
    </div>
  );
}
