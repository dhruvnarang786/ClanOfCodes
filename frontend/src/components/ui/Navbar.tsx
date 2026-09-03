import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { LogOut, User as UserIcon, Terminal, Code2, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-brand-border bg-brand-surface/95 backdrop-blur shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter text-brand-text">
            <span className="hidden sm:inline-block">ClanOfCodes</span>
          </Link>
          {user && (
            <div className="flex gap-1 text-sm font-semibold text-brand-muted">
              <Link 
                to={`/${user.role.toLowerCase()}/dashboard`} 
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isActive(`/${user.role.toLowerCase()}/dashboard`) ? "bg-brand-bg text-brand-primary" : "hover:text-brand-text hover:bg-brand-bg"}`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link 
                to="/problems" 
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isActive("/problems") ? "bg-brand-bg text-brand-primary" : "hover:text-brand-text hover:bg-brand-bg"}`}
              >
                <Code2 className="h-4 w-4" />
                Problems
              </Link>
              <Link 
                to="/compiler" 
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isActive("/compiler") ? "bg-brand-bg text-brand-primary" : "hover:text-brand-text hover:bg-brand-bg"}`}
              >
                Compiler
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-brand-text font-medium bg-brand-bg px-3 py-1.5 rounded-full border border-brand-border">
                <UserIcon className="h-4 w-4 text-brand-primary" />
                <span>{user.name}</span>
                <span className="bg-brand-accent/10 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-brand-accent font-bold">
                  {user.role}
                </span>
              </div>
              <button 
                onClick={handleLogout} 
                title="Log out"
                className="p-2 text-brand-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-brand-muted hover:text-brand-text transition-colors">
                Log in
              </Link>
              <Link to="/register" className="text-sm font-semibold bg-brand-primary text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
