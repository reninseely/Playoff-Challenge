"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Round = {
  id: string | number;
  name: string;
  round_number: number;
  is_current: boolean;
};

type LeaderboardTotalRow = {
  user_id: string;
  username: string;
  total_points: number;
};

type LeaderboardRoundRow = {
  user_id: string;
  username: string;
  round_id: string | number;
  round_number: number;
  round_name: string;
  round_points: number;
};

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [totals, setTotals] = useState<LeaderboardTotalRow[]>([]);
  const [roundRows, setRoundRows] = useState<LeaderboardRoundRow[]>([]);

  useEffect(() => {
    async function load() {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const [{ data: roundsData, error: roundsError }, { data: totalsData, error: totalsError }] =
        await Promise.all([
          supabase
            .from("rounds")
            .select("id, name, round_number, is_current")
            .order("round_number", { ascending: true }),
          supabase.from("leaderboard_totals").select("user_id, username, total_points"),
        ]);

      if (roundsError) {
        setLoading(false);
        setError(roundsError.message);
        return;
      }

      if (totalsError) {
        setLoading(false);
        setError(totalsError.message);
        return;
      }

      const r = (roundsData ?? []) as Round[];
      setRounds(r);

      if (r.length > 0) {
        const current = r.find((x) => x.is_current);
        setSelectedRoundId(String((current ?? r[0]).id));
      }

      setTotals((totalsData ?? []) as LeaderboardTotalRow[]);
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    async function loadRoundPoints() {
      if (!selectedRoundId) return;

      const { data, error } = await supabase
        .from("leaderboard_round_totals")
        .select("user_id, username, round_id, round_number, round_name, round_points")
        .eq("round_id", selectedRoundId);

      if (error) {
        setError(error.message);
        return;
      }

      setRoundRows((data ?? []) as LeaderboardRoundRow[]);
    }

    loadRoundPoints();
  }, [selectedRoundId]);

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)),
    [rounds, selectedRoundId]
  );

  const roundPointsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of roundRows) m.set(r.user_id, Number(r.round_points) || 0);
    return m;
  }, [roundRows]);

  const displayRows = useMemo(() => {
    return totals
      .map((t) => ({
        user_id: t.user_id,
        username: t.username,
        total_points: Number(t.total_points) || 0,
        round_points: roundPointsMap.get(t.user_id) ?? 0,
      }))
      .sort((a, b) => b.total_points - a.total_points || a.username.localeCompare(b.username));
  }, [totals, roundPointsMap]);

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
          <h1 className="text-2xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Leaderboard</h1>
            <p className="text-sm text-gray-600">
              Round Points show points for the selected round. Total is overall.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Round</label>
            <select
              className="border rounded px-3 py-2"
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(e.target.value)}
            >
              {rounds.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>
                  {r.name}
                  {r.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">User</th>
                <th className="text-right p-2">
                  {selectedRound ? `${selectedRound.name} Points` : "Round Points"}
                </th>
                <th className="text-right p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => (
                <tr key={r.user_id} className="border-t">
                  <td className="p-2">
                    <a className="underline" href={`/team/${encodeURIComponent(r.username)}`}>
                      {r.username}
                    </a>
                  </td>
                  <td className="p-2 text-right">{r.round_points.toFixed(1)}</td>
                  <td className="p-2 text-right">{r.total_points.toFixed(1)}</td>
                </tr>
              ))}

              {displayRows.length === 0 && (
                <tr className="border-t">
                  <td className="p-2" colSpan={3}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
