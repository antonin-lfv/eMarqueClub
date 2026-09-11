"use client";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Activity,
  Users,
  SlidersHorizontal,
  BarChart3,
  Plus,
  Play,
  Pause,
  Undo2,
  ArrowLeftRight,
  CircleHelp,
  CircleDot,
  Shield,
  ChevronRight,
  Check,
  Clock3,
  Flag,
  Download,
  RefreshCw,
  UserRound,
  Target,
  CheckCircle2,
  X,
  History,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import {
  type ClubState,
  type Match,
  type Team,
  type Player,
  type GameEvent,
  type Official,
  adjustClock,
  undoLast,
  score,
  uid,
  stats,
  timeLeft,
  formatTime,
  periodName,
  lineup,
  excluded,
  addEvent,
  nextPeriod,
  shotValue,
  attackingRight,
  teamFouls,
  eventLabels,
} from "@/lib/game";
import { Court } from "./court";
import {
  Modal,
  Field,
  Picker,
  Confirm,
  RulesEditor,
  download,
} from "./widgets";
import { Library, PlayerForm } from "./library";
import { Statistics } from "./statistics";
import { useClub } from "./use-club";
import { Prematch } from "./prematch";
type ModalType =
  | "officials"
  | "player"
  | "sub"
  | "foul"
  | "other"
  | "clock"
  | "help"
  | null;
