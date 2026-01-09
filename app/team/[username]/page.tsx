"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Round = {
  id: string | number;
  name: string;
  round_number: number;
  is_locked: boolean;
  is_current: boolean;
};

type PlayerRow = {
  id: string | number;
  name: string;
  team: string;
  position: string;
  espn_id: string | null;
};

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

function headshotUrl(p: PlayerRow) {
  if (!p.espn_id) return null;
  if (p.position === "DEF") return null;
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${p.espn_id}.png`;
}

function defenseLogoUrl(teamAbbr: string) {
  return `/defenses/${teamAbbr.toUpperCase()}.png`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function computeMultiplier(base: number, total: number) {
  if (!base || base === 0) return 1;
  const raw = total / base;
  const rounded = Math.round(raw);
  if (!Number.isFinite(rounded) || rounded < 1) return 1;
  if (rounded > 6) return 6;
  return rounded;
}

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
  const [roundLoading, setRoundLoading] = useState(false);

  useEffect(() => {
    async function loadInitial() {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("id, name, round_number, is_locked, is_current")
        .order("round_number", { ascending: true });

      if (roundsError) {
        setError(roundsError.message);
        setLoading(false);
        return;
      }

      const r = (roundsData ?? []) as Round[];
      setRounds(r);
      const current = r.find((x) => x.is_current);
      setSelectedRoundId(String((current ?? r[0]).id));

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, username")
        .ilike("username", String(usernameParam).trim())
        .maybeSingle();

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!userRow) {
        setError(`User "${usernameParam}" not found.`);
        setLoading(false);
        return;
      }

      setViewedUserId(userRow.id);
      setViewedUsername(userRow.username);

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("id, name, team, position, espn_id");

      if (playersError) {
        setError(playersError.message);
        setLoading(false);
        return;
      }

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

      setRoundLoading(true);
      setError(null);

      const empty: any = {};
      for (const s of SLOTS) empty[s.key] = "";
      setLineupBySlot(empty);
      setScoresBySlot(new Map());

      if (!isLocked) {
        setRoundLoading(false);
        return;
      }

      const { data: roster, error: rosterErr } = await supabase
        .from("rosters")
        .select("id")
        .eq("user_id", viewedUserId)
        .eq("round_id", selectedRoundId)
        .maybeSingle();

      if (rosterErr) {
        setRoundLoading(false);
        setError(rosterErr.message);
        return;
      }

      if (!roster?.id) {
        setRoundLoading(false);
        return;
      }

      const { data: rp, error: rpErr } = await supabase
        .from("roster_players")
        .select("slot, player_id")
        .eq("roster_id", roster.id);

      if (rpErr) {
        setRoundLoading(false);
        setError(rpErr.message);
        return;
      }

      const next: any = {};
      for (const s of SLOTS) next[s.key] = "";
      for (const row of rp ?? []) {
        next[row.slot as SlotKey] = row.player_id ? String(row.player_id) : "";
      }
      setLineupBySlot(next);

      const { data: scoreRows, error: scoreErr } = await supabase
        .from("roster_spot_scores")
        .select("slot, base_points, multiplied_points")
        .eq("user_id", viewedUserId)
        .eq("round_id", selectedRoundId);

      if (scoreErr) {
        setRoundLoading(false);
        setError(scoreErr.message);
        return;
      }

      const smap = new Map<string, ScoreRow>();
      for (const s of (scoreRows ?? []) as ScoreRow[]) {
        smap.set(String(s.slot), s);
      }
      setScoresBySlot(smap);

      setRoundLoading(false);
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
        <div className="p-6 space-y-2 max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header (same vibe as My Team page) */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{viewedUsername}</h1>
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
          </div>
        </div>

        {roundLoading && <div className="text-sm text-gray-600">Loading round...</div>}

        {!isLocked ? (
          <div className="border rounded p-4 bg-gray-50 text-sm">
            This round isn’t locked yet.
          </div>
        ) : (
          <>
            {/* Grid (copies My Team UI, but read-only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SLOTS.map((s) => {
                const pid = lineupBySlot[s.key];
                const p = pid ? playersById.get(String(pid)) : null;
                const score = scoresBySlot.get(String(s.key));

                const img = p ? headshotUrl(p) : null;
                const showDefLogo = !!p && p.position === "DEF";
                const teamLogo = p ? defenseLogoUrl(p.team) : null;

                const basePts = score?.base_points ?? 0;
                const totalPts = score?.multiplied_points ?? 0;
                const mult = computeMultiplier(basePts, totalPts);
                const showMult = !!score && mult > 1;

                return (
                  <div key={s.key} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                    {/* Image area */}
                    <div className="relative h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p?.name ?? "Player"}
                          className="h-full w-full object-contain bg-gray-100"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <div className="w-14 h-14 rounded-full bg-white border flex items-center justify-center text-lg font-semibold">
                            {p ? (p.position === "DEF" ? p.team : initials(p.name)) : s.label}
                          </div>
                          <div className="mt-2 text-xs">
                            {p ? (p.position === "DEF" ? "Defense" : "No photo") : "Empty"}
                          </div>
                        </div>
                      )}

                      {/* Slot badge */}
                      <div className="absolute top-3 left-3">
                        <span className="text-xs font-semibold bg-white/90 border rounded-full px-2 py-1">
                          {s.label}
                        </span>
                      </div>

                      {/* Team logo (top-right) */}
                      {p && (
                        <div className="absolute top-3 right-3">
                          <div className="w-10 h-10 rounded-xl bg-white/95 border shadow-sm flex items-center justify-center overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={showDefLogo ? teamLogo! : defenseLogoUrl(p.team)}
                              alt={`${p.team} logo`}
                              className="w-full h-full object-contain p-1"
                            />
                          </div>
                        </div>
                      )}

                      {/* Multiplier (bottom-right in gray area) */}
                      {showMult && (
                        <div className="absolute bottom-3 right-3">
                          <div className="text-2xl font-extrabold text-blue-600 leading-none drop-shadow-sm">
                            x{mult}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="relative p-4 space-y-3">
                      {/* Name + team */}
                      <div className="space-y-1 pr-20">
                        <div className="font-semibold leading-tight">
                          {p ? p.name : <span className="text-gray-500">No player selected</span>}
                        </div>
                        <div className="text-xs text-gray-600">
                          {p ? `${p.team} — ${p.position}` : `No ${s.label} selected`}
                        </div>
                      </div>

                      {/* Points (bottom-right) */}
                      <div className="absolute right-4 bottom-4 text-right">
                        <div className="text-2xl font-extrabold text-black leading-none tabular-nums">
                          {(score ? basePts : 0).toFixed(1)}
                          <span className="text-base font-bold ml-1">pts</span>
                        </div>

                        {score && mult > 1 && (
                          <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
                            Total {(totalPts ?? 0).toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-gray-500">
              Note: You can only view other users’ lineups after a round is locked.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
