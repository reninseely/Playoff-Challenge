"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Round = { id: string | number; name: string; round_number: number; is_locked: boolean, is_current: boolean};
type Player = { id: string | number; name: string; team: string; position: string; espn_id: string | null; };

type SlotKey =
  | "QB"
  | "RB1"
  | "RB2"
  | "WR1"
  | "WR2"
  | "TE"
  | "FLEX"
  | "K"
  | "DEF";

const SLOTS: { key: SlotKey; label: string; allowed: string[] }[] = [
  { key: "QB", label: "QB", allowed: ["QB"] },
  { key: "RB1", label: "RB", allowed: ["RB"] },
  { key: "RB2", label: "RB", allowed: ["RB"] },
  { key: "WR1", label: "WR", allowed: ["WR"] },
  { key: "WR2", label: "WR", allowed: ["WR"] },
  { key: "TE", label: "TE", allowed: ["TE"] },
  { key: "FLEX", label: "FLEX", allowed: ["RB", "WR", "TE"] },
  { key: "K", label: "K", allowed: ["K"] },
  { key: "DEF", label: "DEF", allowed: ["DEF"] },
];

function emptyLineup(): Record<SlotKey, string> {
  const obj: any = {};
  for (const s of SLOTS) obj[s.key] = "";
  return obj;
}

type ScoreRow = {
  slot: SlotKey;
  base_points: number;
  multiplied_points: number;
};

