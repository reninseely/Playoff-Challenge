"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { usernameToEmail } from "@/lib/username";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const email = usernameToEmail(cleanUsername);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Log in</h1>

        <div className="space-y-1">
          <label className="text-sm">Username</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="text-sm">
          Need an account?{" "}
          <a className="underline" href="/signup">
            Create one
          </a>
        </p>
      </form>
    </div>
  );
}
