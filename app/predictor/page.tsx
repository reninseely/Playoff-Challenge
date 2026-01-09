"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Round = {
  id: string;
  name: string;
  round_number: number;
  is_current: boolean;
  predictor_locked: boolean;
};

type PredictorGame = {
  id: string;
  round_id: string;
  kickoff_at: string | null;
  away_team: string;
  home_team: string;
  away_score_final: number | null;
  home_score_final: number | null;
  is_final: boolean;
};

type PredictorEntry = {
  id: string;
  game_id: string;
  user_id: string;
  away_score_pred: number;
  home_score_pred: number;
};

type PredictorPointRow = {
  game_id: string;
  user_id: string;
  base_points: number;
  weighted_points: number;
};

type PickState = {
  away: string;
  home: string;
};

const logoSrc = (abbr: string) => `/defenses/${abbr}.png`;

function formatKickoff(ts: string | null) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// --- round persistence helpers ---
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

  // B) most recent predictor_locked (highest round_number)
  const locked = rounds
    .filter((r) => r.predictor_locked)
    .sort((a, b) => (Number(b.round_number) || 0) - (Number(a.round_number) || 0));
  if (locked.length > 0) return String(locked[0].id);

  // fallback: current
  const current = rounds.find((r) => r.is_current);
  if (current) return String(current.id);

  // fallback: first
  return rounds[0] ? String(rounds[0].id) : "";
}

