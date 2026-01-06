"use client";

import NavBar from "@/app/components/NavBar";

export default function RulesPage() {
  return (
    <div>
      <NavBar />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-gray-600">
            Playoff Challenge — private league rules summary.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Roster (each round)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>1 QB</li>
            <li>2 RB</li>
            <li>2 WR</li>
            <li>1 TE</li>
            <li>1 FLEX (RB/WR/TE)</li>
            <li>1 K</li>
            <li>1 DEF (team defense)</li>
            <li>Multiple users can select the same players (not a draft).</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Rounds</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Wild Card</li>
            <li>Divisional</li>
            <li>Conference Championship</li>
            <li>Super Bowl</li>
          </ul>
        </div>

                <div className="space-y-2">
          <h2 className="text-lg font-semibold">Multiplier</h2>
          <p className="text-sm">
            Each player’s points are multiplied by how many{" "}
            <span className="font-semibold">consecutive rounds</span> you’ve kept them in your lineup.<br />
            EX: If a player you select in the Wild Card loses that week, whichever player you replace them with will start their multiplier x1 in the Divisional Round and and increase from there.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Added in Wild Card → points multiplied x1</li>
            <li>Kept into Divisional → points multiplied x2</li>
            <li>Kept into Conference → points multiplied x3</li>
            <li>Kept into Super Bowl → points multiplied x4</li>
            <li>If you drop a player for any round and pick them up in rounds later, their multiplier resets to 1.</li>
          </ul>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Locking</h2>
          <p className="text-sm">
            When a round is <span className="font-semibold">Locked</span>, lineups can’t be edited.
            Once locked, anyone can view anyone else’s lineup for that round.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Scoring</h2>
          <p className="text-sm text-gray-600">
            Standard Half PPR scoring:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Passing yards: 1 per 25</li>
            <li>Passing TD: 4</li>
            <li>Rushing yards: .1 per 1 </li>
            <li>Rushing TD: 6</li>
            <li>Receiving yards: .1 per 1</li>
            <li>Receiving TD: 6</li>
            <li>Reception: 0.5</li>
            <li>Interception Thrown: -1</li>
            <li>Fumble Lossed: -2</li>
            <p className="text-sm text-gray-600">
            Kicker Scoring:
            </p>
            <li>Extra point: +1</li>
            <li>Field goals: 0.1 points per yard (ex: 37 yards = 3.7)</li>
            <li>Missed FG within 50 yards or missed XP: −1</li>
            <p className="text-sm text-gray-600">
            Defense Scoring:
            </p>
            <p className="text-sm text-gray-600">
            Defense scoring will be based on both points allowed and yards allowed. And obviosuly interceptions and sacks. Yall know how scoring works don't ask dumb questions
          </p>
          </ul>
        </div>
      </div>
    </div>
  );
}
