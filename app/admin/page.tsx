"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Profile = {
  id: string;
  username: string;
  is_admin: boolean;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setLoading(false);
        setError(userError.message);
        return;
      }

      const user = userData.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("id, username, is_admin")
        .eq("id", user.id)
        .single();

      setLoading(false);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setProfile(profileData);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div>
        <NavBar />
        <div className="p-6">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <NavBar />
        <div className="p-6 space-y-2">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div>
        <NavBar />
        <div className="p-6 space-y-2">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-red-600">Not authorized.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            Logged in as <span className="font-medium">{profile.username}</span>
          </p>
        </div>

        <div className="grid gap-3">
          <a
            href="/admin/players"
            className="border rounded p-4 hover:bg-gray-50"
          >
            <div className="font-semibold">Player Seeding</div>
            <div className="text-sm text-gray-600">
              Import or paste players into the system.
            </div>
          </a>

          <a
            href="/admin/stats"
            className="border rounded p-4 hover:bg-gray-50"
          >
            <div className="font-semibold">Stats Upload</div>
            <div className="text-sm text-gray-600">
              Paste fantasy-point CSV for a round.
            </div>
          </a>

          <a
            href="/admin/rounds"
            className="border rounded p-4 hover:bg-gray-50"
          >
            <div className="font-semibold">Round Controls</div>
            <div className="text-sm text-gray-600">
              Lock or unlock playoff rounds.
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
