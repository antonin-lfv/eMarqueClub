import { z } from "zod";
const id = z.string().min(1).max(100),
  name = z.string().trim().min(1).max(90);
export const rulesSchema = z.object({
  periods: z.number().int().min(1).max(12),
  minutes: z.number().int().min(1).max(60),
  overtime: z.number().int().min(1).max(30),
  foulLimit: z.number().int().min(1).max(12),
  teamFouls: z.number().int().min(1).max(20),
  timeouts: z.number().int().min(0).max(12),
  onCourt: z.number().int().min(1).max(5),
  pointCap: z.number().int().min(1).max(100),
});
export const playerSchema = z.object({
  id,
  name,
  number: z.number().int().min(0).max(99).nullable(),
  teamId: z.string().max(100),
  license: z.enum(["never", "former", "current"]).optional(),
  limited: z.boolean(),
  cap: z.number().int().min(1).max(100).nullable(),
});
export const teamSchema = z.object({
  id,
  name,
  short: z.string().trim().min(1).max(5),
});
const officialSchema = z.object({
  id,
  name,
  role: z.enum(["Arbitre", "Marqueur", "Chronométreur", "Aide-marqueur"]),
  playerId: z.string().nullable(),
});
const eventSchema = z.object({
  id,
  kind: z.enum([
    "shot",
    "free",
    "foul",
    "sub",
    "timeout",
    "rebound",
    "assist",
    "steal",
    "turnover",
    "block",
  ]),
  teamId: id,
  playerId: z.string(),
  otherId: z.string().optional(),
  period: z.number().int().min(1).max(100),
  remaining: z.number().min(0).max(3600),
  made: z.boolean().optional(),
  value: z.number().int().min(0).max(3).optional(),
  x: z.number().min(0).max(28).optional(),
  y: z.number().min(0).max(15).optional(),
  foulType: z
    .enum(["Personnelle", "Technique", "Antisportive", "Disqualifiante"])
    .optional(),
  voided: z.boolean().optional(),
});
export const matchSchema = z.object({
  id,
  title: name,
  home: teamSchema,
  away: teamSchema,
  players: z.array(playerSchema).max(60),
  officials: z.array(officialSchema).max(20),
  rules: rulesSchema,
  period: z.number().int().min(1).max(100),
  remaining: z.number().min(0).max(3600),
  runningUntil: z.number().nullable(),
  status: z.enum(["ready", "live", "finished"]),
  initial: z.array(id).max(10),
  events: z.array(eventSchema).max(10000),
  swapped: z.boolean(),
  startingScore: z
    .object({ home: z.number().int().min(0), away: z.number().int().min(0) })
    .optional(),
  createdAt: z.string(),
});
export const stateSchema = z
  .object({
    teams: z.array(teamSchema).max(300),
    players: z.array(playerSchema).max(3000),
    officials: z.array(officialSchema).max(300),
    rules: rulesSchema,
    matches: z.array(matchSchema).min(1).max(300),
    activeId: id,
  })
  .superRefine((s, ctx) => {
    if (!s.matches.some((m) => m.id === s.activeId))
      ctx.addIssue({ code: "custom", message: "Match introuvable" });
  });
