"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import NavBar from "@/app/components/NavBar";
import { supabase } from "@/lib/supabase";

type Round = {
  id: string;
  name: string;
  round_number: number;
  is_current: boolean;
  predictor_locked: boolean;
};

type UserRow = {
  id: string;
  username: string;
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
  game_id: string;
  user_id: string;
  away_score_pred: number;
  home_score_pred: number;
};

type PredictorPointRow = {
  game_id: string;
  user_id: string;
  weighted_points: number;
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

export default function PredictionsByUserPage() {
  const params = useParams();
  const usernameParam = decodeURIComponent(String(params?.username ?? ""));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [targetUser, setTargetUser] = useState<UserRow | null>(null);
  const [games, setGames] = useState<PredictorGame[]>([]);
  const [entryByGame, setEntryByGame] = useState<Record<string, PredictorEntry>>({});
  const [pointsByGame, setPointsByGame] = useState<Record<string, PredictorPointRow>>({});

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)) ?? null,
    [rounds, selectedRoundId]
  );

  const locked = selectedRound?.predictor_locked ?? false;

  // storage key per viewed username (so viewing different users doesn't overwrite)
  const roundStorageKey = useMemo(
    () => `predict_round_${encodeURIComponent(String(usernameParam).trim().toLowerCase())}`,
    [usernameParam]
  );

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const [{ data: roundsData, error: roundsError }, { data: userRow, error: userError }] =
        await Promise.all([
          supabase
            .from("rounds")
            .select("id, name, round_number, is_current, predictor_locked")
            .order("round_number", { ascending: true }),
          supabase.from("users").select("id, username").eq("username", usernameParam).maybeSingle(),
        ]);

      if (roundsError) {
        setLoading(false);
        setError(roundsError.message);
        return;
      }
      if (userError) {
        setLoading(false);
        setError(userError.message);
        return;
      }
      if (!userRow) {
        setLoading(false);
        setError("User not found.");
        return;
      }

      const r = (roundsData ?? []) as Round[];
      setRounds(r);

      if (r.length > 0) {
        setSelectedRoundId(pickDefaultRoundId(r, roundStorageKey));
      } else {
        setSelectedRoundId("");
      }

      setTargetUser(userRow as UserRow);
      setLoading(false);
    }

    boot();
  }, [usernameParam, roundStorageKey]);

  useEffect(() => {
    async function loadRound() {
      if (!targetUser?.id) return;
      if (!selectedRoundId) return;

      setError(null);

      const { data: gamesData, error: gamesError } = await supabase
        .from("predictor_games")
        .select("id, round_id, kickoff_at, away_team, home_team, away_score_final, home_score_final, is_final")
        .eq("round_id", selectedRoundId)
        .order("kickoff_at", { ascending: true });

      if (gamesError) {
        setError(gamesError.message);
        return;
      }

      const g = (gamesData ?? []) as PredictorGame[];
      setGames(g);

      if (g.length === 0) {
        setEntryByGame({});
        setPointsByGame({});
        return;
      }

      const gameIds = g.map((x) => x.id);

      const { data: entriesData, error: entriesError } = await supabase
        .from("predictor_entries")
        .select("game_id, user_id, away_score_pred, home_score_pred")
        .eq("user_id", targetUser.id)
        .in("game_id", gameIds);

      if (entriesError) {
        setError(entriesError.message);
        return;
      }

      const entries = (entriesData ?? []) as PredictorEntry[];
      const em: Record<string, PredictorEntry> = {};
      for (const e of entries) em[e.game_id] = e;
      setEntryByGame(em);

      const { data: ptsData, error: ptsError } = await supabase
        .from("predictor_points")
        .select("game_id, user_id, weighted_points")
        .eq("user_id", targetUser.id)
        .in("game_id", gameIds);

      if (ptsError) {
        setPointsByGame({});
        return;
      }

      const pts = (ptsData ?? []) as PredictorPointRow[];
      const pm: Record<string, PredictorPointRow> = {};
      for (const p of pts) pm[p.game_id] = p;
      setPointsByGame(pm);
    }

    loadRound();
  }, [selectedRoundId, targetUser?.id]);

  const roundTotal = useMemo(() => {
    if (!locked) return null;
    let sum = 0;
    for (const g of games) sum += Number(pointsByGame[g.id]?.weighted_points ?? 0);
    return sum;
  }, [games, pointsByGame, locked]);

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
        <div className="p-6 space-y-2 max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold">Predictions</h1>
          <p className="text-sm text-red-600">{error}</p>
          <a className="underline" href="/leaderboard">
            Back to Leaderboard
          </a>
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
            <h1 className="text-2xl font-semibold">{targetUser?.username} — Predictions</h1>
            <p className="text-sm text-gray-600">Predictions + results are visible after a round is locked.</p>
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
                <option key={r.id} value={r.id}>
                  {r.round_number}. {r.name}
                  {r.is_current ? " (Current)" : ""}
                  {r.predictor_locked ? " (Locked)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedRound ? (
          <div className="text-sm text-gray-600">
            Viewing: <span className="font-semibold">{selectedRound.name}</span>{" "}
            {locked ? (
              <span className="ml-2 text-red-700 font-semibold">(Locked)</span>
            ) : (
              <span className="ml-2">(Not locked yet)</span>
            )}
            {locked && roundTotal != null ? (
              <span className="ml-4">
                Round Total: <span className="font-semibold">{Math.round(roundTotal)}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {!locked ? (
          <div className="border rounded p-4 text-sm text-gray-600">
            This round isn’t locked yet — predictions are hidden until the admin locks the round.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {games.map((g) => {
              const entry = entryByGame[g.id];
              const pts = pointsByGame[g.id];
              const finalReady = g.is_final && g.away_score_final != null && g.home_score_final != null;

              return (
                <div key={g.id} className="border rounded p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-gray-600 leading-tight">{formatKickoff(g.kickoff_at)}</div>
                    {finalReady ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700">Final</span>
                    ) : null}
                  </div>

                  <div className="mt-2 grid grid-cols-3 items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={logoSrc(g.away_team)}
                        alt={g.away_team}
                        className="h-16 w-16 object-contain"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.2")}
                      />
                      <div className="text-xs font-semibold">{g.away_team}</div>
                      <div className="border rounded px-2 py-1 w-12 text-center text-sm bg-white">
                        {entry ? entry.away_score_pred : "-"}
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                      <div className="text-xs text-gray-500 font-semibold">@</div>
                      {finalReady ? (
                        <div className="mt-1 text-center leading-tight">
                          <div className="text-[10px] text-gray-500">Final</div>
                          <div className="font-semibold text-base">
                            {g.away_score_final}-{g.home_score_final}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-gray-500 text-center">Final not entered</div>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={logoSrc(g.home_team)}
                        alt={g.home_team}
                        className="h-16 w-16 object-contain"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.2")}
                      />
                      <div className="text-xs font-semibold">{g.home_team}</div>
                      <div className="border rounded px-2 py-1 w-12 text-center text-sm bg-white">
                        {entry ? entry.home_score_pred : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-center">
                    {!finalReady ? (
                      <div className="text-[11px] text-gray-500">Points pending.</div>
                    ) : !pts ? (
                      <div className="text-[11px] text-gray-500">
                        Points not calculated yet (admin needs to Recalculate).
                      </div>
                    ) : (
                      <div className="text-sm">
                        <span className="text-gray-600">Points:</span>{" "}
                        <span className="font-semibold">{Math.round(Number(pts.weighted_points))}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {games.length === 0 && (
              <div className="border rounded p-4 text-sm text-gray-600 col-span-full">No games for this round.</div>
            )}
          </div>
        )}

        <a className="underline" href="/leaderboard">
          Back to Leaderboard
        </a>
      </div>
    </div>
  );
}