export default function PredictorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [games, setGames] = useState<PredictorGame[]>([]);
  const [picks, setPicks] = useState<Record<string, PickState>>({});
  const [initialPicks, setInitialPicks] = useState<Record<string, PickState>>({});

  const [pointsByGameId, setPointsByGameId] = useState<Record<string, PredictorPointRow>>({});

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)) ?? null,
    [rounds, selectedRoundId]
  );

  const predictorLocked = selectedRound?.predictor_locked ?? false;

  const roundStorageKey = "predictor_round";

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setError(null);
      setStatusMsg(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }
      setUserId(userData.user.id);

      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("id, name, round_number, is_current, predictor_locked")
        .order("round_number", { ascending: true });

      if (roundsError) {
        setLoading(false);
        setError(roundsError.message);
        return;
      }

      const r = (roundsData ?? []) as Round[];
      setRounds(r);

      if (r.length > 0) {
        setSelectedRoundId(pickDefaultRoundId(r, roundStorageKey));
      } else {
        setSelectedRoundId("");
      }

      setLoading(false);
    }

    boot();
  }, []);

  async function loadRoundData(roundId: string) {
    if (!roundId || !userId) return;

    setError(null);
    setStatusMsg(null);

    const { data: gamesData, error: gamesError } = await supabase
      .from("predictor_games")
      .select("id, round_id, kickoff_at, away_team, home_team, away_score_final, home_score_final, is_final")
      .eq("round_id", roundId)
      .order("kickoff_at", { ascending: true });

    if (gamesError) {
      setError(gamesError.message);
      return;
    }

    const g = (gamesData ?? []) as PredictorGame[];
    setGames(g);

    if (g.length === 0) {
      setPicks({});
      setInitialPicks({});
      setPointsByGameId({});
      return;
    }

    const gameIds = g.map((x) => x.id);

    const { data: entriesData, error: entriesError } = await supabase
      .from("predictor_entries")
      .select("id, game_id, user_id, away_score_pred, home_score_pred")
      .eq("user_id", userId)
      .in("game_id", gameIds);

    if (entriesError) {
      setError(entriesError.message);
      return;
    }

    const entries = (entriesData ?? []) as PredictorEntry[];

    const pickMap: Record<string, PickState> = {};
    for (const game of g) {
      const found = entries.find((e) => e.game_id === game.id);
      pickMap[game.id] = {
        away: found ? String(found.away_score_pred) : "",
        home: found ? String(found.home_score_pred) : "",
      };
    }

    setPicks(pickMap);
    setInitialPicks(pickMap);

    const { data: ptsData, error: ptsError } = await supabase
      .from("predictor_points")
      .select("game_id, user_id, base_points, weighted_points")
      .eq("user_id", userId)
      .in("game_id", gameIds);

    if (ptsError) {
      setPointsByGameId({});
      return;
    }

    const pts = (ptsData ?? []) as PredictorPointRow[];
    const m: Record<string, PredictorPointRow> = {};
    for (const p of pts) m[p.game_id] = p;
    setPointsByGameId(m);
  }

  useEffect(() => {
    if (!userId) return;
    if (!selectedRoundId) return;
    loadRoundData(selectedRoundId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedRoundId]);

  const dirtyCount = useMemo(() => {
    let c = 0;
    for (const game of games) {
      const a = picks[game.id];
      const b = initialPicks[game.id];
      if (!a || !b) continue;
      if (a.away !== b.away || a.home !== b.home) c++;
    }
    return c;
  }, [games, picks, initialPicks]);

  const hasAnyInvalid = useMemo(() => {
    for (const game of games) {
      const p = picks[game.id];
      if (!p) continue;

      const awayEmpty = p.away.trim() === "";
      const homeEmpty = p.home.trim() === "";

      if (awayEmpty && homeEmpty) continue;
      if (awayEmpty !== homeEmpty) return true;

      const away = Number(p.away);
      const home = Number(p.home);

      if (!Number.isFinite(away) || !Number.isFinite(home)) return true;
      if (!Number.isInteger(away) || !Number.isInteger(home)) return true;
      if (away < 0 || home < 0) return true;
      if (away > 99 || home > 99) return true;
    }
    return false;
  }, [games, picks]);

  function setPick(gameId: string, side: "away" | "home", val: string) {
    setStatusMsg(null);
    setError(null);

    if (val !== "" && !/^\d{0,2}$/.test(val)) return;

    setPicks((prev) => ({
      ...prev,
      [gameId]: {
        away: side === "away" ? val : prev[gameId]?.away ?? "",
        home: side === "home" ? val : prev[gameId]?.home ?? "",
      },
    }));
  }

  async function saveAll() {
    if (!userId) return;
    if (predictorLocked) return;

    setError(null);
    setStatusMsg(null);

    if (hasAnyInvalid) {
      setError("Please fix invalid picks (both scores required, whole numbers 0–99).");
      return;
    }

    const upserts: {
      game_id: string;
      user_id: string;
      away_score_pred: number;
      home_score_pred: number;
    }[] = [];

    for (const game of games) {
      const p = picks[game.id];
      if (!p) continue;

      const awayEmpty = p.away.trim() === "";
      const homeEmpty = p.home.trim() === "";
      if (awayEmpty && homeEmpty) continue;

      upserts.push({
        game_id: game.id,
        user_id: userId,
        away_score_pred: Number(p.away),
        home_score_pred: Number(p.home),
      });
    }

    setSaving(true);

    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from("predictor_entries")
        .upsert(upserts, { onConflict: "game_id,user_id" });

      if (upsertError) {
        setSaving(false);
        setError(upsertError.message);
        return;
      }
    }

    setInitialPicks(picks);
    setSaving(false);
    setStatusMsg("Saved.");
  }

  if (loading) {
    return (
      <div>
        <NavBar />
        <div className="p-6">Loading...</div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div>
        <NavBar />
        <div className="p-6 max-w-5xl mx-auto space-y-2">
          <h1 className="text-2xl font-semibold">Game Predictor</h1>
          <p className="text-sm text-gray-600">No rounds found.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-4 max-w-6xl mx-auto space-y-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Game Predictor</h1>
            <p className="text-sm text-gray-600">
              Make picks for any round. Results & points appear after the round is locked.
            </p>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
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
                  <option key={r.id} value={r.id}>
                    {r.round_number}. {r.name}
                    {r.is_current ? " (Current)" : ""}
                    {r.predictor_locked ? " (Locked)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={saveAll}
              disabled={predictorLocked || saving || dirtyCount === 0 || hasAnyInvalid}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
              title={
                predictorLocked
                  ? "This round is locked."
                  : hasAnyInvalid
                  ? "Fix invalid picks first."
                  : dirtyCount === 0
                  ? "No changes to save."
                  : "Save predictions"
              }
            >
              {saving ? "Saving..." : "Save Predictions"}
            </button>

            {!predictorLocked && dirtyCount > 0 && <span className="text-xs text-gray-600">{dirtyCount} unsaved</span>}
          </div>
        </div>

        {selectedRound ? (
          <div className="text-sm text-gray-600">
            Viewing: <span className="font-semibold">{selectedRound.name}</span>{" "}
            {predictorLocked ? (
              <span className="ml-2 text-red-700 font-semibold">(Locked)</span>
            ) : (
              <span className="ml-2">(Open)</span>
            )}
          </div>
        ) : null}

        {error && <div className="text-sm text-red-600">{error}</div>}
        {statusMsg && <div className="text-sm text-green-700">{statusMsg}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {games.map((g) => {
            const p = picks[g.id] ?? { away: "", home: "" };

            const awayEmpty = p.away.trim() === "";
            const homeEmpty = p.home.trim() === "";
            const partial = awayEmpty !== homeEmpty;

            const showResults = predictorLocked;

            const finalReady = g.is_final && g.away_score_final != null && g.home_score_final != null;

            const pts = pointsByGameId[g.id];
            const awarded = pts ? Number(pts.weighted_points || 0) : null;

            return (
              <div key={g.id} className="border rounded p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] text-gray-600 leading-tight">{formatKickoff(g.kickoff_at)}</div>

                  {showResults && finalReady ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700">Final</span>
                  ) : null}
                </div>

                <div className="mt-2 grid grid-cols-3 items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={logoSrc(g.away_team)}
                      alt={g.away_team}
                      className="h-16 w-16 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                      }}
                    />
                    <div className="text-xs font-semibold">{g.away_team}</div>

                    <input
                      className="border rounded px-2 py-1 w-12 text-center text-sm"
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="-"
                      value={p.away}
                      disabled={predictorLocked}
                      onChange={(e) => setPick(g.id, "away", e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className="text-xs text-gray-500 font-semibold">@</div>

                    {showResults && finalReady ? (
                      <div className="mt-1 text-[11px] text-gray-700 text-center leading-tight">
                        <div className="text-[10px] text-gray-500">Final</div>
                        <div className="font-semibold text-lg">
                          {g.away_score_final}-{g.home_score_final}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={logoSrc(g.home_team)}
                      alt={g.home_team}
                      className="h-16 w-16 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                      }}
                    />
                    <div className="text-xs font-semibold">{g.home_team}</div>

                    <input
                      className="border rounded px-2 py-1 w-12 text-center text-sm"
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="-"
                      value={p.home}
                      disabled={predictorLocked}
                      onChange={(e) => setPick(g.id, "home", e.target.value)}
                    />
                  </div>
                </div>

                {partial && !predictorLocked && (
                  <div className="mt-2 text-[11px] text-red-600 text-center">Enter both scores (or leave both blank).</div>
                )}

                {showResults ? (
                  <div className="mt-2 text-center">
                    {!finalReady ? (
                      <div className="text-[11px] text-gray-500">Final score not entered yet.</div>
                    ) : awarded == null ? (
                      <div className="text-[11px] text-gray-500">Points not calculated yet (admin needs to Recalculate).</div>
                    ) : (
                      <div className="text-sm">
                        <span className="text-gray-600">Points:</span>{" "}
                        <span className="font-semibold">{Math.round(awarded)}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {games.length === 0 && (
            <div className="border rounded p-4 text-sm text-gray-600 col-span-full">
              No games have been added for this round yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
