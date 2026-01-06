"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string | number;
  name: string;
  team: string;
  position: string;
  espn_id: string | null;
};

export default function PlayersPage() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    async function load() {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("players")
        .select("id, name, team, position")
        .order("position", { ascending: true })
        .order("team", { ascending: true })
        .order("name", { ascending: true });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      setPlayers((data ?? []) as Player[]);
    }

    load();
  }, []);

  const teams = useMemo(() => {
    const set = new Set(players.map((p) => p.team).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [players]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return players.filter((p) => {
      if (posFilter !== "ALL" && p.position !== posFilter) return false;
      if (teamFilter !== "ALL" && p.team !== teamFilter) return false;
      if (s && !p.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [players, posFilter, teamFilter, search]);

  if (loading) return <div className="p-6">Loading...</div>;

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Players</h1>
        <p className="text-sm text-red-600">{error}</p>
        <a className="underline" href="/">
          Home
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Players</h1>
          <p className="text-sm text-gray-600">
            Showing {filtered.length} of {players.length}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-gray-600">Search</label>
            <input
              className="border rounded px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Player name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Position</label>
            <select
              className="border rounded px-3 py-2"
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
            >
              <option value="ALL">ALL</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="K">K</option>
              <option value="DEF">DEF</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Team</label>
            <select
              className="border rounded px-3 py-2"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Team</th>
              <th className="text-left p-2">Pos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={String(p.id)} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.team}</td>
                <td className="p-2">{p.position}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t">
                <td className="p-2" colSpan={3}>
                  No players match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <a className="underline" href="/">
        Home
      </a>
    </div>
  );
}
