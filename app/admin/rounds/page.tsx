"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Profile = { id: string; username: string; is_admin: boolean };
type Round = {
  id: string | number;
  name: string;
  round_number: number;
  is_locked: boolean;
  is_current: boolean;
};

export default function AdminRoundsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function load() {
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("users")
      .select("id, username, is_admin")
      .eq("id", userData.user.id)
      .single();

    if (profileError) {
      setLoading(false);
      setError(profileError.message);
      return;
    }

    if (!profileData?.is_admin) {
      setLoading(false);
      setProfile(profileData);
      return;
    }

    const { data: roundsData, error: roundsError } = await supabase
      .from("rounds")
      .select("id, name, round_number, is_locked, is_current")
      .order("round_number", { ascending: true });

    setLoading(false);

    if (roundsError) {
      setError(roundsError.message);
      return;
    }

    setProfile(profileData);
    setRounds((roundsData ?? []) as Round[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleLock(round: Round) {
    setError(null);
    setStatusMsg(null);
    setSavingId(round.id);

    const { error } = await supabase
      .from("rounds")
      .update({ is_locked: !round.is_locked })
      .eq("id", round.id);

    setSavingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    await load();
  }

  async function advanceRound() {
    setError(null);
    setStatusMsg(null);
    setAdvancing(true);

    const { error } = await supabase.rpc("advance_current_round");

    setAdvancing(false);

    if (error) {
      // Make Postgres exceptions more readable
      const msg =
        error.message?.includes("No next round exists")
          ? "Already at the final round — no next round to advance to."
          : error.message?.includes("No current round is set")
          ? "No current round is set. Mark one round as current first."
          : error.message?.includes("Not authorized")
          ? "Not authorized."
          : error.message;

      setError(msg);
      return;
    }

    setStatusMsg("Advanced to the next round.");
    await load();
  }

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
        <div className="p-6 space-y-2 max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold">Round Controls</h1>
          <p className="text-sm text-red-600">{error}</p>
          <a className="underline" href="/admin">
            Back to Admin
          </a>
        </div>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div>
        <NavBar />
        <div className="p-6 space-y-2 max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold">Round Controls</h1>
          <p className="text-sm text-red-600">Not authorized.</p>
          <a className="underline" href="/admin">
            Back to Admin
          </a>
        </div>
      </div>
    );
  }

  const current = rounds.find((r) => r.is_current);

  return (
    <div>
      <NavBar />

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Round Controls</h1>
            <p className="text-sm text-gray-600">
              Lock/unlock rounds and advance the current round.
            </p>
            <p className="text-sm text-gray-600">
              Current round:{" "}
              <span className="font-semibold">
                {current ? `${current.round_number}. ${current.name}` : "None set"}
              </span>
            </p>
          </div>

          <button
            onClick={advanceRound}
            disabled={advancing}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            title="Locks the current round and sets the next round as current."
          >
            {advancing ? "Advancing..." : "Advance to Next Round"}
          </button>
        </div>

        {statusMsg && <div className="text-sm">{statusMsg}</div>}

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Round</th>
                <th className="text-left p-2">Current</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={String(r.id)} className="border-t">
                  <td className="p-2">
                    {r.round_number}. {r.name}
                  </td>
                  <td className="p-2">{r.is_current ? "✅" : ""}</td>
                  <td className="p-2">{r.is_locked ? "Locked" : "Open"}</td>
                  <td className="p-2">
                    <button
                      onClick={() => toggleLock(r)}
                      disabled={savingId === r.id}
                      className="border rounded px-3 py-1 disabled:opacity-50"
                    >
                      {savingId === r.id ? "Saving..." : r.is_locked ? "Unlock" : "Lock"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <a className="underline" href="/admin">
          Back to Admin
        </a>
      </div>
    </div>
  );
}
