import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Code2, ArrowRight, User, GraduationCap } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "PROFESSOR">("STUDENT");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await api.post("/auth/register", { name, email, password, role });
      const { token, user } = response.data.data;
      login(token, user);
      navigate(`/${user.role.toLowerCase()}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 py-12 font-sans selection:bg-brand-primary/20">
      
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8 group">
        <div className="bg-brand-primary p-2 rounded-lg group-hover:bg-blue-600 transition-colors shadow-sm">
          <Code2 className="h-7 w-7 text-white" />
        </div>
        <span className="text-2xl font-extrabold text-brand-text tracking-tight">
          ClanOf<span className="text-brand-primary">Codes</span>
        </span>
      </Link>

      {/* Register Card */}
      <div className="w-full max-w-md bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-extrabold text-brand-text tracking-tight">Create an account</h1>
            <p className="text-sm font-bold text-brand-muted">Join ClanOfCodes to start solving or creating problems</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-sm font-bold text-red-600 bg-red-500/10 border-2 border-red-500/20 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-3">
              <label className="text-xs font-extrabold uppercase tracking-widest text-brand-muted">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                <label 
                  className={`flex flex-col items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    role === "STUDENT" 
                      ? "border-brand-primary bg-brand-primary/5 text-brand-primary" 
                      : "border-brand-border bg-brand-bg text-brand-muted hover:border-brand-primary/50 hover:bg-brand-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="STUDENT"
                    checked={role === "STUDENT"}
                    onChange={() => setRole("STUDENT")}
                    className="sr-only"
                  />
                  <User className={`w-5 h-5 ${role === "STUDENT" ? "text-brand-primary" : "text-brand-muted"}`} />
                  <span className="text-xs font-extrabold uppercase tracking-widest">Student</span>
                </label>
                <label 
                  className={`flex flex-col items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    role === "PROFESSOR" 
                      ? "border-brand-primary bg-brand-primary/5 text-brand-primary" 
                      : "border-brand-border bg-brand-bg text-brand-muted hover:border-brand-primary/50 hover:bg-brand-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="PROFESSOR"
                    checked={role === "PROFESSOR"}
                    onChange={() => setRole("PROFESSOR")}
                    className="sr-only"
                  />
                  <GraduationCap className={`w-5 h-5 ${role === "PROFESSOR" ? "text-brand-primary" : "text-brand-muted"}`} />
                  <span className="text-xs font-extrabold uppercase tracking-widest">Professor</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-brand-muted">Full Name</label>
              <Input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 h-auto focus-visible:ring-0 focus-visible:border-brand-primary transition-colors placeholder:text-brand-muted/50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-brand-muted">Email</label>
              <Input
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 h-auto focus-visible:ring-0 focus-visible:border-brand-primary transition-colors placeholder:text-brand-muted/50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-widest text-brand-muted">Password</label>
              <Input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-brand-bg border-2 border-brand-border text-brand-text font-semibold rounded-lg px-4 py-2.5 h-auto focus-visible:ring-0 focus-visible:border-brand-primary transition-colors placeholder:text-brand-muted/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-brand-primary text-white hover:bg-blue-600 font-extrabold text-sm h-11 transition-all shadow-sm flex items-center justify-center gap-2 mt-2" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        </div>
        
        <div className="bg-brand-bg border-t-2 border-brand-border p-6 text-center">
          <p className="text-sm font-bold text-brand-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-primary hover:underline font-extrabold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      
    </div>
  );
}
