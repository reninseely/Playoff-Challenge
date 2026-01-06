"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Round = { id: string | number; name: string; round_number: number; is_locked: boolean, is_current: boolean};

type PlayerRow = { id: string | number; name: string; team: string; position: string; espn_id: string | null};

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

const SLOTS: { key: SlotKey; label: string }[] = [
  { key: "QB", label: "QB" },
  { key: "RB1", label: "RB" },
  { key: "RB2", label: "RB" },
  { key: "WR1", label: "WR" },
  { key: "WR2", label: "WR" },
  { key: "TE", label: "TE" },
  { key: "FLEX", label: "FLEX" },
  { key: "K", label: "K" },
  { key: "DEF", label: "DEF" },
];

type ScoreRow = {
  slot: SlotKey;
  base_points: number;
  multiplied_points: number;
};

export default function TeamViewPage() {
  const params = useParams<{ username: string }>();
  const usernameParam = params?.username ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [viewedUsername, setViewedUsername] = useState<string>("");

  const [playersById, setPlayersById] = useState<Map<string, PlayerRow>>(new Map());
  const [lineupBySlot, setLineupBySlot] = useState<Record<SlotKey, string>>(() => {
    const obj: any = {};
    for (const s of SLOTS) obj[s.key] = "";
    return obj;
  });

  const [scoresBySlot, setScoresBySlot] = useState<Map<string, ScoreRow>>(new Map());

  useEffect(() => {
    async function loadInitial() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: roundsData } = await supabase
        .from("rounds")
        .select("id, name, round_number, is_locked, is_current")
        .order("round_number", { ascending: true });

      const r = (roundsData ?? []) as Round[];
      setRounds(r);
      const current = r.find((x) => x.is_current);
      setSelectedRoundId(String((current ?? r[0]).id));

      const { data: userRow } = await supabase
        .from("users")
        .select("id, username")
        .ilike("username", String(usernameParam).trim())
        .maybeSingle();

      if (!userRow) {
        setError(`User "${usernameParam}" not found.`);
        setLoading(false);
        return;
      }

      setViewedUserId(userRow.id);
      setViewedUsername(userRow.username);

      const { data: playersData } = await supabase
        .from("players")
        .select("id, name, team, position");

      const map = new Map<string, PlayerRow>();
      for (const p of (playersData ?? []) as PlayerRow[]) {
        map.set(String(p.id), p);
      }
      setPlayersById(map);

      setLoading(false);
    }

    loadInitial();
  }, [usernameParam]);

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)),
    [rounds, selectedRoundId]
  );

  const isLocked = selectedRound?.is_locked ?? false;

  useEffect(() => {
    async function loadRoundData() {
      if (!viewedUserId || !selectedRoundId) return;

      const empty: any = {};
      for (const s of SLOTS) empty[s.key] = "";
      setLineupBySlot(empty);
      setScoresBySlot(new Map());

      if (!isLocked) return;

      const { data: roster } = await supabase
        .from("rosters")
        .select("id")
        .eq("user_id", viewedUserId)
        .eq("round_id", selectedRoundId)
        .maybeSingle();

      if (!roster?.id) return;

      const { data: rp } = await supabase
        .from("roster_players")
        .select("slot, player_id")
        .eq("roster_id", roster.id);

      const next: any = {};
      for (const s of SLOTS) next[s.key] = "";
      for (const row of rp ?? []) {
        next[row.slot as SlotKey] = row.player_id ? String(row.player_id) : "";
      }
      setLineupBySlot(next);

      const { data: scoreRows } = await supabase
        .from("roster_spot_scores")
        .select("slot, base_points, multiplied_points")
        .eq("user_id", viewedUserId)
        .eq("round_id", selectedRoundId);

      const smap = new Map<string, ScoreRow>();
      for (const s of (scoreRows ?? []) as ScoreRow[]) {
        smap.set(String(s.slot), s);
      }
      setScoresBySlot(smap);
    }

    loadRoundData();
  }, [viewedUserId, selectedRoundId, isLocked]);

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
        <div className="p-6 text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-semibold">{viewedUsername}</h1>
            <div className="text-sm text-gray-600">
              {selectedRound?.name} ·{" "}
              <span className={isLocked ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
                {isLocked ? "Locked" : "Open"}
              </span>
            </div>
          </div>

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

        {!isLocked ? (
          <div className="border rounded p-4 bg-gray-50 text-sm">
            This round isn’t locked yet.
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
                  const pid = lineupBySlot[s.key];
                  const p = pid ? playersById.get(pid) : null;
                  const score = scoresBySlot.get(s.key);

                  return (
                    <tr key={s.key} className="border-t">
                      <td className="p-2 font-medium">{s.label}</td>
                      <td className="p-2">
                        {p ? `${p.name} — ${p.team}` : <span className="text-gray-500">—</span>}
                      </td>
                      <td className="p-2 text-right">
                        {score ? score.base_points.toFixed(1) : "0.0"}
                      </td>
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
