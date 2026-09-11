"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
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
  ClipboardList,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import {
  type ClubState,
  type Match,
  type Player,
  type Official,
  type GameEvent,
  uid,
  stats,
  timeLeft,
  formatTime,
  periodName,
  excluded,
  addEvent,
  nextPeriod,
  shotValue,
  attackingRight,
  teamFouls,
  eventLabels,
  adjustClock,
  undoLast,
  score,
  teamColor,
  matchLabel,
  timeoutsUsed,
  matchWarnings,
  addMatchPlayer,
  updatePlayerInClub,
  defaults,
  finishMatch,
  resetTable,
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
import { Library } from "./library";
import { Statistics } from "./statistics";
import { Prematch } from "./prematch";
import { AddRosterPlayer, OfficialEditor, defaultOfficials } from "./people";
import { useClub } from "./use-club";
type Commit = (state: ClubState, message?: string) => Promise<boolean>;
export default function Home() {
  const { state, stateRef, loaded, error, pending, commit, retry } = useClub();
  const [tab, setTab] = useState("live"),
    [setupKey, setSetupKey] = useState("first"),
    [help, setHelp] = useState(false),
    [statsId, setStatsId] = useState<string | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      run: () => void;
    } | null>(null);
  const m = state.matches.find(
    (g) => g.id === state.activeId && g.status !== "finished",
  );
  const statsMatch =
    state.matches.find((g) => g.id === statsId) ?? m ?? state.matches.at(-1);
  const openMatches = state.matches.filter((g) => g.status !== "finished");
  function showStats(id?: string) {
    setStatsId(id ?? m?.id ?? state.matches.at(-1)?.id ?? null);
    setTab("stats");
  }
  function clearPreparation() {
    setSetupKey(uid());
    setTab("live");
  }

  const openSetup = () => {
    setTab("setup");
    setSetupKey(uid());
  };
  function requestNew() {
    if (m) {
      setTab("live");
      toast.info(
        "Terminez ou réinitialisez la rencontre ouverte avant de préparer la suivante.",
      );
      return;
    }
    if (tab === "setup")
      setConfirm({
        title: "Recommencer la préparation ?",
        description:
          "Les choix non enregistrés de cette préparation seront perdus. Les matchs enregistrés, leurs scores et leurs chronomètres restent conservés.",
        run: openSetup,
      });
    else openSetup();
  }
  function remember(
    id: string,
    values: { number?: number; license?: Player["license"] },
  ) {
    const s = stateRef.current,
      p = s.players.find((p) => p.id === id);
    if (!p) return;
    const updated = {
      ...p,
      number: p.number ?? values.number ?? null,
      license: p.license ?? values.license,
    };
    const plan = updatePlayerInClub(s, updated);
    if (plan.warnings.length)
      setConfirm({
        title: "Répercuter cette information dans le match ?",
        description: plan.warnings.join("\n"),
        run: () =>
          void commit(updatePlayerInClub(stateRef.current, updated).next),
      });
    else void commit(plan.next);
  }
  const toolsState = useRef({ state, loaded });
  toolsState.current = { state, loaded };
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const c = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: "read_basketball_match",
          description:
            "Lire le score, la feuille et les remarques du match sélectionné.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (args: unknown) => {
            if (!args || typeof args !== "object" || Object.keys(args).length)
              throw Error("Aucun paramètre attendu.");
            const { state: s, loaded } = toolsState.current;
            if (!loaded) throw Error("Chargement en cours.");
            const g = s.matches.find((m) => m.id === s.activeId);
            return g
              ? {
                  match: matchLabel(g),
                  score: [score(g, g.home.id), score(g, g.away.id)],
                  period: g.period,
                  seconds: timeLeft(g),
                  status: g.status,
                  players: g.players,
                  officials: g.officials,
                  closingMessage: g.closingMessage,
                  remarks: g.remarks,
                }
              : { match: null };
          },
        },
        { signal: c.signal },
      ),
    ).catch(() => {});
    return () => c.abort();
  }, []);
  return (
    <Tabs className="application" value={tab} onValueChange={setTab}>
      <Toaster theme="dark" richColors position="bottom-center" />
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <CircleDot />
          </span>
          eMarque<span className="club-label">CLUB</span>
        </a>
        <TabsList className="navigation" variant="line">
          <TabsTrigger value="setup">
            <ClipboardList />
            Avant-match
          </TabsTrigger>
          <TabsTrigger value="live">
            <Activity />
            Table de marque
          </TabsTrigger>
          <TabsTrigger className="global-nav-start" value="rules">
            <SlidersHorizontal />
            Règlement
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Users />
            Équipes et joueurs
          </TabsTrigger>
        </TabsList>
        <button
          className="avatar"
          aria-label="Aide"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={18} />
        </button>
      </header>
      <main>
        <div className="match-heading">
          <div>
            <div className="eyebrow">
              TOURNOI CORPO <ChevronRight size={12} />
              {m?.status === "finished" ? "MATCH TERMINÉ" : "TABLE DE MARQUE"}
            </div>
            <h1>
              {tab === "teams"
                ? "Toute la base du tournoi"
                : tab === "stats"
                  ? statsMatch
                    ? `Statistiques · ${matchLabel(statsMatch)}`
                    : "Statistiques des matchs"
                  : tab === "rules"
                    ? "Les règles de votre tournoi"
                    : tab === "setup"
                      ? "Préparer la rencontre"
                      : m
                        ? matchLabel(m)
                        : "Prêt pour le prochain match ?"}
            </h1>
          </div>
          <div className="inline-actions">
            {tab === "live" && openMatches.length > (m ? 1 : 0) && (
              <div className="match-picker">
                <Picker
                  label="Match sélectionné"
                  value={m?.id ?? ""}
                  onChange={(id) => {
                    const current = stateRef.current.matches.find(
                      (g) => g.id === stateRef.current.activeId,
                    );
                    if (current?.runningUntil && timeLeft(current) > 0) {
                      toast.info(
                        "Mettez le chrono en pause avant de changer de feuille.",
                      );
                      return;
                    }
                    void commit({ ...stateRef.current, activeId: id });
                  }}
                  options={openMatches.map((g) => ({
                    value: g.id,
                    label: `${matchLabel(g)} · ${new Date(g.createdAt).toLocaleDateString("fr-FR")}${g.status === "finished" ? " · Terminé" : ""}`,
                  }))}
                />
              </div>
            )}
            <button
              disabled={!loaded}
              className="button secondary"
              onClick={requestNew}
            >
              <Plus size={16} />
              Nouveau match
            </button>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="button secondary" onClick={retry}>
              <RefreshCw size={15} />
              Réessayer
            </button>
            {loaded && (
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    "emarque-copie-de-secours.json",
                    JSON.stringify(stateRef.current, null, 2),
                    "application/json",
                  )
                }
              >
                Copie de secours
              </button>
            )}
          </div>
        )}
        {!loaded && (
          <div className="loading-banner">Chargement du tournoi…</div>
        )}
        <TabsContent value="setup" forceMount hidden={tab !== "setup"}>
          {loaded && m && (
            <section className="panel launched-match">
              <div className="eyebrow">RENCONTRE DÉJÀ OUVERTE</div>
              <h2>{matchLabel(m)}</h2>
              <p>
                L’avant-match sert à lancer une nouvelle rencontre. Cette
                feuille est déjà ouverte : il n’est pas nécessaire de la
                relancer pour corriger ses informations.
              </p>
              <ul>
                <li>
                  <b>Officiels et renforts :</b> modifiables depuis la table de
                  marque.
                </li>
                <li>
                  <b>Joueurs et couleurs :</b> modifiables dans « Équipes et
                  joueurs », avec mise à jour du match et confirmation des
                  changements sensibles.
                </li>
                <li>
                  <b>Équipes engagées et règlement :</b> fixés au lancement. Les
                  réglages du règlement concernent les prochains matchs.
                </li>
              </ul>
              <button className="button primary" onClick={() => setTab("live")}>
                Retour à la table de marque
              </button>
            </section>
          )}
          {loaded && !m && (
            <Prematch
              key={setupKey}
              state={state}
              canCancel={!!m}
              onSaveKnown={remember}
              onCancel={() => setTab("live")}
              onStart={async (next) => {
                const current = stateRef.current.matches.find(
                  (g) => g.id === stateRef.current.activeId,
                );
                if (current && current.status !== "finished") {
                  toast.info(
                    "Terminez ou réinitialisez la rencontre ouverte avant d’en lancer une autre.",
                  );
                  return;
                }
                if (await commit(next, "Rencontre créée")) {
                  setTab("live");
                  setSetupKey(uid());
                }
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="live">
          {loaded &&
            (m ? (
              <LiveTable
                key={m.id}
                state={state}
                m={m}
                commit={commit}
                getState={() => stateRef.current}
                onStatistics={() => showStats(m.id)}
                onCleared={clearPreparation}
                onFinished={() => {
                  setStatsId(m.id);
                  clearPreparation();
                }}
              />
            ) : (
              <section className="panel empty-match">
                <CircleDot size={36} />
                <h2>Aucun match ouvert</h2>
                <p>
                  Préparez les équipes, les joueurs présents et les officiels.
                </p>
                <button className="button primary" onClick={openSetup}>
                  Préparer un match
                </button>
                {state.matches.length > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => showStats()}
                  >
                    <BarChart3 size={18} />
                    Statistiques et matchs terminés
                  </button>
                )}
                <p className="muted">
                  Une rencontre terminée reste conservée dans les statistiques.
                </p>
              </section>
            ))}
        </TabsContent>
        <TabsContent value="teams">
          <Library state={state} commit={commit} busy={!loaded} />
        </TabsContent>
        <TabsContent value="stats">
          <div className="statistics-navigation">
            <button className="button secondary" onClick={() => setTab("live")}>
              <ChevronRight className="back-arrow" size={18} />
              Retour à la table
            </button>
            {statsMatch && (
              <Picker
                label="Rencontre à consulter"
                value={statsMatch.id}
                onChange={setStatsId}
                options={state.matches
                  .toReversed()
                  .map((g) => ({
                    value: g.id,
                    label: `${matchLabel(g)} · ${new Date(g.createdAt).toLocaleDateString("fr-FR")} · ${g.status === "finished" ? "Terminé" : "En cours"}`,
                  }))}
              />
            )}
            <span className="muted">
              Consultation uniquement · la table de marque reste inchangée
            </span>
          </div>
          {statsMatch ? (
            <Statistics key={statsMatch.id} match={statsMatch} />
          ) : (
            <section className="panel empty-match">
              <h2>Aucune rencontre enregistrée</h2>
            </section>
          )}
        </TabsContent>
        <TabsContent value="rules">
          <div className="section-heading">
            <div>
              <h2>Règlement des prochains matchs</h2>
              <p>
                Les rencontres déjà créées conservent leurs durées et règles.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                setConfirm({
                  title: "Appliquer le préréglage Corpo 2025 ?",
                  description:
                    "Les paramètres des prochains matchs seront remplacés. Aucun match existant, score ou chrono ne sera remis à zéro.",
                  run: () =>
                    void commit(
                      { ...stateRef.current, rules: { ...defaults } },
                      "Règles Corpo 2025 appliquées",
                    ),
                })
              }
            >
              Préréglage Corpo 2025
            </button>
          </div>
          <div className="rules-layout">
            <section className="panel">
              <RulesEditor
                key={JSON.stringify(state.rules)}
                initial={state.rules}
                busy={!loaded}
                onSave={(r) =>
                  void commit(
                    { ...stateRef.current, rules: r },
                    "Règlement enregistré",
                  )
                }
              />
            </section>
            <aside>
              <section className="panel rule-note">
                <Clock3 />
                <h2>Chrono Corpo</h2>
                <p>
                  2 × 10 min, prolongation de 3 min, mi-temps de 5 min. Arrêt
                  sur temps mort et lancers francs. En dehors des deux dernières
                  minutes du match ou d’une prolongation, les fautes simples
                  n’arrêtent pas automatiquement le chrono.
                </p>
                <p>
                  Les sorties et autres arrêts restent à saisir avec Pause. Une
                  séquence de lancers francs possède son bouton de pause.
                </p>
              </section>
              <section className="panel rule-note">
                <Shield />
                <h2>Points à vérifier avec l’organisateur</h2>
                <p>
                  5 joueurs minimum, 10 par feuille, 15 dans l’effectif du
                  tournoi. Deux renforts maximum ; accord adverse pour valider
                  le score. Les licences de compétition nécessitent
                  l’autorisation préalable de l’organisateur.
                </p>
                <p>
                  Les pénalités 0 / 1 / 3 ne concernent que les poules. Un
                  nouvel arrivant peut recevoir +1 point sur un match. L’option
                  se trouve dans l’ajout de joueur.
                </p>
                <p>
                  Le plafond de 12 points hors LF est votre règle complémentaire
                  : il ne figure pas dans le PDF fourni.
                </p>
              </section>
            </aside>
          </div>
          <section className="panel backup-panel">
            <div>
              <h2>Archive du tournoi</h2>
              <p>
                Base, feuilles, positions des paniers et remarques de fin de
                match.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  "emarque-tournoi.json",
                  JSON.stringify(stateRef.current, null, 2),
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
            : loaded
              ? "Toutes les actions sont enregistrées"
              : "Connexion…"}
        </span>
        <span>eMarque Club · Tournois internes et corpo</span>
      </footer>
      {confirm && (
        <Confirm
          title={confirm.title}
          description={confirm.description}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            confirm.run();
            setConfirm(null);
          }}
        />
      )}
      {help && (
        <Modal
          title="Une table de marque simplifiée"
          description="Base du tournoi et feuilles de match."
          onClose={() => setHelp(false)}
        >
          <ul className="help-list">
            <li>
              « Équipes et joueurs » contient toute la base. Les modifications
              se répercutent dans les matchs non terminés ; les feuilles
              terminées restent figées.
            </li>
            <li>
              Les statistiques sont accessibles depuis la table : consultez le
              match en cours ou les feuilles terminées, sans changer la
              rencontre ouverte.
            </li>
            <li>
              L’avant-match prépare une nouvelle feuille. Une fois lancée, les
              officiels se modifient depuis la table et les couleurs depuis la
              base.
            </li>
            <li>
              Terminer conserve le résultat et libère la table. Réinitialiser
              supprime la feuille ouverte après confirmation, sans toucher à la
              base ni aux matchs terminés.
            </li>
            <li>
              Sélectionnez un joueur présent puis cliquez sur le terrain : le
              panier est ajouté immédiatement. Annuler corrige en un clic.
            </li>
            <li>
              Ajouter un joueur ne réinitialise ni les paniers ni le chrono. Les
              changements de score de départ demandent une confirmation.
            </li>
            <li>
              Les prêts ne modifient pas l’équipe d’origine dans la base. Les
              maillots peuvent être adaptés pour une rencontre.
            </li>
            <li>
              Gardez la page ouverte jusqu’à la fin de la sauvegarde en
              arrière-plan.
            </li>
          </ul>
        </Modal>
      )}
    </Tabs>
  );
}
function LiveTable({
  state,
  m,
  commit,
  getState,
  onStatistics,
  onCleared,
  onFinished,
}: {
  state: ClubState;
  m: Match;
  commit: Commit;
  getState: () => ClubState;
  onStatistics: () => void;
  onCleared: () => void;
  onFinished: () => void;
}) {
  const [selected, setSelected] = useState(""),
    [now, setNow] = useState(Date.now()),
    [modal, setModal] = useState<
      "clock" | "foul" | "other" | "officials" | "finish" | null
    >(null),
    [adding, setAdding] = useState<string | null>(null),
    [showAll, setShowAll] = useState(false),
    [confirmation, setConfirmation] = useState<{
      title: string;
      description: string;
      run: () => void;
    } | null>(null);
  const p = m.players.find((p) => p.id === selected),
    left = timeLeft(m, now),
    finished = m.status === "finished",
    eligible = !!p && !excluded(m, p.id),
    active = m.events.filter(
      (e) =>
        !e.voided &&
        e.kind !== "sub" &&
        !(["shot", "free"].includes(e.kind) && !e.made),
    ),
    last = m.events.findLast(
      (e) =>
        !e.voided &&
        e.kind !== "sub" &&
        !(["shot", "free"].includes(e.kind) && !e.made),
    );
  const current = () => getState().matches.find((g) => g.id === m.id)!;
  const update = (next: Match, message?: string) =>
    commit(
      {
        ...getState(),
        matches: getState().matches.map((g) => (g.id === next.id ? next : g)),
      },
      message,
    );
  function record(event: Omit<GameEvent, "id" | "period" | "remaining">) {
    try {
      void update(addEvent(current(), event));
      setModal(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function undo() {
    if (!last || finished) return;
    const game = current();
    void update({
      ...game,
      events: game.events.map((e) =>
        e.id === last.id ? { ...e, voided: true } : e,
      ),
    });
  }
  function pause() {
    const g = current();
    if (g.status === "finished") return;
    void update({ ...g, remaining: timeLeft(g), runningUntil: null });
  }
  function toggle() {
    const g = current(),
      remaining = timeLeft(g);
    if (g.status === "finished" || remaining === 0) return;
    void update({
      ...g,
      status: "live",
      remaining,
      runningUntil: g.runningUntil ? null : Date.now() + remaining * 1000,
    });
    setNow(Date.now());
  }
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        modal ||
        adding ||
        confirmation ||
        (e.target as Element).closest(
          'input,textarea,button,[role="dialog"],[role="combobox"]',
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function teamPanel(team: Match["home"], color: string) {
    const ps = m.players.filter((p) => p.teamId === team.id);
    return (
      <section className="roster" style={{ color }}>
        <div className="roster-title">
          <Shield size={18} />
          <h2>{team.name}</h2>
          <span className="muted">{ps.length} présents</span>
        </div>
        <div className="roster-head">
          <span>JOUEUR</span>
          <span>PTS</span>
          <span>F</span>
        </div>
        {ps.map((player) => {
          const s = stats(m, player.id);
          return (
            <button
              className={
                "player-row " +
                (player.id === selected ? "selected " : "") +
                (excluded(m, player.id) ? "excluded" : "")
              }
              key={player.id}
              aria-pressed={player.id === selected}
              onClick={() => setSelected(player.id)}
            >
              <span className="jersey">{player.number}</span>
              <span className="player-name">
                {player.name}
                <small>
                  {excluded(m, player.id)
                    ? "Exclu"
                    : player.sourceTeamId &&
                        player.sourceTeamId !== player.teamId
                      ? "Renfort"
                      : player.limited
                        ? `${s.field}/${player.cap ?? m.rules.pointCap} hors LF`
                        : ""}
                </small>
              </span>
              <b>{s.points}</b>
              <span className="foul-count">{s.fouls}</span>
            </button>
          );
        })}
        <button
          className="add-player"
          disabled={finished}
          onClick={() => setAdding(team.id)}
        >
          <Plus size={15} />
          Compléter depuis la base
        </button>
      </section>
    );
  }
  const colors = {
    [m.home.id]: teamColor(m.home),
    [m.away.id]: teamColor(m.away, "#f2a58c"),
  };
  const notices = matchWarnings(m);
  return (
    <>
      <section className="scoreboard">
        {[m.home, null, m.away].map((team, i) =>
          team ? (
            <div
              key={team.id}
              className={"score-team " + (i === 2 ? "away-score" : "")}
              style={{ color: colors[team.id] }}
            >
              {i === 2 && (
                <strong className="score">
                  {String(score(m, team.id)).padStart(2, "0")}
                </strong>
              )}
              <div className="team-badge">
                <Shield />
              </div>
              <div>
                <small>{i === 0 ? "DOMICILE" : "EXTÉRIEUR"}</small>
                <h2>{team.name}</h2>
                <span>
                  Fautes <b>{teamFouls(m, team.id)}</b>
                  {teamFouls(m, team.id) >= m.rules.teamFouls && (
                    <em className="bonus">2 LF</em>
                  )}
                </span>
                <div className="score-timeouts">
                  <span>Temps morts</span>
                  <b>
                    {timeoutsUsed(m, team.id)} / {m.rules.timeouts}
                  </b>
                  <button
                    aria-label={`Temps mort ${team.name}`}
                    disabled={
                      finished || timeoutsUsed(m, team.id) >= m.rules.timeouts
                    }
                    onClick={() =>
                      record({ kind: "timeout", teamId: team.id, playerId: "" })
                    }
                  >
                    <Plus size={14} />
                  </button>
                  <small>
                    {m.rules.timeoutScope === "period"
                      ? `cette ${m.rules.periods === 2 ? "mi-temps" : "période"}`
                      : "sur le match"}
                  </small>
                </div>
              </div>
              {i === 0 && (
                <strong className="score">
                  {String(score(m, team.id)).padStart(2, "0")}
                </strong>
              )}
            </div>
          ) : (
            <div key="clock" className="clock-area">
              <span className="period">
                {finished
                  ? "MATCH TERMINÉ"
                  : `${periodName(m)} / ${m.rules.periods}`}
              </span>
              <button
                disabled={finished}
                className={"clock " + (left === 0 ? "warning" : "")}
                onClick={() => setModal("clock")}
                aria-label="Régler le chrono"
              >
                {formatTime(left)}
              </button>
              <button
                className={
                  "button " +
                  (m.runningUntil && left > 0 ? "secondary" : "primary")
                }
                disabled={finished || left === 0}
                onClick={toggle}
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
                    disabled={finished}
                    onClick={() => {
                      try {
                        void update(adjustClock(current(), delta));
                        setNow(Date.now());
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {delta > 0 ? "+" : "−"}
                    {Math.abs(delta) === 60 ? "1m" : Math.abs(delta) + "s"}
                  </button>
                ))}
              </div>
            </div>
          ),
        )}
      </section>
      <div className="starting-notice">
        Départ : {m.startingScore?.home ?? 0}–{m.startingScore?.away ?? 0} ·{" "}
        {m.stage === "final" ? "Phase finale, sans pénalités" : "Poules"}
      </div>
      <div className="match-command-bar">
        <div className="match-command-main">
          <button
            className="button secondary"
            onClick={() =>
              void update({ ...current(), swapped: !current().swapped })
            }
          >
            <ArrowLeftRight size={19} />
            Inverser les côtés
          </button>
          <button
            className="button primary"
            disabled={left > 0 || finished}
            title={
              left > 0
                ? "Disponible quand le chrono est à zéro"
                : "Passer à la période suivante"
            }
            onClick={() => {
              try {
                void update(nextPeriod(current()));
              } catch (e) {
                toast.info((e as Error).message);
              }
            }}
          >
            Période suivante
            <ChevronRight size={19} />
          </button>
          <button
            className="button finish-button"
            onClick={() => {
              pause();
              setModal("finish");
            }}
          >
            <Flag size={19} />
            Terminer le match
          </button>
        </div>
        <div className="match-command-secondary">
          <button
            className="button secondary"
            onClick={() => setModal("officials")}
          >
            <UserRound size={17} />
            Modifier les officiels · {m.officials.length}
          </button>
          <button className="button secondary" onClick={onStatistics}>
            <BarChart3 size={17} />
            Statistiques du match
          </button>
          <button
            className="button reset-button"
            onClick={() =>
              setConfirmation({
                title: "Réinitialiser la table de marque ?",
                description: `La feuille ${matchLabel(m)}, ses scores, son chronomètre et toutes ses actions seront supprimés. La table redeviendra vide pour préparer un autre match. La base des équipes et joueurs et les matchs terminés seront conservés. Cette action est irréversible.`,
                run: () => {
                  try {
                    void commit(
                      resetTable(getState(), m.id),
                      "Table réinitialisée",
                    );
                    onCleared();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                },
              })
            }
          >
            <RefreshCw size={17} />
            Réinitialiser la table
          </button>
        </div>
      </div>
      <div className="live-grid">
        {teamPanel(m.home, colors[m.home.id])}
        <section className="play-panel">
          <div className="panel-heading">
            <h2>
              <CircleDot size={17} />
              Paniers marqués
            </h2>
            <span className="muted">
              {p ? `#${p.number} · ${p.name}` : "Sélectionnez un joueur"}
            </span>
          </div>
          <div className="quick-shot-tools">
            <span className="muted">Un clic sur le terrain = un panier</span>
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
                style={{
                  color:
                    colors[
                      attackingRight(m, m.home.id) ? m.away.id : m.home.id
                    ],
                }}
              >
                ← {attackingRight(m, m.home.id) ? m.away.name : m.home.name}
              </span>
              <span
                style={{
                  color:
                    colors[
                      attackingRight(m, m.home.id) ? m.home.id : m.away.id
                    ],
                }}
              >
                {attackingRight(m, m.home.id) ? m.home.name : m.away.name} →
              </span>
            </div>
            <Court
              onShot={
                finished
                  ? undefined
                  : (x, y) => {
                      if (!p) {
                        toast.info("Sélectionnez le joueur qui marque.");
                        return;
                      }
                      record({
                        kind: "shot",
                        teamId: p.teamId,
                        playerId: p.id,
                        x,
                        y,
                        value: shotValue(current(), p.teamId, x, y),
                        made: true,
                      });
                    }
              }
              shots={active
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
                  made: true,
                  color: colors[e.teamId],
                }))}
            />
            <div className="court-instruction">
              <span className="step">1</span>
              {p ? `#${p.number} sélectionné` : "Choisissez le joueur"}
              <span className="step">2</span>Cliquez sur le terrain
            </div>
          </div>
          <div className="action-bar">
            <button
              className="button secondary"
              disabled={!eligible || finished}
              onClick={() =>
                p &&
                record({
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
              disabled={!eligible || finished}
              onClick={() =>
                p &&
                record({
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
              disabled={finished}
              onClick={pause}
            >
              <Pause size={15} />
              Séquence LF
            </button>
          </div>
          <div className="extra-actions">
            <button
              className="text-button"
              disabled={!eligible || finished}
              onClick={() => setModal("foul")}
            >
              Autre faute
            </button>
            <button
              className="text-button"
              disabled={!eligible || finished}
              onClick={() => setModal("other")}
            >
              Rebond, passe…
            </button>
            <button className="text-button" onClick={() => setSelected("")}>
              Désélectionner
            </button>
          </div>
          <div className="tip">
            <CircleHelp size={15} />
            {p?.limited
              ? `${stats(m, p.id).field}/${p.cap ?? m.rules.pointCap} points hors LF. Les lancers francs restent autorisés.`
              : "Les positions des paniers sont conservées. Annuler ne modifie ni le chrono ni le score de départ."}
          </div>
        </section>
        {teamPanel(m.away, colors[m.away.id])}
      </div>
      <section className="history">
        <div className="panel-heading">
          <h2>
            <Activity size={16} />
            Fil du match <span className="count">{active.length}</span>
          </h2>
          <button
            className="text-button"
            disabled={!last || finished}
            onClick={undo}
          >
            <Undo2 size={15} />
            Annuler la dernière action
          </button>
        </div>
        {active.length === 0 ? (
          <p className="empty-inline">Les actions apparaîtront ici.</p>
        ) : (
          active
            .toReversed()
            .slice(0, showAll ? undefined : 6)
            .map((e) => (
              <div className="event-row" key={e.id}>
                <span className="event-time">
                  {periodName(m, e.period)} <b>{formatTime(e.remaining)}</b>
                </span>
                <span
                  className="event-symbol"
                  style={{ color: colors[e.teamId] }}
                >
                  {e.kind === "shot"
                    ? `+${e.value}`
                    : e.kind === "free"
                      ? "+1"
                      : e.kind === "foul"
                        ? "F"
                        : e.kind === "timeout"
                          ? "TM"
                          : "·"}
                </span>
                <span className="event-label">
                  <b>
                    {m.players.find((p) => p.id === e.playerId)?.name ??
                      (e.teamId === m.home.id ? m.home.name : m.away.name)}
                  </b>
                  <small>
                    {eventLabels[e.kind]} {e.foulType ?? ""}
                  </small>
                </span>
              </div>
            ))
        )}
        {active.length > 6 && (
          <button
            className="history-toggle"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Réduire" : "Toutes les actions"}
          </button>
        )}
      </section>
      {notices.length > 0 && (
        <div className="notice roster-notice">
          {notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
      {finished && (m.closingMessage || m.remarks) && (
        <section className="panel end-notes">
          <h2>Message de fin de match</h2>
          <p>{m.closingMessage || "—"}</p>
          <h3>Remarques</h3>
          <p>{m.remarks || "—"}</p>
        </section>
      )}
      <div className="bottom-actions">
        <span className="muted">
          {m.officials.map((o) => `${o.role} : ${o.name}`).join(" · ")}
        </span>
      </div>
      {adding && (
        <AddRosterPlayer
          state={state}
          team={adding === m.home.id ? m.home : m.away}
          roster={m.players}
          officials={m.officials}
          onClose={() => setAdding(null)}
          onSave={(player) => {
            try {
              const next = addMatchPlayer(getState(), m.id, player),
                changed = next.matches.find((g) => g.id === m.id)!;
              setAdding(null);
              setConfirmation({
                title: `Ajouter ${player.name} au match ?`,
                description: `Score de départ : ${m.startingScore?.home ?? 0}–${m.startingScore?.away ?? 0} → ${changed.startingScore?.home ?? 0}–${changed.startingScore?.away ?? 0}. Tous les paniers, fautes et le chronomètre sont conservés. ${matchWarnings(changed).join(" ")}`,
                run: () => {
                  try {
                    void commit(
                      addMatchPlayer(getState(), m.id, player),
                      "Joueur ajouté",
                    );
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                },
              });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
      {modal === "clock" && (
        <ClockEditor
          m={m}
          onClose={() => setModal(null)}
          onSave={(seconds) => {
            void update({
              ...current(),
              remaining: seconds,
              runningUntil: null,
            });
            setModal(null);
          }}
        />
      )}
      {modal === "officials" && (
        <OfficialsDialog
          state={state}
          m={m}
          onClose={() => setModal(null)}
          onSave={(officials) => {
            const names = officials.map((o) => o.name.trim().toLowerCase());
            if (
              officials.some((o) => !o.name.trim()) ||
              new Set(names).size !== names.length
            ) {
              toast.error(
                "Chaque poste doit être attribué à une personne différente.",
              );
              return;
            }
            void update({ ...current(), officials });
            setModal(null);
          }}
        />
      )}
      {modal === "finish" && (
        <FinishDialog
          m={m}
          onClose={() => setModal(null)}
          onSave={(closingMessage, remarks) => {
            try {
              void commit(
                finishMatch(getState(), m.id, closingMessage, remarks),
                "Match terminé · table libérée",
              );
              onFinished();
            } catch (e) {
              toast.error((e as Error).message);
              return;
            }
            setModal(null);
          }}
        />
      )}
      {(modal === "foul" || modal === "other") && p && (
        <Modal
          title={`${modal === "foul" ? "Faute" : "Action"} · ${p.name}`}
          description="Sélectionnez l’action à enregistrer."
          onClose={() => setModal(null)}
        >
          <div className="choice-grid">
            {modal === "foul"
              ? (
                  [
                    "Personnelle",
                    "Technique",
                    "Antisportive",
                    "Disqualifiante",
                  ] as const
                ).map((foulType) => (
                  <button
                    className="button secondary"
                    key={foulType}
                    onClick={() =>
                      record({
                        kind: "foul",
                        playerId: p.id,
                        teamId: p.teamId,
                        foulType,
                      })
                    }
                  >
                    {foulType}
                  </button>
                ))
              : (
                  ["rebound", "assist", "steal", "turnover", "block"] as const
                ).map((kind) => (
                  <button
                    className="button secondary"
                    key={kind}
                    onClick={() =>
                      record({ kind, playerId: p.id, teamId: p.teamId })
                    }
                  >
                    {eventLabels[kind]}
                  </button>
                ))}
          </div>
        </Modal>
      )}
      {confirmation && (
        <Confirm
          title={confirmation.title}
          description={confirmation.description}
          onClose={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.run();
            setConfirmation(null);
          }}
        />
      )}
    </>
  );
}
function ClockEditor({
  m,
  onSave,
  onClose,
}: {
  m: Match;
  onSave: (s: number) => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(Math.floor(timeLeft(m) / 60)),
    [seconds, setSeconds] = useState(timeLeft(m) % 60);
  return (
    <Modal
      title="Régler le chronomètre"
      description="Le chrono sera mis en pause. Les actions déjà saisies sont conservées."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const total = minutes * 60 + seconds;
          if (
            total >
            (m.period > m.rules.periods ? m.rules.overtime : m.rules.minutes) *
              60
          ) {
            toast.error("La durée dépasse celle de la période.");
            return;
          }
          onSave(total);
        }}
      >
        <div className="form-grid">
          <Field label="Minutes">
            <input
              type="number"
              min={0}
              max={60}
              value={minutes}
              required
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="Secondes">
            <input
              type="number"
              min={0}
              max={59}
              value={seconds}
              required
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
          </Field>
        </div>
        <button className="button primary">Appliquer</button>
      </form>
    </Modal>
  );
}
function FinishDialog({
  m,
  onSave,
  onClose,
}: {
  m: Match;
  onSave: (message: string, remarks: string) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(m.closingMessage ?? ""),
    [remarks, setRemarks] = useState(m.remarks ?? "");
  return (
    <Modal
      title="Terminer la rencontre"
      description={`${matchLabel(m)} · ${score(m, m.home.id)}–${score(m, m.away.id)}. Le chrono est en pause. Après confirmation, la table sera vide et le résultat restera consultable dans les statistiques. La feuille ne pourra plus être rouverte.`}
      onClose={onClose}
    >
      <Field label="Message de fin de match">
        <textarea
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message aux organisateurs…"
        />
      </Field>
      <Field label="Remarques">
        <textarea
          rows={5}
          maxLength={6000}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Incidents, accord adverse, particularités…"
        />
      </Field>
      {matchWarnings(m).length > 0 && (
        <div className="notice">
          {matchWarnings(m).map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      )}
      <button
        className="button primary"
        onClick={() => onSave(message, remarks)}
      >
        Terminer et libérer la table
      </button>
    </Modal>
  );
}
function OfficialsDialog({
  state,
  m,
  onSave,
  onClose,
}: {
  state: ClubState;
  m: Match;
  onSave: (o: Official[]) => void;
  onClose: () => void;
}) {
  const [officials, setOfficials] = useState(
    m.officials.length >= 3 ? m.officials : defaultOfficials(),
  );
  return (
    <Modal
      title="Officiels de la rencontre"
      description="Deux personnes à la table, un ou deux arbitres."
      onClose={onClose}
    >
      <OfficialEditor
        state={state}
        players={m.players}
        officials={officials}
        onChange={setOfficials}
      />
      <button className="button primary" onClick={() => onSave(officials)}>
        Enregistrer les officiels
      </button>
    </Modal>
  );
}
