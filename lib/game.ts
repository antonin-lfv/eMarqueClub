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
  onCourt: z.number().int().min(1).max(5).optional(),
  timeoutScope: z.enum(["match", "period"]).optional(),
  clockMode: z.enum(["stopped", "corpo"]).optional(),
  maxRoster: z.number().int().min(1).max(30).optional(),
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
  sourceTeamId: z.string().optional(),
  extraPenalty: z.number().int().min(0).max(1).optional(),
});
export const teamSchema = z.object({
  id,
  name,
  short: z.string().trim().min(1).max(5),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
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
  initial: z.array(id).max(10).optional(),
  events: z.array(eventSchema).max(10000),
  swapped: z.boolean(),
  startingScore: z
    .object({ home: z.number().int().min(0), away: z.number().int().min(0) })
    .optional(),
  stage: z.enum(["pool", "final"]).optional(),
  agreement: z.object({ home: z.boolean(), away: z.boolean() }).optional(),
  closingMessage: z.string().max(2000).optional(),
  remarks: z.string().max(6000).optional(),
  createdAt: z.string(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  kitColors: z
    .object({
      home: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      away: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .optional(),
});
export const stateSchema = z
  .object({
    teams: z.array(teamSchema).max(300),
    players: z.array(playerSchema).max(3000),
    officials: z.array(officialSchema).max(300),
    rules: rulesSchema,
    matches: z.array(matchSchema).max(300),
    activeId: id.nullable(),
  })
  .superRefine((s, ctx) => {
    if (s.activeId !== null && !s.matches.some((m) => m.id === s.activeId))
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
  periods: 2,
  minutes: 10,
  overtime: 3,
  foulLimit: 4,
  teamFouls: 7,
  timeouts: 1,
  timeoutScope: "period",
  clockMode: "corpo",
  maxRoster: 10,
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
    title: `${home.name} — ${away.name}`.slice(0, 90),
    home: { ...home },
    away: { ...away },
    players: structuredClone(roster),
    officials: [],
    rules: { ...rules },
    period: 1,
    remaining: rules.minutes * 60,
    runningUntil: null,
    status: "ready",
    events: [],
    swapped: false,
    createdAt: new Date().toISOString(),
  };
}
export function initialState(): ClubState {
  return {
    teams: [],
    players: [],
    officials: [],
    rules: { ...defaults },
    matches: [],
    activeId: null,
  };
}
export function removeDemo(state: ClubState): ClubState {
  const matches = state.matches.filter((m) => m.id !== "demo");
  return {
    ...state,
    matches,
    activeId:
      state.activeId === null
        ? null
        : matches.some(
              (m) => m.id === state.activeId && m.status !== "finished",
            )
          ? state.activeId
          : null,
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
export function attackingRight(m: Match, teamId: string) {
  const secondHalf = m.period > Math.ceil(m.rules.periods / 2);
  return (teamId === m.away.id) !== (secondHalf !== m.swapped);
}
// Scoreboard, rosters and court labels share the exact same orientation.
export function courtSides(m: Match): { left: Team; right: Team } {
  return attackingRight(m, m.home.id)
    ? { left: m.away, right: m.home }
    : { left: m.home, right: m.away };
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
    throw Error(
      "Ce match est terminé. Sa feuille est conservée en lecture seule.",
    );
  if (![m.home.id, m.away.id].includes(event.teamId))
    throw Error("Équipe inconnue.");
  const p = m.players.find(
    (p) => p.id === event.playerId && p.teamId === event.teamId,
  );
  if (event.kind !== "timeout" && event.kind !== "sub" && !p)
    throw Error("Sélectionnez un joueur.");
  if (p && excluded(m, p.id)) throw Error("Ce joueur est exclu.");
  if (event.kind === "sub") throw Error("Les changements ne sont plus suivis.");
  if ((event.kind === "shot" || event.kind === "free") && !event.made)
    throw Error("Seuls les paniers marqués sont saisis.");
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
  if (
    event.kind === "timeout" &&
    timeoutsUsed(m, event.teamId) >= m.rules.timeouts
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
    ...(event.kind === "timeout" ||
    event.kind === "free" ||
    (event.kind === "foul" &&
      (m.rules.clockMode !== "corpo" ||
        (m.period >= m.rules.periods && timeLeft(m, now) <= 120)))
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
  _legacyStarters: string[] = [],
  options: {
    stage?: "pool" | "final";
    scheduledAt?: string;
    kitColors?: { home: string; away: string };
    agreement?: { home: boolean; away: boolean };
  } = {},
): ClubState {
  if (players.some((p) => !p.license))
    throw Error("Renseignez la licence de chaque joueur présent.");
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
    if (roster.length > (state.rules.maxRoster ?? 30))
      throw Error(
        `Maximum ${state.rules.maxRoster} joueurs par feuille pour ${team.name}.`,
      );
    const borrowed = roster.filter(
      (p) => p.sourceTeamId && p.sourceTeamId !== p.teamId,
    );
    if (borrowed.length > 2)
      throw Error(`Deux renforts maximum pour ${team.name}.`);
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
  if (options.scheduledAt) m.scheduledAt = options.scheduledAt;
  if (options.kitColors) {
    m.kitColors = { ...options.kitColors };
    m.home.color = options.kitColors.home;
    m.away.color = options.kitColors.away;
  }
  matchSchema.parse(m);
  m.officials = structuredClone(officials);
  m.stage = options.stage ?? "pool";
  m.agreement = options.agreement ?? { home: false, away: false };
  m.startingScore = calculateStartingScore(m);
  const updated = state.players.map((p) => {
    const selected = players.find((j) => j.id === p.id);
    return selected
      ? {
          ...p,
          number: p.number ?? selected.number,
          license: p.license ?? selected.license,
          limited: selected.limited,
          cap: selected.cap,
        }
      : p;
  });
  return {
    ...state,
    players: [
      ...updated,
      ...players
        .filter((p) => !updated.some((j) => j.id === p.id))
        .map(({ sourceTeamId, extraPenalty, ...p }) => ({
          ...p,
          teamId: sourceTeamId ?? p.teamId,
        })),
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
export const teamColor = (team: Team, fallback = "#92c5ed") =>
  team.color ?? fallback;
export const matchLabel = (m: Match) => `${m.home.name} — ${m.away.name}`;
export function timeoutsUsed(m: Match, teamId: string) {
  return m.events.filter(
    (e) =>
      !e.voided &&
      e.kind === "timeout" &&
      e.teamId === teamId &&
      (m.rules.timeoutScope !== "period" ||
        Math.min(e.period, m.rules.periods) ===
          Math.min(m.period, m.rules.periods)),
  ).length;
}
export function calculateStartingScore(m: Match) {
  if (m.stage === "final") return { home: 0, away: 0 };
  const sum = (id: string) =>
    m.players
      .filter((p) => p.teamId === id)
      .reduce((n, p) => n + penaltyPoints(p) + (p.extraPenalty ?? 0), 0);
  const a = sum(m.home.id),
    b = sum(m.away.id);
  return { home: Math.max(0, b - a), away: Math.max(0, a - b) };
}
export function matchWarnings(m: Match) {
  return [m.home, m.away].flatMap((t, i) => {
    const ps = m.players.filter((p) => p.teamId === t.id);
    const borrowed = ps.filter(
      (p) => p.sourceTeamId && p.sourceTeamId !== p.teamId,
    );
    return ps.length < 5 || borrowed.length
      ? [
          `${t.name} : ${borrowed.length} renfort(s), ${ps.length} présents. ${m.agreement?.[i === 0 ? "home" : "away"] ? "Accord adverse enregistré pour valider le score." : "Accord adverse non enregistré : équipe perdante selon l’article 10 ; résultat à traiter par l’organisateur."}`,
        ]
      : [];
  });
}
export function addMatchPlayer(
  state: ClubState,
  matchId: string,
  player: Player,
): ClubState {
  const m = state.matches.find((m) => m.id === matchId);
  if (!m || m.status === "finished")
    throw Error("Le match est indisponible ou terminé.");
  if (![m.home.id, m.away.id].includes(player.teamId))
    throw Error("Équipe inconnue.");
  if (!player.license) throw Error("Renseignez la licence du joueur.");
  if (m.players.some((p) => p.id === player.id))
    throw Error("Ce joueur figure déjà dans cette rencontre.");
  if (m.officials.some((o) => o.playerId === player.id))
    throw Error("Ce joueur est déjà officiel du match.");
  if (
    player.number === null ||
    !Number.isInteger(player.number) ||
    player.number < 0 ||
    player.number > 99
  )
    throw Error("Renseignez un maillot valide.");
  if (
    m.players.some(
      (p) => p.teamId === player.teamId && p.number === player.number,
    )
  )
    throw Error("Ce maillot est déjà utilisé dans cette équipe pour le match.");
  if (
    m.players.filter((p) => p.teamId === player.teamId).length >=
    (m.rules.maxRoster ?? 30)
  )
    throw Error("Effectif maximal atteint pour ce match.");
  const borrowed = player.sourceTeamId && player.sourceTeamId !== player.teamId;
  if (
    borrowed &&
    m.players.filter(
      (p) =>
        p.teamId === player.teamId &&
        p.sourceTeamId &&
        p.sourceTeamId !== p.teamId,
    ).length >= 2
  )
    throw Error("Deux renforts maximum par équipe.");
  const next = { ...m, players: [...m.players, player] };
  next.startingScore = calculateStartingScore(next);
  const original = state.players.find((p) => p.id === player.id);
  const base = original
    ? state.players.map((p) =>
        p.id === player.id
          ? {
              ...p,
              number: p.number ?? player.number,
              license: p.license ?? player.license,
            }
          : p,
      )
    : [
        ...state.players,
        {
          ...player,
          teamId: player.sourceTeamId ?? player.teamId,
          sourceTeamId: undefined,
          extraPenalty: undefined,
        },
      ];
  return {
    ...state,
    players: base,
    matches: state.matches.map((g) => (g.id === m.id ? next : g)),
  };
}
export function updatePlayerInClub(state: ClubState, player: Player) {
  const warnings: string[] = [];
  const matches = state.matches.map((m) => {
    if (m.status === "finished") return m;
    const before = m.players.find((p) => p.id === player.id);
    const officials = m.officials.map((o) =>
      o.playerId === player.id ? { ...o, name: player.name } : o,
    );
    if (!before) return { ...m, officials };
    const baseBefore = state.players.find((p) => p.id === player.id);
    let number =
      baseBefore?.number === player.number ? before.number : player.number;
    if (
      number === null ||
      m.players.some(
        (p) =>
          p.id !== player.id &&
          p.teamId === before.teamId &&
          p.number === number,
      )
    ) {
      number = before.number;
      if (number !== player.number)
        warnings.push(
          `${matchLabel(m)} : maillot ${number} conservé dans le match (numéro vide ou déjà utilisé).`,
        );
    }
    if (
      (before.sourceTeamId !== undefined &&
        before.sourceTeamId !== player.teamId) ||
      (before.sourceTeamId === undefined && before.teamId !== player.teamId)
    )
      warnings.push(
        `${matchLabel(m)} : équipe d’origine modifiée ; le joueur reste affecté à ${before.teamId === m.home.id ? m.home.name : m.away.name} dans la rencontre. Vérifiez les renforts et l’accord adverse.`,
      );
    if (number !== before.number)
      warnings.push(
        `${matchLabel(m)} : maillot ${before.number} remplacé par ${number}, actions conservées.`,
      );
    const after = {
      ...before,
      ...player,
      number,
      teamId: before.teamId,
      sourceTeamId: player.teamId,
      extraPenalty: before.extraPenalty,
    };
    const next = {
      ...m,
      officials,
      players: m.players.map((p) => (p.id === player.id ? after : p)),
    };
    if (m.startingScore) next.startingScore = calculateStartingScore(next);
    if (before.license !== after.license) {
      warnings.push(
        `${matchLabel(m)} : licence modifiée, score de départ ${m.startingScore?.home ?? 0}–${m.startingScore?.away ?? 0} → ${next.startingScore?.home ?? 0}–${next.startingScore?.away ?? 0}. Les paniers restent conservés.`,
      );
    }
    if (before.limited !== after.limited || before.cap !== after.cap) {
      warnings.push(
        `${matchLabel(m)} : plafond modifié pour les prochains paniers ; les points déjà marqués restent acquis.`,
      );
      if (
        after.limited &&
        stats(m, player.id).field > (after.cap ?? m.rules.pointCap)
      )
        warnings.push(
          `${player.name} a déjà dépassé le nouveau plafond : aucun panier existant ne sera effacé.`,
        );
    }
    return next;
  });
  return {
    next: {
      ...state,
      players: state.players.some((p) => p.id === player.id)
        ? state.players.map((p) => (p.id === player.id ? player : p))
        : [...state.players, player],
      matches,
    },
    warnings,
  };
}
export function updateTeamInClub(state: ClubState, team: Team): ClubState {
  return {
    ...state,
    teams: state.teams.some((t) => t.id === team.id)
      ? state.teams.map((t) => (t.id === team.id ? team : t))
      : [...state.teams, team],
    matches: state.matches.map((m) =>
      m.status === "finished"
        ? m
        : {
            ...m,
            home:
              m.home.id === team.id
                ? {
                    ...team,
                    ...(m.kitColors ? { color: m.kitColors.home } : {}),
                  }
                : m.home,
            away:
              m.away.id === team.id
                ? {
                    ...team,
                    ...(m.kitColors ? { color: m.kitColors.away } : {}),
                  }
                : m.away,
          },
    ),
  };
}

// Closing archives the sheet; resetting discards only the unfinished sheet after UI confirmation.
export function finishMatch(
  state: ClubState,
  matchId: string,
  closingMessage: string,
  remarks: string,
  now = Date.now(),
): ClubState {
  const m = state.matches.find((m) => m.id === matchId);
  if (!m || m.status === "finished")
    throw Error("Cette rencontre est déjà terminée ou indisponible.");
  const next = {
    ...m,
    status: "finished" as const,
    closingMessage,
    remarks,
    remaining: timeLeft(m, now),
    runningUntil: null,
  };
  matchSchema.parse(next);
  return {
    ...state,
    matches: state.matches.map((g) => (g.id === matchId ? next : g)),
    activeId: state.activeId === matchId ? null : state.activeId,
  };
}
export function resetTable(state: ClubState, matchId: string): ClubState {
  const m = state.matches.find((m) => m.id === matchId);
  if (!m || m.status === "finished" || state.activeId !== matchId)
    throw Error("Cette feuille ne peut pas être réinitialisée.");
  return {
    ...state,
    matches: state.matches.filter((g) => g.id !== matchId),
    activeId: null,
  };
}

export function localMatchDateTime(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}
export function scheduledMatchTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw Error("Renseignez la date et l’heure du match.");
  const parsed = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(parsed.getTime()))
    throw Error("Date ou heure invalide.");
  const roundtrip = localMatchDateTime(parsed);
  if (roundtrip.date !== date || roundtrip.time !== time)
    throw Error(
      "Cette date ou cette heure n’existe pas dans votre fuseau horaire.",
    );
  return parsed.toISOString();
}
export const matchDateLabel = (m: Match) =>
  new Date(m.scheduledAt ?? m.createdAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function kitInk(color: string) {
  const r = parseInt(color.slice(1, 3), 16),
    g = parseInt(color.slice(3, 5), 16),
    b = parseInt(color.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#172018" : "#ffffff";
}
