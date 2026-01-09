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
  total_points: number; // stored decimal in db, but supabase returns number-ish
};

type LeaderboardRoundRow = {
  user_id: string;
  username: string;
  round_id: string | number;
  round_number: number;
  round_name: string;
  round_points: number;
};

type TabKey = "fantasy" | "predictor";

function roundDisplay(n: number) {
  // predictor: store decimals, display rounded whole points
  return Math.round(n).toString();
}

function fantasyDisplay(n: number) {
  // keep your existing 1-decimal formatting for fantasy
  return (Number(n) || 0).toFixed(1);
}

// $0.00 format, negative like -$1.23
function moneyDisplay(netDollars: number) {
  const sign = netDollars >= 0 ? "" : "-";
  const abs = Math.abs(netDollars);
  return `${sign}$${abs.toFixed(2)}`;
}

// --- round persistence helpers (A + B combo) ---
function safeGetLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function pickDefaultRoundId(rounds: Round[], storageKey: string) {
  // A) saved selection wins if valid
  const saved = typeof window !== "undefined" ? safeGetLS(storageKey) : null;
  if (saved && rounds.some((r) => String(r.id) === String(saved))) return String(saved);

  // B) most recent round (highest round_number) — leaderboard doesn't have is_locked here
  const mostRecent = [...rounds].sort(
    (a, b) => (Number(b.round_number) || 0) - (Number(a.round_number) || 0)
  );
  if (mostRecent.length > 0) return String(mostRecent[0].id);

  // fallback: current
  const current = rounds.find((r) => r.is_current);
  if (current) return String(current.id);

  // fallback: first
  return rounds[0] ? String(rounds[0].id) : "";
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<TabKey>("fantasy");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [totals, setTotals] = useState<LeaderboardTotalRow[]>([]);
  const [roundRows, setRoundRows] = useState<LeaderboardRoundRow[]>([]);

  const roundStorageKey = "leaderboard_round";

  // Views per tab
  const views = useMemo(() => {
    if (tab === "predictor") {
      return {
        totalsView: "predictor_leaderboard_totals",
        roundView: "predictor_leaderboard_round_totals",
        fmt: roundDisplay,
        subtitle: "Round Points show Predictor points for the selected round. Total is overall.",
      };
    }
    return {
      totalsView: "leaderboard_totals",
      roundView: "leaderboard_round_totals",
      fmt: fantasyDisplay,
      subtitle: "Round Points show points for the selected round. Total is overall.",
    };
  }, [tab]);

  useEffect(() => {
    async function load() {
      setLoading(true);
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
          supabase.from(views.totalsView).select("user_id, username, total_points"),
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
        // use saved round if present; otherwise most recent
        setSelectedRoundId(pickDefaultRoundId(r, roundStorageKey));
      }

      setTotals((totalsData ?? []) as LeaderboardTotalRow[]);
      setLoading(false);
    }

    load();
    // re-load when tab changes so we use the correct totals view
  }, [views.totalsView]);

  useEffect(() => {
    async function loadRoundPoints() {
      if (!selectedRoundId) return;

      const { data, error } = await supabase
        .from(views.roundView)
        .select("user_id, username, round_id, round_number, round_name, round_points")
        .eq("round_id", selectedRoundId);

      if (error) {
        setError(error.message);
        return;
      }

      setRoundRows((data ?? []) as LeaderboardRoundRow[]);
    }

    loadRoundPoints();
  }, [selectedRoundId, views.roundView]);

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
    const base = totals.map((t) => ({
      user_id: t.user_id,
      username: t.username,
      total_points: Number(t.total_points) || 0,
      round_points: roundPointsMap.get(t.user_id) ?? 0,
    }));

    if (tab !== "predictor") {
      return base.sort(
        (a, b) => b.total_points - a.total_points || a.username.localeCompare(b.username)
      );
    }

    // predictor: net vs average total points (1 point = $0.01)
    const N = base.length || 1;
    const sum = base.reduce((acc, r) => acc + (Number(r.total_points) || 0), 0);
    const avg = sum / N;

    const withNet = base.map((r) => {
      const netPoints = (Number(r.total_points) || 0) - avg;
      const netDollars = netPoints / 100;
      return { ...r, netDollars };
    });

    return withNet.sort(
      (a, b) => b.total_points - a.total_points || a.username.localeCompare(b.username)
    );
  }, [totals, roundPointsMap, tab]);

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
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Leaderboard</h1>
            <p className="text-sm text-gray-600">{views.subtitle}</p>

            <div className="inline-flex border rounded overflow-hidden">
              <button
                className={`px-4 py-2 text-sm ${
                  tab === "fantasy" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
                }`}
                onClick={() => setTab("fantasy")}
              >
                Fantasy
              </button>
              <button
                className={`px-4 py-2 text-sm ${
                  tab === "predictor" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
                }`}
                onClick={() => setTab("predictor")}
              >
                Predictor
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Round</label>
            <select
              className="border rounded px-3 py-2"
              value={selectedRoundId}
              onChange={(e) => {
                setSelectedRoundId(e.target.value);
                safeSetLS(roundStorageKey, e.target.value);
              }}
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
                {tab === "predictor" && <th className="text-right p-2">Net</th>}
                <th className="text-right p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r: any) => {
                const href =
                  tab === "predictor"
                    ? `/predict/${encodeURIComponent(r.username)}`
                    : `/team/${encodeURIComponent(r.username)}`;

                const net = tab === "predictor" ? Number(r.netDollars ?? 0) : 0;

                return (
                  <tr key={r.user_id} className="border-t">
                    <td className="p-2">
                      <a className="underline" href={href}>
                        {r.username}
                      </a>
                    </td>
                    <td className="p-2 text-right">{views.fmt(r.round_points)}</td>

                    {tab === "predictor" && (
                      <td
                        className={`p-2 text-right font-semibold ${
                          net > 0 ? "text-green-700" : net < 0 ? "text-red-600" : "text-gray-600"
                        }`}
                        title="Net vs group average (settles to $0.00 across all users)"
                      >
                        {moneyDisplay(net)}
                      </td>
                    )}

                    <td className="p-2 text-right">{views.fmt(r.total_points)}</td>
                  </tr>
                );
              })}

              {displayRows.length === 0 && (
                <tr className="border-t">
                  <td className="p-2" colSpan={tab === "predictor" ? 4 : 3}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {tab === "predictor" && (
          <p className="text-xs text-gray-500">
            Predictor totals are stored with decimals for exact accounting, but displayed as rounded whole points. Net is
            shown in dollars vs the group average (1 point = $0.01).
          </p>
        )}
      </div>
    </div>
  );
}
