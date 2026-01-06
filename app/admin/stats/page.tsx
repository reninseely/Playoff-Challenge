"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type Profile = { id: string; username: string; is_admin: boolean };
type Round = { id: string | number; name: string; round_number: number };

type ParsedRow = {
  name: string;
  team: string;
  fantasy_points: number;
  line: number;
};

function parseSimplePointsCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const hasHeader = lines[0].toLowerCase().includes("fantasy_points");
  const startIndex = hasHeader ? 1 : 0;

  const rows: ParsedRow[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 3) continue;

    const name = parts[0];
    const team = parts[1].toUpperCase();
    const fp = Number(parts[2]);

    if (!name || !team || Number.isNaN(fp)) continue;

    rows.push({ name, team, fantasy_points: fp, line: i + 1 });
  }
  return rows;
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [csvText, setCsvText] = useState(
    "name,team,fantasy_points\nJosh Allen,BUF,23.4\nChristian McCaffrey,SF,18.2"
  );

  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
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
        .select("id, name, round_number")
        .order("round_number", { ascending: true });

      setLoading(false);

      if (roundsError) {
        setError(roundsError.message);
        return;
      }

      setProfile(profileData);
      const r = (roundsData ?? []) as Round[];
      setRounds(r);
      if (r.length > 0) setSelectedRoundId(String(r[0].id));
    }

    load();
  }, []);

  const parsed = useMemo(() => parseSimplePointsCSV(csvText), [csvText]);

  async function handleImport() {
    setError(null);
    setResultMsg(null);

    if (!profile?.is_admin) {
      setError("Not authorized.");
      return;
    }

    if (!selectedRoundId) {
      setError("Pick a round.");
      return;
    }

    if (parsed.length === 0) {
      setError("No valid rows found. Use: name,team,fantasy_points");
      return;
    }

    setImporting(true);

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("id, name, team");

    if (playersError) {
      setImporting(false);
      setError(playersError.message);
      return;
    }

    const key = (name: string, team: string) =>
      `${name.trim().toLowerCase()}|${team.trim().toUpperCase()}`;

    const playerMap = new Map<string, string>();
    for (const p of playersData ?? []) {
      playerMap.set(key(p.name, p.team), String(p.id));
    }

    const missing: ParsedRow[] = [];
    const rowsToUpsert: any[] = [];

    for (const row of parsed) {
      const pid = playerMap.get(key(row.name, row.team));
      if (!pid) {
        missing.push(row);
        continue;
      }

      rowsToUpsert.push({
        player_id: pid,
        round_id: selectedRoundId,
        fantasy_points: row.fantasy_points,
      });
    }

    if (rowsToUpsert.length === 0) {
      setImporting(false);
      setError(
        `No rows matched existing players. Missing examples: ${missing
          .slice(0, 3)
          .map((m) => `${m.name} (${m.team})`)
          .join(", ")}`
      );
      return;
    }

    const { error: upsertError } = await supabase
      .from("player_stats")
      .upsert(rowsToUpsert, { onConflict: "player_id,round_id" });

    setImporting(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    const msg =
      missing.length > 0
        ? `Imported ${rowsToUpsert.length} rows. (${missing.length} rows did not match any player in your players table.)`
        : `Imported ${rowsToUpsert.length} rows.`;
    setResultMsg(msg);
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
        <div className="p-6 space-y-2">
          <h1 className="text-2xl font-semibold">Stats Upload</h1>
          <p className="text-sm text-red-600">Not authorized.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />

      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Stats Upload (v1)</h1>
          <p className="text-sm text-gray-600">
            Paste CSV in the format: <span className="font-medium">name,team,fantasy_points</span>
          </p>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
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

          <button
            onClick={handleImport}
            disabled={importing}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>

          <div className="flex items-center gap-4">
            <a className="underline text-sm" href="/admin">
              Back to Admin
            </a>
            <a className="underline text-sm" href="/leaderboard">
              View Leaderboard
            </a>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {resultMsg && <p className="text-sm">{resultMsg}</p>}

        <textarea
          className="w-full border rounded p-3 font-mono text-sm min-h-[260px]"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />

        <div className="border rounded p-4 space-y-2">
          <div className="font-semibold">Preview</div>
          <div className="text-sm text-gray-600">Parsed rows: {parsed.length}</div>
          <div className="text-sm space-y-1">
            {parsed.slice(0, 10).map((r) => (
              <div key={`${r.line}-${r.name}`}>
                {r.name} — {r.team} — {r.fantasy_points}
              </div>
            ))}
            {parsed.length > 10 ? <div>…</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
