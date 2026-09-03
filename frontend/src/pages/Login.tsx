import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Code2, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data.data;
      login(token, user);
      navigate(`/${user.role.toLowerCase()}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 font-sans selection:bg-brand-primary/20">
      
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8 group">
        <div className="bg-brand-primary p-2 rounded-lg group-hover:bg-blue-600 transition-colors shadow-sm">
          <Code2 className="h-7 w-7 text-white" />
        </div>
        <span className="text-2xl font-extrabold text-brand-text tracking-tight">
          ClanOf<span className="text-brand-primary">Codes</span>
        </span>
      </Link>

      {/* Login Card */}
      <div className="w-full max-w-md bg-brand-surface border-2 border-brand-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-extrabold text-brand-text tracking-tight">Welcome back</h1>
            <p className="text-sm font-bold text-brand-muted">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-sm font-bold text-red-600 bg-red-500/10 border-2 border-red-500/20 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        </div>
        
        <div className="bg-brand-bg border-t-2 border-brand-border p-6 text-center">
          <p className="text-sm font-bold text-brand-muted">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-primary hover:underline font-extrabold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
      
    </div>
  );
}
