// src/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while we verify saved token on mount

  // On mount — check if there's a saved token and verify it's still valid
  useEffect(() => {
    const token = localStorage.getItem("rc_token");
    if (!token) { setLoading(false); return; }

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) setUser(data.user);
        else            localStorage.removeItem("rc_token"); // expired / invalid
      })
      .catch(() => localStorage.removeItem("rc_token"))
      .finally(() => setLoading(false));
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const register = async (name, email, password) => {
    const res  = await fetch(`${API}/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    localStorage.setItem("rc_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const res  = await fetch(`${API}/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    localStorage.setItem("rc_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("rc_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}