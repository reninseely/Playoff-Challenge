"use client";

import { useEffect, useMemo, useState } from "react";
import NavBar from "@/app/components/NavBar";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; username: string; is_admin: boolean };

type Round = {
  id: string;
  name: string;
  round_number: number;
  is_current: boolean;
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

type EditRow = {
  id: string;
  kickoff_at: string; // local datetime input value (yyyy-mm-ddThh:mm)
  away_team: string;
  home_team: string;
  away_score_final: string;
  home_score_final: string;
  is_final: boolean;
};

function toLocalInputValue(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function logoSrc(abbr: string) {
  return `/defenses/${abbr}.png`;
}

function isGameLockedByKickoff(kickoffLocalInputValue: string) {
  // kickoffLocalInputValue is like "2026-01-09T18:00" (local time)
  if (!kickoffLocalInputValue) return false;
  const d = new Date(kickoffLocalInputValue);
  if (isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export default function AdminPredictorPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [games, setGames] = useState<PredictorGame[]>([]);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Re-evaluate "locked" badges over time (so a game flips to locked at kickoff without refresh)
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((x) => x + 1), 30_000); // every 30s
    return () => clearInterval(t);
  }, []);

  async function loadProfileAndRounds() {
    setError(null);
    setStatusMsg(null);

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
      .select("id, name, round_number, is_current")
      .order("round_number", { ascending: true });

    if (roundsError) {
      setLoading(false);
      setError(roundsError.message);
      return;
    }

    const r = (roundsData ?? []) as Round[];
    setRounds(r);

    const current = r.find((x) => x.is_current);
    setSelectedRoundId(String((current ?? r[0])?.id ?? ""));

    setProfile(profileData);
    setLoading(false);
  }

  async function loadGames(roundId: string) {
    if (!roundId) return;
    setError(null);
    setStatusMsg(null);

    const { data, error } = await supabase
      .from("predictor_games")
      .select(
        "id, round_id, kickoff_at, away_team, home_team, away_score_final, home_score_final, is_final"
      )
      .eq("round_id", roundId)
      .order("kickoff_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const g = (data ?? []) as PredictorGame[];
    setGames(g);

    const mapped: EditRow[] = g.map((x) => ({
      id: x.id,
      kickoff_at: toLocalInputValue(x.kickoff_at),
      away_team: x.away_team,
      home_team: x.home_team,
      away_score_final: x.away_score_final == null ? "" : String(x.away_score_final),
      home_score_final: x.home_score_final == null ? "" : String(x.home_score_final),
      is_final: x.is_final,
    }));

    setRows(mapped);
  }

  useEffect(() => {
    loadProfileAndRounds();
  }, []);

  useEffect(() => {
    if (!profile?.is_admin) return;
    if (!selectedRoundId) return;
    loadGames(selectedRoundId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoundId, profile?.is_admin]);

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)),
    [rounds, selectedRoundId]
  );

  function updateRow(id: string, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addNewRow() {
    if (!selectedRoundId) {
      setError("Select a round first.");
      return;
    }

    const tempId = `new_${Math.random().toString(16).slice(2)}`;
    setRows((prev) => [
      ...prev,
      {
        id: tempId,
        kickoff_at: "",
        away_team: "",
        home_team: "",
        away_score_final: "",
        home_score_final: "",
        is_final: false,
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function isNewId(id: string) {
    return id.startsWith("new_");
  }

  function validateRow(r: EditRow): string | null {
    if (!r.away_team.trim() || !r.home_team.trim()) return "Away/Home team are required.";
    if (r.away_team.trim().length > 10 || r.home_team.trim().length > 10)
      return "Team abbreviations look too long.";

    // If kickoff is blank, still allow saving (you might want to set later),
    // but warning could be useful.
    // if (!r.kickoff_at) return "Kickoff time is required.";

    if (r.is_final) {
      if (r.away_score_final.trim() === "" || r.home_score_final.trim() === "")
        return "Final scores required if marked Final.";
      const a = Number(r.away_score_final);
      const h = Number(r.home_score_final);
      if (!Number.isInteger(a) || !Number.isInteger(h) || a < 0 || h < 0 || a > 99 || h > 99)
        return "Final scores must be whole numbers 0–99.";
    }
    return null;
  }

  async function saveAll() {
    if (!selectedRoundId) {
      setError("Select a round before saving.");
      return;
    }

    setError(null);
    setStatusMsg(null);

    for (const r of rows) {
      const msg = validateRow(r);
      if (msg) {
        setError(`Row ${r.away_team || "?"} @ ${r.home_team || "?"}: ${msg}`);
        return;
      }
    }

    setSaving(true);

    // INSERTS: always include round_id
    const inserts = rows
      .filter((r) => isNewId(r.id))
      .map((r) => ({
        round_id: selectedRoundId,
        kickoff_at: fromLocalInputValue(r.kickoff_at),
        away_team: r.away_team.trim().toUpperCase(),
        home_team: r.home_team.trim().toUpperCase(),
        away_score_final: r.away_score_final.trim() === "" ? null : Number(r.away_score_final),
        home_score_final: r.home_score_final.trim() === "" ? null : Number(r.home_score_final),
        is_final: r.is_final,
      }));

    // UPDATES: include round_id to avoid NULL constraint edge-cases
    const updates = rows
      .filter((r) => !isNewId(r.id))
      .map((r) => ({
        id: r.id,
        round_id: selectedRoundId,
        kickoff_at: fromLocalInputValue(r.kickoff_at),
        away_team: r.away_team.trim().toUpperCase(),
        home_team: r.home_team.trim().toUpperCase(),
        away_score_final: r.away_score_final.trim() === "" ? null : Number(r.away_score_final),
        home_score_final: r.home_score_final.trim() === "" ? null : Number(r.home_score_final),
        is_final: r.is_final,
      }));

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from("predictor_games").insert(inserts);
      if (insErr) {
        setSaving(false);
        setError(insErr.message);
        return;
      }
    }

    if (updates.length > 0) {
      const { error: updErr } = await supabase.from("predictor_games").upsert(updates);
      if (updErr) {
        setSaving(false);
        setError(updErr.message);
        return;
      }
    }

    setSaving(false);
    setStatusMsg("Saved.");
    await loadGames(selectedRoundId);
  }

  async function recalcPointsForRound() {
    if (!selectedRoundId) {
      setError("Select a round before recalculating.");
      return;
    }

    setError(null);
    setStatusMsg(null);
    setRecalculating(true);

    const { error } = await supabase.rpc("recalc_predictor_points_for_round", {
      p_round_id: selectedRoundId,
    });

    setRecalculating(false);

    if (error) {
      setError(error.message);
      return;
    }

    setStatusMsg("Recalculated predictor points for finalized games in this round.");
  }

  async function deleteGame(gameId: string) {
    setError(null);
    setStatusMsg(null);

    const row = rows.find((x) => x.id === gameId);
    const locked = row ? isGameLockedByKickoff(row.kickoff_at) : false;

    if (isNewId(gameId)) {
      removeRow(gameId);
      return;
    }

    if (locked) {
      setError("This game is locked (kickoff has passed). Deleting it is disabled for safety.");
      return;
    }

    if (!confirm("Delete this game? This will also delete all entries for it.")) return;

    const { error } = await supabase.from("predictor_games").delete().eq("id", gameId);
    if (error) {
      setError(error.message);
      return;
    }

    setStatusMsg("Deleted.");
    await loadGames(selectedRoundId);
  }

  if (loading) {
    return (
      <div>
        <NavBar />
        <div className="p-6">Loading...</div>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div>
        <NavBar />
        <div className="p-6 space-y-2 max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold">Predictor Admin</h1>
          <p className="text-sm text-red-600">Not authorized.</p>
          <a className="underline" href="/admin">
            Back to Admin
          </a>
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
            <h1 className="text-2xl font-semibold">Predictor Admin</h1>
            <p className="text-sm text-gray-600">
              Add matchups, manage kickoff times, and enter final scores. Games lock automatically at kickoff.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addNewRow}
              disabled={!selectedRoundId || saving || recalculating}
              className="border rounded px-3 py-2 disabled:opacity-50"
              title="Add a new game row"
            >
              + Add Game
            </button>

            <button
              onClick={recalcPointsForRound}
              disabled={!selectedRoundId || saving || recalculating}
              className="border rounded px-3 py-2 disabled:opacity-50"
              title="Calculates predictor points for all finalized games in this round."
            >
              {recalculating ? "Recalculating..." : "Recalculate Points"}
            </button>

            <button
              onClick={saveAll}
              disabled={!selectedRoundId || saving || recalculating}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {statusMsg && <div className="text-sm text-green-700">{statusMsg}</div>}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-gray-600">Round</label>
            <select
              className="border rounded px-3 py-2"
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(e.target.value)}
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.round_number}. {r.name}
                  {r.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600">
            {selectedRound ? (
              <>
                Editing: <span className="font-semibold">{selectedRound.name}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Locked</th>
                <th className="text-left p-2">Kickoff</th>
                <th className="text-left p-2">Away</th>
                <th className="text-left p-2">Home</th>
                <th className="text-left p-2">Final</th>
                <th className="text-left p-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                // uses nowTick so it updates without refresh
                void nowTick;
                const locked = isGameLockedByKickoff(r.kickoff_at);

                // When locked: prevent changing kickoff/teams.
                // Still allow final score entry & is_final toggle.
                const disableStructureEdits = locked && !isNewId(r.id);

                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2">
                      {locked ? (
                        <span className="text-xs font-semibold text-red-700">Locked</span>
                      ) : (
                        <span className="text-xs text-gray-500">Open</span>
                      )}
                    </td>

                    <td className="p-2">
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1"
                        value={r.kickoff_at}
                        onChange={(e) => updateRow(r.id, { kickoff_at: e.target.value })}
                        disabled={disableStructureEdits}
                        title={
                          disableStructureEdits
                            ? "Kickoff has passed. Editing kickoff time is disabled."
                            : ""
                        }
                      />
                    </td>

                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={r.away_team ? logoSrc(r.away_team.trim().toUpperCase()) : ""}
                          alt=""
                          className="h-8 w-8 object-contain"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.2")}
                        />
                        <input
                          className="border rounded px-2 py-1 w-24"
                          placeholder="BUF"
                          value={r.away_team}
                          onChange={(e) => updateRow(r.id, { away_team: e.target.value })}
                          disabled={disableStructureEdits}
                          title={
                            disableStructureEdits
                              ? "Game is locked. Editing teams is disabled."
                              : ""
                          }
                        />
                      </div>
                    </td>

                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={r.home_team ? logoSrc(r.home_team.trim().toUpperCase()) : ""}
                          alt=""
                          className="h-8 w-8 object-contain"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.2")}
                        />
                        <input
                          className="border rounded px-2 py-1 w-24"
                          placeholder="JAX"
                          value={r.home_team}
                          onChange={(e) => updateRow(r.id, { home_team: e.target.value })}
                          disabled={disableStructureEdits}
                          title={
                            disableStructureEdits
                              ? "Game is locked. Editing teams is disabled."
                              : ""
                          }
                        />
                      </div>
                    </td>

                    <td className="p-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs text-gray-600 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={r.is_final}
                            onChange={(e) => updateRow(r.id, { is_final: e.target.checked })}
                          />
                          Final
                        </label>

                        <input
                          className="border rounded px-2 py-1 w-20"
                          placeholder="Away"
                          value={r.away_score_final}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v !== "" && !/^\d{0,2}$/.test(v)) return;
                            updateRow(r.id, { away_score_final: v });
                          }}
                          disabled={!r.is_final}
                        />
                        <input
                          className="border rounded px-2 py-1 w-20"
                          placeholder="Home"
                          value={r.home_score_final}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v !== "" && !/^\d{0,2}$/.test(v)) return;
                            updateRow(r.id, { home_score_final: v });
                          }}
                          disabled={!r.is_final}
                        />
                      </div>

                      {r.is_final && (r.away_score_final === "" || r.home_score_final === "") && (
                        <div className="text-xs text-red-600 mt-1">Enter both final scores.</div>
                      )}
                    </td>

                    <td className="p-2">
                      <button
                        className="border rounded px-3 py-1 disabled:opacity-50"
                        onClick={() => deleteGame(r.id)}
                        disabled={!isNewId(r.id) && locked}
                        title={
                          !isNewId(r.id) && locked
                            ? "Locked game can't be deleted."
                            : "Delete game"
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr className="border-t">
                  <td className="p-4 text-sm text-gray-600" colSpan={6}>
                    No games yet. Click “Add Game”.
                  </td>
                </tr>
              )}
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