export default function MyTeamPage() {
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersById, setPlayersById] = useState<Map<string, Player>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [rosterId, setRosterId] = useState<string | number | null>(null);
  const [lineup, setLineup] = useState<Record<SlotKey, string>>(emptyLineup);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [roundLoading, setRoundLoading] = useState(false);

  const [scoresBySlot, setScoresBySlot] = useState<Map<string, ScoreRow>>(new Map());

  useEffect(() => {
    async function loadInitial() {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setUserId(userData.user.id);

      const [{ data: roundsData, error: roundsError }, { data: playersData, error: playersError }] =
        await Promise.all([
          supabase
            .from("rounds")
            .select("id, name, round_number, is_locked, is_current")
            .order("round_number", { ascending: true }),
          supabase
            .from("players")
            .select("id, name, team, position")
            .order("name", { ascending: true }),
        ]);

      setLoading(false);

      if (roundsError) return setError(roundsError.message);
      if (playersError) return setError(playersError.message);

      const r = (roundsData ?? []) as Round[];
      const p = (playersData ?? []) as Player[];

      setRounds(r);
      setPlayers(p);

      const map = new Map<string, Player>();
      for (const pl of p) map.set(String(pl.id), pl);
      setPlayersById(map);

      const current = r.find((x) => x.is_current);
      setSelectedRoundId(String((current ?? r[0]).id));

    }

    loadInitial();
  }, []);

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)),
    [rounds, selectedRoundId]
  );
  const isLocked = selectedRound?.is_locked ?? false;

  // Load roster + roster_players whenever userId + selectedRoundId changes
  useEffect(() => {
    async function loadRosterForRound() {
      if (!userId || !selectedRoundId) return;

      setStatusMsg(null);
      setError(null);
      setRoundLoading(true);

      setScoresBySlot(new Map());

      const { data: existingRoster, error: rosterFetchError } = await supabase
        .from("rosters")
        .select("id")
        .eq("user_id", userId)
        .eq("round_id", selectedRoundId)
        .maybeSingle();

      if (rosterFetchError) {
        setRoundLoading(false);
        setError(rosterFetchError.message);
        return;
      }

      let rId = existingRoster?.id;

      if (!rId) {
        const { data: newRoster, error: rosterInsertError } = await supabase
          .from("rosters")
          .insert({ user_id: userId, round_id: selectedRoundId, locked: false })
          .select("id")
          .single();

        if (rosterInsertError) {
          setRoundLoading(false);
          setError(rosterInsertError.message);
          return;
        }

        rId = newRoster.id;
      }

      setRosterId(rId);

      const { data: rosterPlayers, error: rpError } = await supabase
        .from("roster_players")
        .select("slot, player_id")
        .eq("roster_id", rId);

      if (rpError) {
        setRoundLoading(false);
        setError(rpError.message);
        return;
      }

      const next = emptyLineup();
      for (const row of rosterPlayers ?? []) {
        const slot = row.slot as SlotKey;
        next[slot] = row.player_id ? String(row.player_id) : "";
      }
      setLineup(next);

      // If locked, also load base + total points by slot
      if (isLocked) {
        const { data: scoreRows, error: scoreError } = await supabase
          .from("roster_spot_scores")
          .select("slot, base_points, multiplied_points")
          .eq("user_id", userId)
          .eq("round_id", selectedRoundId);

        if (scoreError) {
          setRoundLoading(false);
          setError(scoreError.message);
          return;
        }

        const smap = new Map<string, ScoreRow>();
        for (const s of (scoreRows ?? []) as ScoreRow[]) smap.set(String(s.slot), s);
        setScoresBySlot(smap);
      }

      setRoundLoading(false);
    }

    loadRosterForRound();
  }, [userId, selectedRoundId, isLocked]);

  const selectedIds = useMemo(() => new Set(Object.values(lineup).filter(Boolean)), [lineup]);

  function setSlot(slot: SlotKey, playerId: string) {
    setStatusMsg(null);
    setLineup((prev) => ({ ...prev, [slot]: playerId }));
  }

  function optionsForSlot(slot: SlotKey) {
    const allowedPositions = SLOTS.find((s) => s.key === slot)!.allowed;

    return players
      .filter((p) => allowedPositions.includes(p.position))
      .filter((p) => {
        const current = lineup[slot];
        if (current && String(p.id) === String(current)) return true;
        return !selectedIds.has(String(p.id));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function saveLineup() {
    setError(null);
    setStatusMsg(null);

    if (isLocked) {
      setError("This round is locked. You can’t save changes.");
      return;
    }
    if (!rosterId) {
      setError("Roster not ready yet. Try again.");
      return;
    }

    setSaving(true);

    const rows = SLOTS.map((s) => ({
      roster_id: rosterId,
      slot: s.key,
      player_id: lineup[s.key] === "" ? null : lineup[s.key],
    }));

    const { error } = await supabase.from("roster_players").upsert(rows, { onConflict: "roster_id,slot" });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setStatusMsg("Saved!");
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
        <div className="p-6 space-y-2">
          <h1 className="text-2xl font-semibold">My Team</h1>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">My Team</h1>
            <div className="text-sm text-gray-600">
              Status:{" "}
              <span className={isLocked ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
                {isLocked ? "Locked" : "Open"}
              </span>
              {selectedRound ? <span className="text-gray-500"> — {selectedRound.name}</span> : null}
            </div>
          </div>

          <div className="flex items-end gap-3">
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
                  </option>
                ))}
              </select>
            </div>

            {!isLocked && (
              <button
                onClick={saveLineup}
                disabled={saving || roundLoading}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save lineup"}
              </button>
            )}
          </div>
        </div>

        {roundLoading && <div className="text-sm text-gray-600">Loading round...</div>}
        {statusMsg && <div className="text-sm">{statusMsg}</div>}

        {!isLocked ? (
          <div className="border rounded p-4 space-y-4">
            {SLOTS.map((s) => {
              const opts = optionsForSlot(s.key);
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-40 font-medium">{s.label}</div>
                  <select
                    className="flex-1 border rounded px-3 py-2"
                    value={lineup[s.key]}
                    onChange={(e) => setSlot(s.key, e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {opts.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.name} — {p.team}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Slot</th>
                  <th className="text-left p-2">Player</th>
                  <th className="text-right p-2">Base</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((s) => {
                  const pid = lineup[s.key];
                  const p = pid ? playersById.get(pid) : null;
                  const score = scoresBySlot.get(String(s.key));
                  return (
                    <tr key={s.key} className="border-t">
                      <td className="p-2 font-medium">{s.label}</td>
                      <td className="p-2">
                        {p ? `${p.name} — ${p.team}` : <span className="text-gray-500">—</span>}
                      </td>
                      <td className="p-2 text-right">{score ? score.base_points.toFixed(1) : "0.0"}</td>
                      <td className="p-2 text-right">
                        {score ? score.multiplied_points.toFixed(1) : "0.0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
