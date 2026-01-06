"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { usernameToEmail } from "@/lib/username";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const email = usernameToEmail(cleanUsername);

    // 1) Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setLoading(false);
      setError("Account created, but no user returned. Try logging in.");
      return;
    }

    // 2) Insert profile row
    const { error: profileError } = await supabase.from("users").insert({
      id: userId,
      username: cleanUsername,
    });

    setLoading(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    // 3) Redirect home
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSignup} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>

        <div className="space-y-1">
          <label className="text-sm">Username</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <p className="text-xs text-gray-500">
            No email needed — just username + password.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <p className="text-sm">
          Already have an account?{" "}
          <a className="underline" href="/login">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}

