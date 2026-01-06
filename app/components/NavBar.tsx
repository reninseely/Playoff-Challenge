"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; username: string; is_admin?: boolean };

export default function NavBar() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("id, username, is_admin")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data as Profile);
    }

    load();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="border-b">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/my-team" className="font-semibold">
            Playoff Challenge
          </a>
          <a href="/my-team" className="text-sm underline">
            My Team
          </a>
          <a href="/leaderboard" className="text-sm underline">
            Leaderboard
          </a>
          <a href="/rules" className="text-sm underline">
            Rules
          </a>
          {profile?.is_admin ? (
            <a href="/admin" className="text-sm underline">
              Admin
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          {profile?.username ? (
            <span className="text-sm text-gray-600">{profile.username}</span>
          ) : null}
          <button onClick={logout} className="text-sm underline">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
