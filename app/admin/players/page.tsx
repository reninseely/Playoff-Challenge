"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; username: string; is_admin: boolean };

type ParsedRow = {
  name: string;
  team: string;
  position: string;
  espn_id: number | null;
  line: number;
};

function normalizePosition(posRaw: string) {
  const pos = (posRaw ?? "").trim().toUpperCase();
  if (pos === "PK") return "K";
  if (pos === "FB") return "RB"; // your rule: FB counts as RB
  return pos;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Allow header row: name,team,position OR name,team,position,espn_id
  const startIndex = lines[0].toLowerCase().includes("name") ? 1 : 0;

  const rows: ParsedRow[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 3) continue;

    const name = parts[0];
    const team = parts[1].toUpperCase();
    const position = normalizePosition(parts[2]);

    // optional 4th column: espn_id
    let espn_id: number | null = null;
    if (parts.length >= 4 && parts[3]) {
      const n = Number(parts[3]);
      espn_id = Number.isFinite(n) ? n : null;
    }

    rows.push({
      name,
      team,
      position,
      espn_id,
      line: i + 1,
    });
  }

  return rows;
}

export default function AdminPlayersImportPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [csvText, setCsvText] = useState(
    "name,team,position,espn_id\nJosh Allen,BUF,QB,3918298\nChristian McCaffrey,SF,RB,3117251\nBuffalo Bills,BUF,DEF,"
  );
  const [importing, setImporting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("id, username, is_admin")
        .eq("id", user.id)
        .single();

      setLoading(false);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setProfile(profileData);
    }

    load();
  }, []);

  const parsed = useMemo(() => parseCSV(csvText), [csvText]);

  async function handleImport() {
    setResultMsg(null);
    setError(null);

    if (!profile?.is_admin) {
      setError("Not authorized.");
      return;
    }

    if (parsed.length === 0) {
      setError("No valid rows found. Use: name,team,position,espn_id (espn_id optional)");
      return;
    }

    setImporting(true);

    const rowsToInsert = parsed.map((r) => ({
      name: r.name,
      team: r.team,
      position: r.position,
      espn_id: r.espn_id,
    }));

    const { error: insertError } = await supabase.from("players").insert(rowsToInsert);

    setImporting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setResultMsg(`Imported ${rowsToInsert.length} players.`);
  }

  if (loading) return <div className="p-6">Loading...</div>;

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Import Players</h1>
        <p className="text-sm text-red-600">{error}</p>
        <a className="underline" href="/admin">
          Back to Admin
        </a>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Import Players</h1>
        <p className="text-sm text-red-600">Not authorized.</p>
        <a className="underline" href="/">
          Go home
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Import Players</h1>
        <p className="text-sm text-gray-600">
          Paste CSV with columns:{" "}
          <span className="font-medium">name, team, position, espn_id</span>{" "}
          <span className="text-gray-500">(espn_id optional)</span>
        </p>
        <p className="text-xs text-gray-500">
          Notes: PK will be saved as K. FB will be saved as RB. DEF rows can leave espn_id blank.
        </p>
      </div>

      <textarea
        className="w-full border rounded p-3 font-mono text-sm min-h-[220px]"
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={importing}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import"}
        </button>

        <a className="underline" href="/admin">
          Back to Admin
        </a>
      </div>

      {resultMsg && <p className="text-sm">{resultMsg}</p>}

      <div className="border rounded p-4 space-y-2">
        <p className="font-semibold">Preview</p>
        <p className="text-sm text-gray-600">
          Parsed rows: <span className="font-medium">{parsed.length}</span>
        </p>
        <div className="text-sm space-y-1">
          {parsed.slice(0, 10).map((r) => (
            <div key={`${r.line}-${r.name}`}>
              {r.name} — {r.team} — {r.position}
              {r.espn_id ? ` — ${r.espn_id}` : ""}
            </div>
          ))}
          {parsed.length > 10 && <div>…</div>}
        </div>
      </div>
    </div>
  );
}