export default function Home() {
  const { state, stateRef, loaded, error, pending, commit, retry } = useClub();
  const busy = !loaded;
  const [tab, setTab] = useState("live"),
    [selected, setSelected] = useState(""),
    [modal, setModal] = useState<ModalType>(null),
    [actionTeam, setActionTeam] = useState(""),
    [confirm, setConfirm] = useState<"finish" | "reopen" | null>(null),
    [now, setNow] = useState(Date.now()),
    [historyAll, setHistoryAll] = useState(false),
    [missNext, setMissNext] = useState(false),
    [setupKey, setSetupKey] = useState("initial");
  const expired = useRef("");
  const currentMatch = () =>
    stateRef.current.matches.find((g) => g.id === stateRef.current.activeId)!;
  const m = state.matches.find((g) => g.id === state.activeId)!;
  const p = m.players.find((p) => p.id === selected);
  const left = timeLeft(m, now),
    finished = m.status === "finished";
  function undo() {
    try {
      void updateMatch(undoLast(currentMatch()));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function changeTime(delta: number) {
    try {
      void updateMatch(adjustClock(currentMatch(), delta));
      setNow(Date.now());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function updateMatch(next: Match, message?: string) {
    return commit(
      {
        ...stateRef.current,
        matches: stateRef.current.matches.map((x) =>
          x.id === next.id ? next : x,
        ),
      },
      message,
    );
  }
  async function action(e: Omit<GameEvent, "id" | "period" | "remaining">) {
    try {
      const next = addEvent(currentMatch(), e);
      if (
        await updateMatch(
          next,
          e.kind === "shot" || e.kind === "free"
            ? e.made
              ? `+${e.kind === "free" ? 1 : e.value} point${e.value === 1 ? "" : "s"} · ${p?.name ?? ""}`
              : "Tir raté enregistré"
            : `${eventLabels[e.kind]} enregistré`,
        )
      ) {
        setModal(null);
        if (e.kind === "foul" && excluded(next, e.playerId))
          toast.warning("Joueur exclu : effectuez son remplacement.");
        return true;
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
    return false;
  }
  async function toggleClock() {
    const m = currentMatch(),
      left = timeLeft(m);
    if (m.status === "finished") return;
    if (left === 0) {
      toast.info("Passez à la période suivante ou ajustez le chrono.");
      return;
    }
    await updateMatch({
      ...m,
      status: "live",
      remaining: timeLeft(m),
      runningUntil: m.runningUntil ? null : Date.now() + timeLeft(m) * 1000,
    });
  }
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (
      m.runningUntil &&
      left === 0 &&
      expired.current !== String(m.runningUntil)
    ) {
      expired.current = String(m.runningUntil);
      toast.info(`Fin de ${periodName(m)} — chronomètre à zéro.`, {
        duration: 8000,
      });
    }
  }, [left, m]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,button,[role="dialog"],[role="combobox"]',
        ) ||
        modal ||
        confirm ||
        tab !== "live"
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggleClock();
      }
      if (e.key === "Escape") {
        setSelected("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const contextState = useRef({ state, loaded });
  contextState.current = { state, loaded };
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: unknown,
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const ctx = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!ctx) return;
    const controller = new AbortController();
    const register = async () => {
      await ctx.registerTool(
        {
          name: "read_basketball_match",
          description:
            "Lire le score, les effectifs, le chrono et les actions du match actuellement ouvert.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: unknown) => {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).length
            )
              throw Error("Aucun paramètre attendu.");
            if (!contextState.current.loaded)
              throw Error("Chargement en cours.");
            const s = contextState.current.state,
              g = s.matches.find((m) => m.id === s.activeId)!;
            return {
              match: g.title,
              home: g.home.name,
              away: g.away.name,
              score: [score(g, g.home.id), score(g, g.away.id)],
              period: g.period,
              seconds: timeLeft(g),
              status: g.status,
              players: g.players,
              events: g.events.filter((e) => !e.voided),
            };
          },
        },
        { signal: controller.signal },
      );
    };
    void register().catch(() => {});
    return () => controller.abort();
  }, []);
  function selectPlayer(player: Player) {
    setSelected(player.id);
    setActionTeam(player.teamId);
    if (!lineup(m, player.teamId).some((p) => p.id === player.id)) {
      toast.info(
        excluded(m, player.id)
          ? "Ce joueur est exclu."
          : "Joueur sur le banc : utilisez Changement pour le faire entrer.",
      );
    }
  }
  function requirePlayer(type: ModalType) {
    if (!p) {
      toast.info("Sélectionnez d’abord un joueur dans l’effectif.");
      return;
    }
    setModal(type);
  }
  function courtClick(x: number, y: number) {
    if (!loaded || busy || finished) return;
    if (!p) {
      toast.info("Sélectionnez d’abord le joueur qui tire.");
      return;
    }
    if (!lineup(m, p.teamId).some((j) => j.id === p.id)) {
      toast.error("Ce joueur doit être sur le terrain pour tirer.");
      return;
    }
    const game = currentMatch();
    void action({
      kind: "shot",
      teamId: p.teamId,
      playerId: p.id,
      x,
      y,
      value: shotValue(game, p.teamId, x, y),
      made: !missNext,
    });
    setMissNext(false);
  }
  const activeEvents = m.events.filter((e) => !e.voided),
    last = activeEvents.at(-1);
  const onCourtP = p && lineup(m, p.teamId).some((j) => j.id === p.id);
  function roster(t: Team, side: string) {
    const ps = m.players.filter((p) => p.teamId === t.id),
      current = lineup(m, t.id),
      used = activeEvents.filter(
        (e) => e.kind === "timeout" && e.teamId === t.id,
      ).length;
    return (
      <section className={"roster " + side}>
        <div className="roster-title">
          <span className="team-mini">
            <Shield size={18} />
          </span>
          <h2>{t.name}</h2>
          <span className="muted">{ps.length} joueurs</span>
        </div>
        <div className="roster-head">
          <span>JOUEUR</span>
          <span>PTS</span>
          <span>F</span>
        </div>
        {ps.map((player) => {
          const s = stats(m, player.id),
            out = excluded(m, player.id),
            on = current.some((j) => j.id === player.id);
          return (
            <button
              key={player.id}
              disabled={busy || !loaded}
              className={
                "player-row " +
                (selected === player.id ? "selected " : "") +
                (out ? "excluded" : "")
              }
              onClick={() => selectPlayer(player)}
              aria-pressed={selected === player.id}
            >
              <span className="jersey">{player.number}</span>
              <span className="player-name">
                {player.name}
                <small>
                  {out ? "Exclu" : on ? "Sur le terrain" : "Sur le banc"}
                  {player.limited && (
                    <span className="cap-indicator">
                      {" "}
                      · {s.field}/{player.cap ?? m.rules.pointCap} hors LF
                    </span>
                  )}
                </small>
              </span>
              <b>{s.points}</b>
              <span
                className={
                  "foul-count " +
                  (s.fouls >= m.rules.foulLimit - 1 ? "warning" : "")
                }
              >
                {s.fouls}
              </span>
            </button>
          );
        })}
        {!ps.length && (
          <p className="empty-inline">Ajoutez des joueurs pour commencer.</p>
        )}
        <button
          disabled={finished || busy || !loaded}
          className="add-player"
          onClick={() => {
            setActionTeam(t.id);
            setModal("player");
          }}
        >
          <Plus size={15} />
          Ajouter un joueur
        </button>
        <div className="roster-bottom">
          <button
            disabled={finished || busy || !loaded || used >= m.rules.timeouts}
            onClick={() => {
              void action({ kind: "timeout", teamId: t.id, playerId: "" });
            }}
          >
            TEMPS MORT <Plus size={12} />
          </button>
          <span title={`${used} temps morts utilisés sur ${m.rules.timeouts}`}>
            {used} / {m.rules.timeouts}
          </span>
        </div>
        {current.length < m.rules.onCourt && (
          <button
            className="lineup-warning"
            onClick={() => {
              setActionTeam(t.id);
              setModal("sub");
            }}
            disabled={finished}
          >
            {current.length}/{m.rules.onCourt} sur le terrain · Compléter
          </button>
        )}
      </section>
    );
  }
  return (
    <Tabs value={tab} onValueChange={setTab} className="application">
      <Toaster theme="dark" richColors position="bottom-center" />
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <CircleDot />
          </span>
          eMarque<span className="club-label">CLUB</span>
        </a>
        <TabsList className="navigation" variant="line">
          <TabsTrigger value="setup">
            <ClipboardList size={16} />
            Avant-match
          </TabsTrigger>
          <TabsTrigger value="live">
            <Activity />
            Table de marque
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Users />
            Équipes & joueurs
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 />
            Statistiques
          </TabsTrigger>
          <TabsTrigger value="rules">
            <SlidersHorizontal />
            Règlement
          </TabsTrigger>
        </TabsList>
        <button
          className="avatar"
          onClick={() => setModal("help")}
          aria-label="Aide à la table de marque"
        >
          <CircleHelp size={18} />
        </button>
      </header>
      <main>
        <div className="match-heading">
          <div>
            <div className="eyebrow">
              ESPACE TOURNOI <ChevronRight size={12} />
              {m.id === "demo"
                ? "DÉMONSTRATION"
                : m.status === "finished"
                  ? "MATCH TERMINÉ"
                  : "MATCH DE CLUB"}
            </div>
            <h1>
              {tab === "setup"
                ? "Préparer le prochain match."
                : tab === "live"
                  ? "Le match, au bout des doigts."
                  : tab === "teams"
                    ? "Le club, côté collectif."
                    : tab === "stats"
                      ? "Le match sous tous les angles."
                      : "Vos tournois, vos règles."}
            </h1>
          </div>
          <div className="inline-actions">
            <div className="match-picker">
              <Picker
                label="Choisir un match"
                value={m.id}
                onChange={(id) => {
                  if (m.runningUntil && left > 0) {
                    toast.info(
                      "Mettez le chronomètre en pause avant de changer de match.",
                    );
                    return;
                  }
                  void commit({ ...state, activeId: id }).then((ok) => {
                    if (ok) {
                      setSelected("");
                    }
                  });
                }}
                options={state.matches.map((m) => ({
                  value: m.id,
                  label:
                    m.title + (m.status === "finished" ? " · Terminé" : ""),
                }))}
              />
            </div>
            <button
              disabled={busy || !loaded}
              className="button secondary"
              onClick={() => {
                setSetupKey(uid());
                setTab("setup");
              }}
            >
              <Plus size={17} />
              Nouveau match
            </button>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            {loaded && (
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    "emarque-saisie-en-attente.json",
                    JSON.stringify(stateRef.current, null, 2),
                    "application/json",
                  )
                }
              >
                Copie de secours
              </button>
            )}
            <button
              className="button secondary"
              onClick={retry}
              disabled={busy}
            >
              <RefreshCw size={15} />
              Réessayer
            </button>
          </div>
        )}
        {!loaded && !error && (
          <div className="loading-banner" role="status">
            Chargement de votre table de marque…
          </div>
        )}
        <TabsContent value="setup" forceMount hidden={tab !== "setup"}>
          {loaded && (
            <Prematch
              key={setupKey}
              state={state}
              onCancel={() => setTab("live")}
              onStart={async (next) => {
                if (
                  currentMatch().runningUntil &&
                  timeLeft(currentMatch()) > 0
                ) {
                  toast.info(
                    "Mettez le match en pause avant d’ouvrir une autre feuille.",
                  );
                  return;
                }
                if (await commit(next, "Match prêt")) {
                  setSelected("");
                  setMissNext(false);
                  setTab("live");
                  setSetupKey(uid());
                }
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="live">
          <section className="scoreboard">
            <div className="score-team blue">
              <div className="team-badge">
                <Shield />
              </div>
              <div>
                <small>DOMICILE</small>
                <h2>{m.home.name}</h2>
                <span>
                  Fautes d’équipe <b>{teamFouls(m, m.home.id)}</b>
                  {teamFouls(m, m.home.id) >= m.rules.teamFouls && (
                    <em className="bonus">BONUS</em>
                  )}
                </span>
              </div>
              <strong className="score">
                {String(score(m, m.home.id)).padStart(2, "0")}
              </strong>
            </div>
            <div className="clock-area">
              <span className="period">
                {finished
                  ? "MATCH TERMINÉ"
                  : m.period <= m.rules.periods
                    ? `PÉRIODE ${m.period} / ${m.rules.periods}`
                    : `PROLONGATION ${m.period - m.rules.periods}`}
              </span>
              <button
                className={"clock " + (left === 0 ? "warning" : "")}
                onClick={() => setModal("clock")}
                disabled={finished || busy || !loaded}
                aria-label="Ajuster le chronomètre"
              >
                {formatTime(left)}
              </button>
              <button
                disabled={busy || !loaded || finished || left === 0}
                className={
                  "button " +
                  (m.runningUntil && left > 0 ? "secondary" : "primary")
                }
                onClick={() => void toggleClock()}
              >
                {m.runningUntil && left > 0 ? (
                  <Pause size={15} />
                ) : (
                  <Play size={15} />
                )}{" "}
                {m.runningUntil && left > 0 ? "Pause" : "Démarrer"}
              </button>
              <div className="clock-adjustments">
                {[-60, -10, -1, 1, 10, 60].map((delta) => (
                  <button
                    key={delta}
                    disabled={!loaded || finished}
                    onClick={() => changeTime(delta)}
                    aria-label={`${delta > 0 ? "Ajouter" : "Retirer"} ${Math.abs(delta)} secondes`}
                  >
                    {delta > 0 ? "+" : "−"}
                    {Math.abs(delta) === 60 ? "1m" : Math.abs(delta) + "s"}
                  </button>
                ))}
              </div>
              <span className="clock-hint">
                {m.runningUntil && left > 0
                  ? "Chronomètre en cours"
                  : "Espace : démarrer / pause"}
              </span>
            </div>
            <div className="score-team coral">
              <strong className="score">
                {String(score(m, m.away.id)).padStart(2, "0")}
              </strong>
              <div>
                <small>EXTÉRIEUR</small>
                <h2>{m.away.name}</h2>
                <span>
                  Fautes d’équipe <b>{teamFouls(m, m.away.id)}</b>
                  {teamFouls(m, m.away.id) >= m.rules.teamFouls && (
                    <em className="bonus">BONUS</em>
                  )}
                </span>
              </div>
              <div className="team-badge">
                <Shield />
              </div>
            </div>
          </section>
          {m.startingScore && (
            <div className="starting-notice">
              Score de départ après compensation des pénalités :{" "}
              <span className="blue">{m.startingScore.home}</span> –{" "}
              <span className="coral">{m.startingScore.away}</span>
              <span>Hors statistiques individuelles</span>
            </div>
          )}
          <div className="match-tools">
            <button
              className="text-button"
              disabled={busy || finished || !loaded}
              onClick={() => setModal("officials")}
            >
              <UserRound size={15} />
              {m.officials.length
                ? `${m.officials.length} officiel${m.officials.length > 1 ? "s" : ""}`
                : "Ajouter les officiels"}
            </button>
            <div className="inline-actions">
              <button
                className="text-button"
                disabled={busy || finished || !loaded}
                onClick={() =>
                  void updateMatch(
                    { ...m, swapped: !m.swapped },
                    "Sens d’attaque inversé",
                  )
                }
              >
                <ArrowLeftRight size={15} />
                Inverser les côtés
              </button>
              <button
                className="text-button"
                disabled={left > 0 || finished || busy || !loaded}
                onClick={() => {
                  try {
                    void updateMatch(nextPeriod(m), "Période suivante").then(
                      (ok) => {
                        if (ok) setSelected("");
                      },
                    );
                  } catch (e) {
                    toast.info((e as Error).message);
                  }
                }}
              >
                Période suivante
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <div className="live-grid">
            {roster(m.home, "blue")}
            <section className="play-panel">
              <div className="panel-heading">
                <h2>
                  <CircleDot size={17} />
                  Terrain de jeu
                </h2>
                <span className="muted">
                  {p ? `#${p.number} · ${p.name}` : "Tirs à 2 et 3 points"}
                </span>
              </div>
              <div className="quick-shot-tools">
                <button
                  className={"button " + (!missNext ? "primary" : "secondary")}
                  onClick={() => setMissNext(false)}
                  aria-pressed={!missNext}
                >
                  <Check size={15} />
                  Panier réussi
                </button>
                <button
                  className={
                    "button " + (missNext ? "miss-active" : "secondary")
                  }
                  onClick={() => setMissNext(!missNext)}
                  aria-pressed={missNext}
                >
                  <X size={15} />
                  Prochain tir raté
                </button>
                <button
                  className="button secondary undo-quick"
                  disabled={!last || finished}
                  onClick={undo}
                >
                  <Undo2 size={16} />
                  Annuler
                </button>
              </div>
              <div className="court-wrap">
                <div className="court-caption">
                  <span
                    className={attackingRight(m, m.home.id) ? "coral" : "blue"}
                  >
                    ← {attackingRight(m, m.home.id) ? m.away.name : m.home.name}
                  </span>
                  <span
                    className={attackingRight(m, m.home.id) ? "blue" : "coral"}
                  >
                    {attackingRight(m, m.home.id) ? m.home.name : m.away.name} →
                  </span>
                </div>
                <Court
                  onShot={finished ? undefined : courtClick}
                  shots={activeEvents
                    .filter(
                      (e) =>
                        e.kind === "shot" &&
                        e.period === m.period &&
                        (!p || e.playerId === p.id),
                    )
                    .map((e) => ({
                      id: e.id,
                      x: e.x!,
                      y: e.y!,
                      made: !!e.made,
                      color: e.teamId === m.home.id ? "#92c5ed" : "#f2a58c",
                    }))}
                />
                <div className="court-instruction">
                  <span className={"step " + (p ? "done" : "")}>
                    {p ? <Check size={11} /> : 1}
                  </span>
                  {p ? `#${p.number} sélectionné` : "Sélectionnez un joueur"}
                  <span className="step">2</span>Cliquez à l’endroit du tir
                </div>
              </div>
              <div className="action-bar">
                <button
                  className="button secondary"
                  disabled={!onCourtP || finished || busy}
                  onClick={() =>
                    p &&
                    void action({
                      kind: "free",
                      teamId: p.teamId,
                      playerId: p.id,
                      value: 1,
                      made: true,
                    })
                  }
                >
                  +1 Lancer franc
                </button>
                <button
                  className="button secondary"
                  disabled={!p || finished || busy}
                  onClick={() =>
                    p &&
                    void action({
                      kind: "foul",
                      teamId: p.teamId,
                      playerId: p.id,
                      foulType: "Personnelle",
                    })
                  }
                >
                  + Faute
                </button>
                <button
                  className="button secondary"
                  disabled={finished || busy || !loaded}
                  onClick={() => {
                    setActionTeam(p?.teamId ?? m.home.id);
                    setModal("sub");
                  }}
                >
                  <ArrowLeftRight size={16} />
                  Changement
                </button>
              </div>
              <div className="extra-actions">
                <button
                  className="text-button"
                  disabled={!onCourtP || finished}
                  onClick={() =>
                    p &&
                    void action({
                      kind: "free",
                      teamId: p.teamId,
                      playerId: p.id,
                      value: 1,
                      made: false,
                    })
                  }
                >
                  LF raté
                </button>
                <button
                  className="text-button"
                  disabled={!p || finished}
                  onClick={() => requirePlayer("foul")}
                >
                  Autre faute
                </button>
                <button
                  className="text-button"
                  disabled={!onCourtP || finished || busy}
                  onClick={() => requirePlayer("other")}
                >
                  <Plus size={14} />
                  Rebond, passe, interception…
                </button>
                {selected && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelected("");
                      setMissNext(false);
                    }}
                  >
                    Désélectionner
                  </button>
                )}
              </div>
              <div className="tip">
                <CircleHelp size={16} />
                <span>
                  {p?.limited
                    ? `Plafond : ${stats(m, p.id).field}/${p.cap ?? m.rules.pointCap} points de tirs. Les lancers francs restent autorisés.`
                    : "Un clic = un panier. La valeur 2 / 3 pts dépend de la position. Annuler revient immédiatement en arrière."}
                </span>
              </div>
            </section>
            {roster(m.away, "coral")}
          </div>
          <section className="history">
            <div className="panel-heading">
              <h2>
                <Activity size={17} />
                Fil du match<span className="count">{activeEvents.length}</span>
              </h2>
              <button
                className="text-button"
                disabled={!last || busy || finished}
                onClick={undo}
              >
                <Undo2 size={15} />
                Annuler la dernière action
              </button>
            </div>
            {!activeEvents.length ? (
              <div className="empty-inline">
                Le match commence ici. Les actions apparaîtront au fil du jeu.
              </div>
            ) : (
              <div className="events">
                {[...activeEvents]
                  .reverse()
                  .slice(0, historyAll ? undefined : 6)
                  .map((e) => {
                    const player = m.players.find((p) => p.id === e.playerId);
                    return (
                      <div className="event-row" key={e.id}>
                        <span className="event-time">
                          {periodName(m, e.period)}{" "}
                          <b>{formatTime(e.remaining)}</b>
                        </span>
                        <span
                          className={
                            "event-symbol " +
                            (e.teamId === m.home.id ? "blue" : "coral")
                          }
                        >
                          {e.kind === "shot" || e.kind === "free" ? (
                            e.made ? (
                              `+${e.kind === "free" ? 1 : e.value}`
                            ) : (
                              "×"
                            )
                          ) : e.kind === "foul" ? (
                            "F"
                          ) : e.kind === "timeout" ? (
                            "TM"
                          ) : (
                            <ArrowLeftRight size={15} />
                          )}
                        </span>
                        <span className="event-label">
                          <b>
                            {player
                              ? `#${player.number} ${player.name}`
                              : e.teamId === m.home.id
                                ? m.home.name
                                : m.away.name}
                          </b>
                          <small>
                            {eventLabels[e.kind]}
                            {e.kind === "shot"
                              ? ` à ${e.value} pts · ${e.made ? "réussi" : "raté"}`
                              : e.kind === "free"
                                ? ` · ${e.made ? "réussi" : "raté"}`
                                : e.kind === "foul"
                                  ? ` ${e.foulType?.toLowerCase()}`
                                  : e.kind === "sub"
                                    ? ` → ${m.players.find((p) => p.id === e.otherId)?.name}`
                                    : ""}
                          </small>
                        </span>
                        <span className="event-team">
                          {e.teamId === m.home.id ? m.home.short : m.away.short}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
            {activeEvents.length > 6 && (
              <button
                className="history-toggle"
                onClick={() => setHistoryAll(!historyAll)}
              >
                {historyAll
                  ? "Réduire le journal"
                  : `Voir les ${activeEvents.length} actions`}
              </button>
            )}
          </section>
          <div className="bottom-actions">
            <span className="muted">
              {m.officials.map((o) => `${o.role} : ${o.name}`).join(" · ") ||
                "Aucun officiel affecté à ce match"}
            </span>
            <button
              className="text-button"
              disabled={busy || !loaded}
              onClick={() => setConfirm(finished ? "reopen" : "finish")}
            >
              <Flag size={15} />
              {finished ? "Rouvrir pour corriger" : "Terminer le match"}
            </button>
          </div>
        </TabsContent>
        <TabsContent value="teams">
          <Library state={state} commit={commit} busy={busy || !loaded} />
        </TabsContent>
        <TabsContent value="stats">
          <Statistics key={m.id} match={m} />
        </TabsContent>
        <TabsContent value="rules">
          <div className="section-heading">
            <div>
              <h2>Un règlement à la mesure de votre tournoi.</h2>
              <p>Ces paramètres seront utilisés pour les prochains matchs.</p>
            </div>
            <span className="tag">RÈGLES PERSONNALISÉES</span>
          </div>
          <div className="rules-layout">
            <section className="panel">
              <RulesEditor
                key={JSON.stringify(state.rules)}
                initial={state.rules}
                busy={busy || !loaded}
                onSave={(r) =>
                  void commit(
                    { ...state, rules: r },
                    "Règlement enregistré pour les prochains matchs",
                  )
                }
              />
            </section>
            <aside>
              <section className="panel rule-note">
                <Shield size={26} />
                <h2>Les joueurs à points limités</h2>
                <p>
                  Activez la limite dans la fiche du joueur. Le plafond porte
                  sur les paniers à 2 et 3 points ; les lancers francs ne le
                  consomment pas.
                </p>
                <p>
                  Un tir réussi dépassant le plafond est refusé en entier. Les
                  tirs ratés restent enregistrables.
                </p>
              </section>
              <section className="panel rule-note">
                <Clock3 size={26} />
                <h2>Règles du match ouvert</h2>
                <p>
                  {m.rules.periods} × {m.rules.minutes} minutes · Prolongation{" "}
                  {m.rules.overtime} min
                  <br />
                  {m.rules.foulLimit} fautes avant exclusion · {m.rules.onCourt}{" "}
                  joueurs sur le terrain
                  <br />
                  {m.rules.timeouts} temps morts par équipe et par match
                </p>
                <p>
                  Les côtés s’inversent à mi-match. Les deux fautes techniques /
                  antisportives combinées ou une disqualifiante entraînent aussi
                  l’exclusion.
                </p>
                <p>
                  Les lancers francs après faute se saisissent manuellement.
                </p>
              </section>
            </aside>
          </div>
          <section className="panel backup-panel">
            <div>
              <h2>Conserver une copie du tournoi</h2>
              <p>
                Une archive contient la base, les matchs, les actions et les
                positions de tirs.
              </p>
            </div>
            <button
              className="button secondary"
              disabled={!loaded}
              onClick={() =>
                download(
                  "emarque-tournoi.json",
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={16} />
              Exporter l’archive
            </button>
          </section>
        </TabsContent>
      </main>
      <footer>
        <span>
          <span className={"live-dot " + (error ? "failed" : "")} />
          {pending
            ? error
              ? "Sauvegarde en attente · saisie conservée ici"
              : "Sauvegarde en arrière-plan…"
            : !loaded
              ? "Connexion à la sauvegarde…"
              : error
                ? "Action non enregistrée"
                : "Toutes les actions sont enregistrées"}
        </span>
        <span>eMarque Club · Tournois internes & corpo</span>
      </footer>
      {modal === "player" && (
        <AddMatchPlayer
          state={state}
          m={m}
          teamId={actionTeam}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={async (player, addToBase) => {
            if (player.number === null) {
              toast.error("Renseignez un numéro de maillot pour ce match.");
              return;
            }

            if (
              m.players.some(
                (p) =>
                  p.id === player.id ||
                  (p.teamId === player.teamId && p.number === player.number),
              )
            ) {
              toast.error(
                "Ce joueur ou ce numéro figure déjà dans l’effectif.",
              );
              return;
            }
            const next = { ...m, players: [...m.players, player] };
            if (lineup(m, player.teamId).length < m.rules.onCourt)
              next.initial = [...m.initial, player.id];
            if (
              await commit(
                {
                  ...state,
                  players: addToBase
                    ? [...state.players, player]
                    : state.players,
                  matches: state.matches.map((g) => (g.id === m.id ? next : g)),
                },
                "Joueur ajouté au match",
              )
            )
              setModal(null);
          }}
        />
      )}
      {modal === "sub" && (
        <SubModal
          m={m}
          teamId={actionTeam || m.home.id}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={(e) => void action(e)}
        />
      )}
      {modal === "officials" && (
        <OfficialsModal
          state={state}
          m={m}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={async (official) => {
            if (
              m.officials.filter((o) => o.role === official.role).length >=
              (official.role === "Arbitre" ? 2 : 1)
            ) {
              toast.error(
                "Ce rôle est déjà pourvu (deux arbitres maximum). Retirez un officiel avant de le réattribuer.",
              );
              return;
            }
            if (
              m.officials.some(
                (o) =>
                  o.name.toLocaleLowerCase("fr") ===
                  official.name.toLocaleLowerCase("fr"),
              )
            ) {
              toast.error("Cette personne est déjà affectée à ce match.");
              return;
            }
            if (
              await commit(
                {
                  ...state,
                  officials: state.officials.some((o) => o.id === official.id)
                    ? state.officials
                    : [...state.officials, official],
                  matches: state.matches.map((g) =>
                    g.id === m.id
                      ? { ...m, officials: [...m.officials, official] }
                      : g,
                  ),
                },
                "Officiel ajouté",
              )
            )
              return true;
            return false;
          }}
          onRemove={(id) =>
            void updateMatch(
              { ...m, officials: m.officials.filter((o) => o.id !== id) },
              "Officiel retiré",
            )
          }
        />
      )}
      {modal === "clock" && (
        <ClockModal
          m={m}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={async (seconds) => {
            if (
              await updateMatch(
                { ...m, remaining: seconds, runningUntil: null },
                "Chronomètre ajusté et mis en pause",
              )
            )
              setModal(null);
          }}
        />
      )}
      {modal === "foul" && p && (
        <Modal
          title={`Faute · #${p.number} ${p.name}`}
          description="Le chronomètre sera mis en pause. Saisissez ensuite les éventuels lancers francs."
          onClose={() => setModal(null)}
        >
          <div className="choice-grid">
            {(
              [
                "Personnelle",
                "Technique",
                "Antisportive",
                "Disqualifiante",
              ] as const
            ).map((type) => (
              <button
                className="button secondary"
                disabled={busy}
                key={type}
                onClick={() =>
                  void action({
                    kind: "foul",
                    teamId: p.teamId,
                    playerId: p.id,
                    foulType: type,
                  })
                }
              >
                {type}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "other" && p && (
        <Modal
          title={`Action · #${p.number} ${p.name}`}
          description="Complétez les statistiques individuelles de ce joueur."
          onClose={() => setModal(null)}
        >
          <div className="choice-grid">
            {(["rebound", "assist", "steal", "turnover", "block"] as const).map(
              (kind) => (
                <button
                  className="button secondary"
                  disabled={busy}
                  key={kind}
                  onClick={() =>
                    void action({ kind, teamId: p.teamId, playerId: p.id })
                  }
                >
                  {eventLabels[kind]}
                </button>
              ),
            )}
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Prêt pour l’entre-deux ?"
          description="Une table de marque pour vos tournois de club, indépendante du logiciel officiel."
          onClose={() => setModal(null)}
        >
          <ol className="help-list">
            <li>
              Créez les équipes et les joueurs, puis choisissez le règlement
              avant de créer le match.
            </li>
            <li>
              Dans Avant-match, cochez les joueurs présents et les titulaires,
              renseignez les maillots, les licences et les officiels.
            </li>
            <li>
              Sélectionnez un joueur et cliquez sur le terrain : le panier est
              ajouté immédiatement. Pour un échec, activez « Prochain tir raté
              ». Annuler corrige en un clic.
            </li>
            <li>
              La touche Espace démarre ou arrête le chrono. Cliquez sur le temps
              pour le corriger. Les fautes et temps morts mettent le chrono en
              pause.
            </li>
            <li>
              Annulez la dernière action pour corriger une erreur. Consultez et
              exportez les statistiques pendant ou après le match.
            </li>
          </ol>
          <p className="footnote">
            Les actions apparaissent immédiatement et se sauvegardent en
            arrière-plan. Gardez la page ouverte tant que la sauvegarde est en
            attente. Une copie temporaire de cette session protège la saisie
            lors d’un rechargement. Utilisez une seule table de saisie par
            tournoi.
          </p>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === "finish" ? "Terminer ce match ?" : "Rouvrir le match ?"
          }
          description={
            confirm === "finish"
              ? "Le chronomètre sera arrêté et la feuille sera verrouillée. Vous pourrez la rouvrir."
              : "La saisie sera de nouveau disponible, chrono en pause."
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === "finish")
              void updateMatch(
                {
                  ...m,
                  status: "finished",
                  remaining: timeLeft(m),
                  runningUntil: null,
                },
                "Match terminé",
              );
            else if (confirm === "reopen")
              void updateMatch(
                { ...m, status: "live", runningUntil: null },
                "Match rouvert",
              );
            setConfirm(null);
          }}
        />
      )}
    </Tabs>
  );
}
function AddMatchPlayer({
  state,
  m,
  teamId,
  busy,
  onClose,
  onSave,
}: {
  state: ClubState;
  m: Match;
  teamId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (p: Player, add: boolean) => void;
}) {
  const [source, setSource] = useState("new"),
    [existing, setExisting] = useState("");
  const available = state.players.filter(
    (p) => !m.players.some((j) => j.id === p.id),
  );
  const team = m.home.id === teamId ? m.home : m.away;
  return (
    <Modal
      title={`Ajouter un joueur · ${team.name}`}
      description="Le joueur rejoint ce match. Un nouveau joueur est aussi ajouté à la base."
      onClose={onClose}
    >
      <Picker
        label="Origine du joueur"
        value={source}
        onChange={setSource}
        options={[
          { value: "new", label: "Créer un joueur à la volée" },
          { value: "existing", label: "Choisir dans la base" },
        ]}
      />
      {source === "new" ? (
        <PlayerForm
          state={{ ...state, teams: [team] }}
          teamId={teamId}
          busy={busy}
          onSave={(p) => onSave(p, true)}
        />
      ) : (
        <>
          <Picker
            label="Joueur existant"
            value={existing}
            onChange={setExisting}
            options={available.map((p) => ({
              value: p.id,
              label: `#${p.number} ${p.name} · ${state.teams.find((t) => t.id === p.teamId)?.name ?? "Sans équipe"}`,
            }))}
          />
          {!available.length && (
            <p className="footnote">
              Tous les joueurs de la base figurent déjà dans ce match.
            </p>
          )}
          <button
            disabled={busy || !existing}
            className="button primary"
            onClick={() => {
              const p = available.find((p) => p.id === existing);
              if (p) onSave({ ...p, teamId }, false);
            }}
          >
            Ajouter au match
          </button>
        </>
      )}
    </Modal>
  );
}
function SubModal({
  m,
  teamId,
  busy,
  onClose,
  onSave,
}: {
  m: Match;
  teamId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (e: Omit<GameEvent, "id" | "period" | "remaining">) => void;
}) {
  const [team, setTeam] = useState(teamId),
    [out, setOut] = useState("none"),
    [incoming, setIncoming] = useState("");
  const current = lineup(m, team),
    bench = m.players.filter(
      (p) =>
        p.teamId === team &&
        !current.some((c) => c.id === p.id) &&
        !excluded(m, p.id),
    );
  return (
    <Modal
      title="Changement de joueur"
      description="Choisissez le joueur sortant et le joueur entrant. Un joueur exclu est déjà retiré du terrain."
      onClose={onClose}
    >
      <Picker
        label="Équipe"
        value={team}
        onChange={(t) => {
          setTeam(t);
          setOut("none");
          setIncoming("");
        }}
        options={[m.home, m.away].map((t) => ({ value: t.id, label: t.name }))}
      />
      <Field label="Joueur sortant">
        <Picker
          label="Joueur sortant"
          value={out}
          onChange={setOut}
          options={[
            {
              value: "none",
              label:
                current.length < m.rules.onCourt
                  ? "Compléter une place libre"
                  : "Choisissez un joueur sortant",
            },
            ...current.map((p) => ({
              value: p.id,
              label: `#${p.number} ${p.name}`,
            })),
          ]}
        />
      </Field>
      <Field label="Joueur entrant">
        <Picker
          label="Joueur entrant"
          value={incoming}
          onChange={setIncoming}
          options={bench.map((p) => ({
            value: p.id,
            label: `#${p.number} ${p.name}`,
          }))}
        />
      </Field>
      {!bench.length && (
        <p className="footnote">
          Aucun joueur disponible sur le banc. Ajoutez un joueur à l’effectif.
        </p>
      )}
      <button
        className="button primary"
        disabled={
          busy ||
          !incoming ||
          (out === "none" && current.length >= m.rules.onCourt)
        }
        onClick={() =>
          onSave({
            kind: "sub",
            teamId: team,
            playerId: out === "none" ? "" : out,
            otherId: incoming,
          })
        }
      >
        Valider le changement
      </button>
    </Modal>
  );
}
function OfficialsModal({
  state,
  m,
  busy,
  onClose,
  onSave,
  onRemove,
}: {
  state: ClubState;
  m: Match;
  busy: boolean;
  onClose: () => void;
  onSave: (o: Official) => Promise<boolean | undefined>;
  onRemove: (id: string) => void;
}) {
  const [source, setSource] = useState("new"),
    [name, setName] = useState(""),
    [person, setPerson] = useState(""),
    [role, setRole] = useState<Official["role"]>("Arbitre");
  const available = state.players.filter(
    (p) => !m.players.some((j) => j.id === p.id),
  );
  return (
    <Modal
      title="Les officiels du match"
      description="Affectez un joueur d’une autre équipe, une personne enregistrée ou un nouvel officiel."
      onClose={onClose}
    >
      {m.officials.length > 0 && (
        <div className="official-list">
          {m.officials.map((o) => (
            <div key={o.id}>
              <span>
                <b>{o.name}</b>
                <small>{o.role}</small>
              </span>
              <button
                className="icon-button"
                aria-label={`Retirer ${o.name}`}
                disabled={busy}
                onClick={() => onRemove(o.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = state.officials.find((o) => o.id === person);
          const player = available.find((p) => p.id === person);
          const o: Official = {
            id:
              source === "saved"
                ? (saved?.id ?? uid())
                : source === "player"
                  ? (state.officials.find((o) => o.playerId === person)?.id ??
                    uid())
                  : uid(),
            name:
              source === "new"
                ? name
                : source === "player"
                  ? (player?.name ?? "")
                  : (saved?.name ?? ""),
            role,
            playerId:
              source === "player"
                ? person
                : source === "saved"
                  ? (saved?.playerId ?? null)
                  : null,
          };
          if (!o.name.trim()) {
            toast.error("Choisissez une personne.");
            return;
          }
          if (await onSave(o)) {
            setName("");
            setPerson("");
          }
        }}
      >
        <Field label="Rôle">
          <Picker
            label="Rôle"
            value={role}
            onChange={(r) => setRole(r as Official["role"])}
            options={[
              "Arbitre",
              "Marqueur",
              "Chronométreur",
              "Aide-marqueur",
            ].map((r) => ({ value: r, label: r }))}
          />
        </Field>
        <Field label="Personne">
          <Picker
            label="Origine de l’officiel"
            value={source}
            onChange={(v) => {
              setSource(v);
              setPerson("");
            }}
            options={[
              { value: "new", label: "Nouvelle personne" },
              { value: "player", label: "Joueur d’une autre équipe" },
              { value: "saved", label: "Officiel déjà enregistré" },
            ]}
          />
        </Field>
        {source === "new" ? (
          <Field label="Nom et prénom">
            <input
              required
              maxLength={90}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        ) : (
          <Field label={source === "player" ? "Joueur" : "Officiel"}>
            <Picker
              label="Choisir la personne"
              value={person}
              onChange={setPerson}
              options={(source === "player"
                ? available
                : state.officials.filter(
                    (o) =>
                      !o.playerId ||
                      !m.players.some((p) => p.id === o.playerId),
                  )
              ).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
        <div className="form-actions">
          <button className="button primary" disabled={busy}>
            Ajouter l’officiel
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ClockModal({
  m,
  busy,
  onClose,
  onSave,
}: {
  m: Match;
  busy: boolean;
  onClose: () => void;
  onSave: (seconds: number) => void;
}) {
  const [minutes, setMinutes] = useState(Math.floor(timeLeft(m) / 60)),
    [seconds, setSeconds] = useState(timeLeft(m) % 60);
  const max =
    (m.period > m.rules.periods ? m.rules.overtime : m.rules.minutes) * 60;
  return (
    <Modal
      title="Ajuster le chronomètre"
      description="La validation met le chrono en pause. Les actions déjà saisies conservent leur horodatage."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (minutes * 60 + seconds > max) {
            toast.error("Le temps dépasse la durée prévue pour cette période.");
            return;
          }
          onSave(minutes * 60 + seconds);
        }}
      >
        <div className="form-grid">
          <Field label="Minutes">
            <input
              type="number"
              min={0}
              max={60}
              required
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="Secondes">
            <input
              type="number"
              min={0}
              max={59}
              required
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
          </Field>
        </div>
        <button className="button primary" disabled={busy}>
          Appliquer le temps
        </button>
      </form>
    </Modal>
  );
}
