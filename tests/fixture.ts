import { defaults, type ClubState } from "../lib/game.ts";
export function fixtureState(): ClubState {
  const teams = [
    { id: "aigles", name: "Les Aigles", short: "AIG" },
    { id: "renards", name: "Les Renards", short: "REN" },
  ];
  const names = [
    "Lucas Martin",
    "Thomas Bernard",
    "Hugo Petit",
    "Arthur Moreau",
    "Louis Dubois",
    "Nathan Robert",
    "Maxime Laurent",
    "Paul Michel",
    "Alexandre Garcia",
    "Jules Roux",
    "Gabriel Simon",
    "Adam Lefèvre",
  ];
  const players = names.map((name, i) => ({
    id: "demo-" + i,
    name,
    number: (i % 6) + 4,
    teamId: teams[Math.floor(i / 6)].id,
    limited: i === 0,
    cap: null,
    license: "never" as const,
  }));
  return {
    teams,
    players,
    officials: [],
    rules: defaults,
    matches: [
      {
        id: "fixture",
        title: "Match de démonstration",
        home: teams[0],
        away: teams[1],
        players,
        officials: [],
        rules: defaults,
        period: 1,
        remaining: 600,
        runningUntil: null,
        status: "ready",
        initial: players.filter((_, i) => i % 6 < 5).map((p) => p.id),
        events: [],
        swapped: false,
        createdAt: "2026-09-11T00:00:00.000Z",
      },
    ],
    activeId: "fixture",
  };
}