export type Rules = z.infer<typeof rulesSchema>;
export type Player = z.infer<typeof playerSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Official = z.infer<typeof officialSchema>;
export type GameEvent = z.infer<typeof eventSchema>;
export type Match = z.infer<typeof matchSchema>;
export type ClubState = z.infer<typeof stateSchema>;
export const uid = () => crypto.randomUUID();
export const defaults: Rules = {
  periods: 4,
  minutes: 10,
  overtime: 5,
  foulLimit: 5,
  teamFouls: 5,
  timeouts: 3,
  onCourt: 5,
  pointCap: 12,
};
export function newMatch(
  title: string,
  home: Team,
  away: Team,
  players: Player[],
  rules: Rules,
): Match {
  if (home.id === away.id) throw Error("Choisissez deux équipes différentes.");
  const roster = players.filter(
    (p) => p.teamId === home.id || p.teamId === away.id,
  );
  return {
    id: uid(),
    title,
    home: { ...home },
    away: { ...away },
    players: structuredClone(roster),
    officials: [],
    rules: { ...rules },
    period: 1,
    remaining: rules.minutes * 60,
    runningUntil: null,
    status: "ready",
    initial: [
      ...roster.filter((p) => p.teamId === home.id).slice(0, rules.onCourt),
      ...roster.filter((p) => p.teamId === away.id).slice(0, rules.onCourt),
    ].map((p) => p.id),
    events: [],
    swapped: false,
    createdAt: new Date().toISOString(),
  };
}
export function initialState(): ClubState {
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
  }));
  return {
    teams,
    players,
    officials: [],
    rules: defaults,
    matches: [
      {
        id: "demo",
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
    activeId: "demo",
  };
}
export const timeLeft = (m: Match, now = Date.now()) =>
  m.runningUntil === null
    ? m.remaining
    : Math.max(0, Math.ceil((m.runningUntil - now) / 1000));
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export const periodName = (m: Match, p = m.period) =>
  p <= m.rules.periods ? `P${p}` : `PR${p - m.rules.periods}`;
export function stats(m: Match, playerId?: string, teamId?: string) {
  const events = m.events.filter(
    (e) =>
      !e.voided &&
      (!playerId || e.playerId === playerId) &&
      (!teamId || e.teamId === teamId),
  );
  const shots = events.filter((e) => e.kind === "shot"),
    free = events.filter((e) => e.kind === "free");
  const field = shots.reduce((n, e) => n + (e.made ? e.value || 0 : 0), 0);
  return {
    points: field + free.filter((e) => e.made).length,
    field,
    fouls: events.filter((e) => e.kind === "foul").length,
    shots: shots.length,
    made: shots.filter((e) => e.made).length,
    two: [
      shots.filter((e) => e.value === 2 && e.made).length,
      shots.filter((e) => e.value === 2).length,
    ],
    three: [
      shots.filter((e) => e.value === 3 && e.made).length,
      shots.filter((e) => e.value === 3).length,
    ],
    free: [free.filter((e) => e.made).length, free.length],
    rebounds: events.filter((e) => e.kind === "rebound").length,
    assists: events.filter((e) => e.kind === "assist").length,
    steals: events.filter((e) => e.kind === "steal").length,
    turnovers: events.filter((e) => e.kind === "turnover").length,
    blocks: events.filter((e) => e.kind === "block").length,
  };
}
export function excluded(m: Match, pid: string) {
  const f = m.events.filter(
    (e) => !e.voided && e.kind === "foul" && e.playerId === pid,
  );
  return (
    f.length >= m.rules.foulLimit ||
    f.some((e) => e.foulType === "Disqualifiante") ||
    f.filter((e) => e.foulType === "Technique").length >= 2 ||
    f.filter((e) => e.foulType === "Antisportive").length >= 2 ||
    f.filter((e) => ["Technique", "Antisportive"].includes(e.foulType || ""))
      .length >= 2
  );
}
export function lineup(m: Match, teamId: string) {
  const set = new Set(m.initial);
  m.events
    .filter((e) => !e.voided && e.kind === "sub")
    .forEach((e) => {
      set.delete(e.playerId);
      if (e.otherId) set.add(e.otherId);
    });
  return m.players.filter(
    (p) => p.teamId === teamId && set.has(p.id) && !excluded(m, p.id),
  );
}
export function attackingRight(m: Match, teamId: string) {
  const secondHalf = m.period > Math.ceil(m.rules.periods / 2);
  return (teamId === m.away.id) !== (secondHalf !== m.swapped);
}
export function shotValue(m: Match, teamId: string, x: number, y: number) {
  const dx = attackingRight(m, teamId) ? 28 - x : x;
  return y <= 0.9 || y >= 14.1 || Math.hypot(dx - 1.575, y - 7.5) >= 6.75
    ? 3
    : 2;
}
export function teamFouls(m: Match, teamId: string) {
  const p = Math.min(m.period, m.rules.periods);
  return m.events.filter(
    (e) =>
      !e.voided &&
      e.kind === "foul" &&
      e.teamId === teamId &&
      Math.min(e.period, m.rules.periods) === p,
  ).length;
}
export function addEvent(
  m: Match,
  event: Omit<GameEvent, "id" | "period" | "remaining">,
  now = Date.now(),
): Match {
  if (m.status === "finished")
    throw Error("Ce match est terminé. Rouvrez-le pour corriger la feuille.");
  if (![m.home.id, m.away.id].includes(event.teamId))
    throw Error("Équipe inconnue.");
  const p = m.players.find(
    (p) => p.id === event.playerId && p.teamId === event.teamId,
  );
  if (event.kind !== "timeout" && event.kind !== "sub" && !p)
    throw Error("Sélectionnez un joueur.");
  if (
    [
      "shot",
      "free",
      "rebound",
      "assist",
      "steal",
      "turnover",
      "block",
    ].includes(event.kind) &&
    !lineup(m, event.teamId).some((p) => p.id === event.playerId)
  )
    throw Error("Ce joueur doit être sur le terrain et ne pas être exclu.");
  if (event.kind === "shot") {
    if (
      event.x === undefined ||
      event.y === undefined ||
      ![2, 3].includes(event.value || 0)
    )
      throw Error("Renseignez la position et la valeur du tir.");
    const cap = p?.limited ? (p.cap ?? m.rules.pointCap) : null;
    if (
      event.made &&
      cap !== null &&
      stats(m, p!.id).field + (event.value || 0) > cap
    )
      throw Error(
        `Plafond atteint : ${cap} points hors lancers francs. Le panier n’a pas été ajouté.`,
      );
  }
  if (event.kind === "foul" && p && excluded(m, p.id))
    throw Error("Ce joueur est déjà exclu.");
  if (event.kind === "sub") {
    const incoming = m.players.find(
      (p) => p.id === event.otherId && p.teamId === event.teamId,
    );
    const current = lineup(m, event.teamId);
    if (
      !incoming ||
      excluded(m, incoming.id) ||
      current.some((p) => p.id === incoming.id)
    )
      throw Error("Choisissez un joueur disponible sur le banc.");
    if (event.playerId && !current.some((p) => p.id === event.playerId))
      throw Error("Le joueur sortant doit être sur le terrain.");
    if (!event.playerId && current.length >= m.rules.onCourt)
      throw Error("Choisissez un joueur sortant.");
  }
  if (
    event.kind === "timeout" &&
    m.events.filter(
      (e) => !e.voided && e.kind === "timeout" && e.teamId === event.teamId,
    ).length >= m.rules.timeouts
  )
    throw Error("Tous les temps morts de cette équipe ont été utilisés.");
  const e = {
    ...event,
    id: uid(),
    period: m.period,
    remaining: timeLeft(m, now),
  };
  eventSchema.parse(e);
  return {
    ...m,
    status: "live",
    events: [...m.events, e],
    ...(event.kind === "timeout" || event.kind === "foul"
      ? { remaining: timeLeft(m, now), runningUntil: null }
      : {}),
  };
}
export function nextPeriod(m: Match): Match {
  if (m.status === "finished") throw Error("Le match est terminé.");
  if (timeLeft(m) > 0) throw Error("Le chronomètre doit être à zéro.");
  if (
    m.period >= m.rules.periods &&
    score(m, m.home.id) !== score(m, m.away.id)
  )
    throw Error(
      "Le match peut être terminé : les équipes ne sont pas à égalité.",
    );
  return {
    ...m,
    period: m.period + 1,
    remaining:
      (m.period >= m.rules.periods ? m.rules.overtime : m.rules.minutes) * 60,
    runningUntil: null,
    status: "live",
  };
}
export const eventLabels: Record<GameEvent["kind"], string> = {
  shot: "Tir",
  free: "Lancer franc",
  foul: "Faute",
  sub: "Changement",
  timeout: "Temps mort",
  rebound: "Rebond",
  assist: "Passe décisive",
  steal: "Interception",
  turnover: "Balle perdue",
  block: "Contre",
};

export const penaltyPoints = (player: Player) =>
  player.license === "current" ? 3 : player.license === "former" ? 1 : 0;
export function adjustClock(m: Match, delta: number, now = Date.now()): Match {
  if (m.status === "finished") throw Error("Ce match est terminé.");
  const max =
    (m.period > m.rules.periods ? m.rules.overtime : m.rules.minutes) * 60;
  const remaining = Math.max(0, Math.min(max, timeLeft(m, now) + delta));
  return {
    ...m,
    remaining,
    runningUntil:
      m.runningUntil !== null && remaining > 0 ? now + remaining * 1000 : null,
  };
}
export function undoLast(m: Match): Match {
  if (m.status === "finished") throw Error("Ce match est terminé.");
  const last = m.events.findLast((e) => !e.voided);
  return last
    ? {
        ...m,
        events: m.events.map((e) =>
          e.id === last.id ? { ...e, voided: true } : e,
        ),
      }
    : m;
}

export function startingPoints(m: Match, teamId: string) {
  return teamId === m.home.id
    ? (m.startingScore?.home ?? 0)
    : (m.startingScore?.away ?? 0);
}
export function score(m: Match, teamId: string) {
  return stats(m, undefined, teamId).points + startingPoints(m, teamId);
}
export function prepareMatch(
  state: ClubState,
  title: string,
  home: Team,
  away: Team,
  players: Player[],
  officials: Official[],
  starters: string[],
): ClubState {
  for (const team of [home, away]) {
    const roster = players.filter((p) => p.teamId === team.id);
    if (!roster.length)
      throw Error(`Sélectionnez les joueurs présents de ${team.name}.`);
    if (
      roster.some(
        (p) =>
          p.number === null ||
          !Number.isInteger(p.number) ||
          p.number < 0 ||
          p.number > 99,
      )
    )
      throw Error(`Renseignez les maillots de ${team.name}.`);
    if (new Set(roster.map((p) => p.number)).size !== roster.length)
      throw Error(
        `Un numéro de maillot est utilisé deux fois chez ${team.name}.`,
      );
    const target = Math.min(roster.length, state.rules.onCourt);
    if (roster.filter((p) => starters.includes(p.id)).length !== target)
      throw Error(`Choisissez ${target} titulaires chez ${team.name}.`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length)
    throw Error("Un joueur figure dans les deux équipes.");
  if (
    officials.filter((o) => o.role === "Marqueur").length !== 1 ||
    officials.filter((o) => o.role === "Chronométreur").length !== 1 ||
    officials.filter((o) => o.role === "Arbitre").length < 1 ||
    officials.filter((o) => o.role === "Arbitre").length > 2 ||
    officials.length < 3 ||
    officials.length > 4
  )
    throw Error("Prévoyez deux personnes à la table et un ou deux arbitres.");
  if (officials.some((o) => !o.name.trim()))
    throw Error("Renseignez le nom de chaque officiel.");
  if (
    new Set(
      officials.map((o) => o.playerId ?? o.name.trim().toLocaleLowerCase("fr")),
    ).size !== officials.length ||
    new Set(officials.map((o) => o.name.trim().toLocaleLowerCase("fr")))
      .size !== officials.length
  )
    throw Error("Une personne ne peut pas occuper deux postes.");
  if (
    officials.some(
      (o) => o.playerId && players.some((p) => p.id === o.playerId),
    )
  )
    throw Error("Un joueur présent au match ne peut pas être officiel.");
  const m = newMatch(title, home, away, players, state.rules);
  m.officials = structuredClone(officials);
  m.initial = [...starters];
  const a = players
      .filter((p) => p.teamId === home.id)
      .reduce((n, p) => n + penaltyPoints(p), 0),
    b = players
      .filter((p) => p.teamId === away.id)
      .reduce((n, p) => n + penaltyPoints(p), 0);
  m.startingScore = { home: Math.max(0, b - a), away: Math.max(0, a - b) };
  const updated = state.players.map((p) => {
    const selected = players.find((j) => j.id === p.id);
    return selected
      ? {
          ...p,
          number: selected.number,
          license: selected.license,
          limited: selected.limited,
          cap: selected.cap,
        }
      : p;
  });
  return {
    ...state,
    players: [
      ...updated,
      ...players.filter((p) => !updated.some((j) => j.id === p.id)),
    ],
    officials: [
      ...state.officials,
      ...officials.filter(
        (o) => !state.officials.some((saved) => saved.id === o.id),
      ),
    ],
    matches: [...state.matches, m],
    activeId: m.id,
  };
}
