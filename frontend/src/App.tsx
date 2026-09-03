import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/ui/Navbar";

import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import ProblemsList from "./pages/ProblemsList";
import ProblemDetails from "./pages/ProblemDetails";
import Compiler from "./pages/Compiler";
import CreateProblem from "./pages/professor/CreateProblem";
import ManageProblem from "./pages/professor/ManageProblem";
import SubmissionsList from "./pages/SubmissionsList";
import SubmissionDetails from "./pages/SubmissionDetails";


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background text-text flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected General Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/problems" element={<ProblemsList />} />
                <Route path="/problems/:slug" element={<ProblemDetails />} />
                <Route path="/compiler" element={<Compiler />} />
                <Route path="/submissions" element={<SubmissionsList />} />
                <Route path="/submissions/:id" element={<SubmissionDetails />} />
              </Route>

              {/* Student Only Routes */}
              <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
              </Route>

              {/* Professor Only Routes */}
              <Route element={<ProtectedRoute allowedRoles={["PROFESSOR"]} />}>
                <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
                <Route path="/professor/problems/create" element={<CreateProblem />} />
                <Route path="/professor/problems/:problemId/manage" element={<ManageProblem />} />
              </Route>

              {/* Root Redirect */}
              <Route path="/" element={<Navigate to="/problems" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
