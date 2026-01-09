"use client";

import { useState } from "react";
import NavBar from "@/app/components/NavBar";

type TabKey = "fantasy" | "predictor";

export default function RulesPage() {
  const [tab, setTab] = useState<TabKey>("fantasy");

  return (
    <div>
      <NavBar />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-gray-600">Playoff Challenge — private league rules summary.</p>

          <div className="inline-flex border rounded overflow-hidden">
            <button
              className={`px-4 py-2 text-sm ${
                tab === "fantasy" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
              }`}
              onClick={() => setTab("fantasy")}
            >
              Fantasy
            </button>
            <button
              className={`px-4 py-2 text-sm ${
                tab === "predictor" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
              }`}
              onClick={() => setTab("predictor")}
            >
              Predictor
            </button>
          </div>
        </div>

        {tab === "fantasy" ? (
          <>
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
                <span className="font-semibold">consecutive rounds</span> you’ve kept them in your
                lineup.
                <br />
                EX: If a player you select in the Wild Card loses that week, whichever player you
                replace them with will start their multiplier x1 in the Divisional Round and
                increase from there.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Added in Wild Card → points multiplied x1</li>
                <li>Kept into Divisional → points multiplied x2</li>
                <li>Kept into Conference → points multiplied x3</li>
                <li>Kept into Super Bowl → points multiplied x4</li>
                <li>
                  If you drop a player for any round and pick them up in rounds later, their
                  multiplier resets to 1.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Locking</h2>
              <p className="text-sm">
                When a round is <span className="font-semibold">Locked</span>, lineups can’t be
                edited. Once locked, anyone can view anyone else’s lineup for that round.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Scoring</h2>

              <p className="text-sm text-gray-600">Standard Half PPR scoring:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Passing yards: 1 per 25</li>
                <li>Passing TD: 4</li>
                <li>Rushing yards: 0.1 per 1</li>
                <li>Rushing TD: 6</li>
                <li>Receiving yards: 0.1 per 1</li>
                <li>Receiving TD: 6</li>
                <li>Reception: 0.5</li>
                <li>Interception thrown: -1</li>
                <li>Fumble lost: -2</li>
              </ul>

              <p className="text-sm text-gray-600">Kicker scoring:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Extra point: +1</li>
                <li>Field goals: 0.1 points per yard (ex: 37 yards = 3.7)</li>
                <li>Missed FG within 50 yards or missed XP: −1</li>
              </ul>

              <p className="text-sm text-gray-600">Defense scoring:</p>
              <p className="text-sm text-gray-600">
                Defense scoring will be based on both points allowed and yards allowed. And
                obviously interceptions and sacks. Yall know how scoring works don&apos;t ask dumb
                questions.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* UPDATED TOP CALL-OUT */}
            <div className="border rounded p-4 bg-gray-50">
              <div className="text-base font-semibold">
                Guess the score and earn points based on your guess. 100 points = $1.00
              </div>
              <div className="text-sm text-gray-600 mt-1">
                If you&apos;re curious about the math behind the scoring then keep reading the rules.
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Overview</h2>
              <p className="text-sm text-gray-600">
                Submit a predicted final score for each game. Points are awarded for (1) picking the
                winner and (2) score accuracy.
              </p>
              <p className="text-sm text-gray-600">
                Points are stored with decimals for exact accounting, but leaderboards display
                rounded whole points.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Round Weight</h2>
              <p className="text-sm text-gray-600">Predictor points are multiplied by round weight:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Wild Card: 1.0×</li>
                <li>Divisional: 1.4×</li>
                <li>Conference Championship: 1.8×</li>
                <li>Super Bowl: 2.5×</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Winner Points</h2>
              <p className="text-sm text-gray-600">
                Your predicted winner is based on your predicted score.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>If your predicted winner is wrong: 0 points.</li>
                <li>
                  If <span className="font-semibold">50% or more</span> of entries picked the
                  correct winner: each correct entry earns{" "}
                  <span className="font-semibold">100 points</span>.
                </li>
                <li>
                  If <span className="font-semibold">less than 50%</span> of entries picked the
                  correct winner: each correct entry earns{" "}
                  <span className="font-semibold">(N − C) × 100 ÷ C</span>, where:
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>N = total entries for the game</li>
                    <li>C = number of correct-winner entries</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Score Accuracy Pot</h2>
              <p className="text-sm text-gray-600">
                Score-accuracy points are awarded to the top 50% of entries (rounded down), ranked
                by closeness to the final score.
              </p>

              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  Winners count: <span className="font-semibold">K = floor(N / 2)</span>
                </li>
                <li>
                  Pot: <span className="font-semibold">(N − K) × 100</span> points
                </li>
                <li>
                  Ranking is based on (1) total error, then (2) spread error, then (3) total points
                  error. If still tied, payouts are split fairly across the tied places.
                </li>
              </ul>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">Pot splits:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>K = 4 → 40% / 30% / 20% / 10%</li>
                  <li>K = 3 → 45% / 33% / 22%</li>
                  <li>K = 2 → 60% / 40%</li>
                  <li>K = 1 → 100%</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Perfect Score Jackpot</h2>
              <p className="text-sm text-gray-600">
                If you guess the exact final score, you also win a separate jackpot (this stacks
                with your normal pot winnings).
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  If there are P perfect entries, each perfect entry earns{" "}
                  <span className="font-semibold">400 × (N − P)</span> points.
                </li>
                <li>N = total entries for the game</li>
                <li>P = number of perfect entries</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Worked Example</h2>
              <p className="text-sm text-gray-600">
                Example: N=7 entries → K=floor(7/2)=3 winners. Pot=(7−3)×100=400 points. The
                1st/2nd/3rd closest split 45%/33%/22%.
              </p>
              <p className="text-sm text-gray-600">
                Final predictor points for a game are multiplied by the round weight.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
