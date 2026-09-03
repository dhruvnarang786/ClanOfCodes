import React from "react";
import { useNavigate } from "react-router-dom";
import ProblemForm from "./ProblemForm";

export default function CreateProblem() {
  const navigate = useNavigate();

  return (
    <div className="bg-brand-bg text-brand-text font-sans min-h-[calc(100vh-4rem)] pb-12">
      <div className="container mx-auto max-w-3xl py-12 px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-brand-text tracking-tight">Create New Problem</h1>
          <p className="text-sm font-semibold text-brand-muted mt-2">
            Fill in the details below. You can add test cases and manage submissions after creating the problem.
          </p>
        </div>
        
        <div className="bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm p-6 sm:p-8">
          <ProblemForm
            onSuccess={(problem) => {
              // Navigate to the problem management page to add test cases
              navigate(`/professor/problems/${problem.id}/manage`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
