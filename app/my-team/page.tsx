"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Round = {
  id: string | number;
  name: string;
  round_number: number;
  is_locked: boolean;
  is_current: boolean;
};

type Player = {
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

function headshotUrl(p: Player) {
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
  const saved = typeof window !== "undefined" ? safeGetLS(storageKey) : null;
  if (saved && rounds.some((r) => String(r.id) === String(saved))) return String(saved);

  const locked = rounds
    .filter((r) => r.is_locked)
    .sort((a, b) => (Number(b.round_number) || 0) - (Number(a.round_number) || 0));
  if (locked.length > 0) return String(locked[0].id);

  const current = rounds.find((r) => r.is_current);
  if (current) return String(current.id);

  return rounds[0] ? String(rounds[0].id) : "";
}

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

  const roundStorageKey = "myteam_round";

  // ✅ Buy-in popup state
  const [buyInAmount, setBuyInAmount] = useState<number | null>(null);
  const [showBuyInModal, setShowBuyInModal] = useState(false);
  const [buyInInput, setBuyInInput] = useState<string>("0");
  const [pendingSaveAfterBuyIn, setPendingSaveAfterBuyIn] = useState(false);

  useEffect(() => {
    async function loadInitial() {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setUserId(userData.user.id);

      const [
        { data: roundsData, error: roundsError },
        { data: playersData, error: playersError },
        { data: meData, error: meError },
      ] = await Promise.all([
        supabase
          .from("rounds")
          .select("id, name, round_number, is_locked, is_current")
          .order("round_number", { ascending: true }),
        supabase.from("players").select("id, name, team, position, espn_id").order("name", { ascending: true }),
        supabase.from("users").select("buy_in_amount").eq("id", userData.user.id).maybeSingle(),
      ]);

      setLoading(false);

      if (roundsError) return setError(roundsError.message);
      if (playersError) return setError(playersError.message);
      if (meError) return setError(meError.message);

      const amt = meData?.buy_in_amount;
      setBuyInAmount(amt == null ? null : Number(amt));

      const r = (roundsData ?? []) as Round[];
      const p = (playersData ?? []) as Player[];

      setRounds(r);
      setPlayers(p);

      const map = new Map<string, Player>();
      for (const pl of p) map.set(String(pl.id), pl);
      setPlayersById(map);

      if (r.length > 0) {
        setSelectedRoundId(pickDefaultRoundId(r, roundStorageKey));
      } else {
        setSelectedRoundId("");
      }
    }

    loadInitial();
  }, []);

  const selectedRound = useMemo(
    () => rounds.find((r) => String(r.id) === String(selectedRoundId)),
    [rounds, selectedRoundId]
  );

  const isLocked = selectedRound?.is_locked ?? false;

  // ✅ Auto-copy previous round roster when a NEW roster is created for this round
  async function tryAutoCopyFromPreviousRound(params: {
    userId: string;
    newRosterId: string | number;
    currentRoundId: string;
  }) {
    const { userId, newRosterId, currentRoundId } = params;

    // Need round_number to find previous round
    const cur = rounds.find((r) => String(r.id) === String(currentRoundId));
    if (!cur) return;

    // Only copy if not round 1
    const curNum = Number(cur.round_number) || 0;
    if (curNum <= 1) return;

    const prev = rounds.find((r) => (Number(r.round_number) || 0) === curNum - 1);
    if (!prev) return;

    // Find previous roster
    const { data: prevRoster, error: prevRosterErr } = await supabase
      .from("rosters")
      .select("id")
      .eq("user_id", userId)
      .eq("round_id", String(prev.id))
      .maybeSingle();

    if (prevRosterErr) throw prevRosterErr;
    if (!prevRoster?.id) return;

    // Load previous roster players
    const { data: prevRp, error: prevRpErr } = await supabase
      .from("roster_players")
      .select("slot, player_id")
      .eq("roster_id", prevRoster.id);

    if (prevRpErr) throw prevRpErr;

    // Only keep players that still exist in current players table
    // (your manual workflow: remove eliminated players from `players`)
    const upsertRows = (prevRp ?? []).map((row: any) => {
      const slot = row.slot as SlotKey;
      const pid = row.player_id ? String(row.player_id) : "";

      const stillExists = pid && playersById.has(pid);
      return {
        roster_id: newRosterId,
        slot,
        player_id: stillExists ? pid : null,
      };
    });

    if (upsertRows.length === 0) return;

    // Write into the NEW roster
    const { error: upsertErr } = await supabase
      .from("roster_players")
      .upsert(upsertRows, { onConflict: "roster_id,slot" });

    if (upsertErr) throw upsertErr;
  }

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
      let createdNewRoster = false;

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
        createdNewRoster = true;

        // ✅ Attempt to auto-copy from previous round
        try {
          await tryAutoCopyFromPreviousRound({
            userId,
            newRosterId: rId,
            currentRoundId: selectedRoundId,
          });
        } catch (e: any) {
          // Don’t fail the whole page — just surface error
          setRoundLoading(false);
          setError(e?.message ?? "Failed to auto-copy previous round roster.");
          return;
        }
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

      // (Optional nice UX) tell them we copied it
      if (createdNewRoster) {
        // Only show a message if anything was actually carried over
        const carried = Object.values(next).filter(Boolean).length;
        if (carried > 0) setStatusMsg("Copied your previous round lineup (where still eligible).");
      }

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
    // IMPORTANT: depends on playersById + rounds too for auto-copy eligibility + prev round lookup
  }, [userId, selectedRoundId, isLocked, rounds, playersById]);

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

  async function actuallySaveLineup() {
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

  async function saveBuyInThenContinue() {
    setError(null);
    setStatusMsg(null);

    const amt = buyInInput.trim() === "" ? 0 : Number(buyInInput);

    if (!Number.isFinite(amt) || amt < 0) {
      setError("Buy-in must be a number ≥ 0.");
      return;
    }

    const { error: rpcErr } = await supabase.rpc("set_buy_in_amount", { p_amount: amt });
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    setBuyInAmount(amt);
    setShowBuyInModal(false);

    if (pendingSaveAfterBuyIn) {
      setPendingSaveAfterBuyIn(false);
      await actuallySaveLineup();
    }
  }

  async function saveLineup() {
    setError(null);
    setStatusMsg(null);

    if (isLocked) {
      setError("This round is locked. You can’t save changes.");
      return;
    }

    const isWildCard = selectedRound?.round_number === 1;

    if (isWildCard && buyInAmount == null) {
      setBuyInInput("0");
      setPendingSaveAfterBuyIn(true);
      setShowBuyInModal(true);
      return;
    }

    await actuallySaveLineup();
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
                onChange={(e) => {
                  setSelectedRoundId(e.target.value);
                  safeSetLS(roundStorageKey, e.target.value);
                }}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SLOTS.map((s) => {
            const pid = lineup[s.key];
            const p = pid ? playersById.get(String(pid)) : null;
            const score = scoresBySlot.get(String(s.key));

            const img = p ? headshotUrl(p) : null;
            const isDef = !!p && p.position === "DEF";
            const defLogo = isDef ? defenseLogoUrl(p.team) : null;

            const showDefLogo = !!p && p.position === "DEF";
            const logo = p ? defenseLogoUrl(p.team) : null;

            const basePts = score?.base_points ?? 0;
            const totalPts = score?.multiplied_points ?? 0;
            const mult = computeMultiplier(basePts, totalPts);
            const showMult = isLocked && score && mult > 1;

            return (
              <div key={s.key} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="relative h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={p?.name ?? "Player"}
                      className="h-full w-full object-contain bg-gray-100"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : isDef ? (
                    <img
                      src={defLogo!}
                      alt={`${p?.team ?? ""} defense`}
                      className="h-full w-full object-contain p-6 bg-gray-100"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="w-14 h-14 rounded-full bg-white border flex items-center justify-center text-lg font-semibold">
                        {p ? initials(p.name) : s.label}
                      </div>
                      <div className="mt-2 text-xs">{p ? "No photo" : "Empty"}</div>
                    </div>
                  )}

                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-semibold bg-white/90 border rounded-full px-2 py-1">{s.label}</span>
                  </div>

                  {p && (
                    <div className="absolute top-3 right-3">
                      <div className="w-10 h-10 rounded-xl bg-white/95 border shadow-sm flex items-center justify-center overflow-hidden">
                        {showDefLogo ? (
                          <img src={logo!} alt={`${p.team} logo`} className="w-full h-full object-contain p-1" />
                        ) : (
                          <img
                            src={defenseLogoUrl(p.team)}
                            alt={`${p.team} logo`}
                            className="w-full h-full object-contain p-1"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {showMult && (
                    <div className="absolute bottom-3 right-3">
                      <div className="text-2xl font-extrabold text-blue-600 leading-none drop-shadow-sm">x{mult}</div>
                    </div>
                  )}
                </div>

                <div className="relative p-4 space-y-3">
                  <div className="space-y-1 pr-20">
                    <div className="font-semibold leading-tight">
                      {p ? p.name : <span className="text-gray-500">No player selected</span>}
                    </div>
                    <div className="text-xs text-gray-600">
                      {p ? `${p.team} — ${p.position}` : `Select an eligible ${s.label}`}
                    </div>
                  </div>

                  {!isLocked && (
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={lineup[s.key]}
                      onChange={(e) => setSlot(s.key, e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {optionsForSlot(s.key).map((pl) => (
                        <option key={String(pl.id)} value={String(pl.id)}>
                          {pl.name} — {pl.team}
                        </option>
                      ))}
                    </select>
                  )}

                  {isLocked && (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-gray-500">Tip: Players can only be selected once per lineup (including FLEX).</div>
      </div>

      {showBuyInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <div className="text-lg font-semibold">Buy-in (Winner take all)</div>
            <div className="mt-2 text-sm text-gray-600">
              How much are you willing to buy in for? Winner take all.{" "}
              <span className="font-semibold">Enter 0 if you don’t want to buy in</span> (you can still play).
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-600">Amount</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm">$</span>
                <input
                  className="w-full border rounded px-3 py-2"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={buyInInput}
                  onChange={(e) => setBuyInInput(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="border rounded px-4 py-2"
                onClick={() => {
                  setPendingSaveAfterBuyIn(false);
                  setShowBuyInModal(false);
                }}
              >
                Cancel
              </button>
              <button className="bg-black text-white rounded px-4 py-2" onClick={saveBuyInThenContinue}>
                Submit & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
