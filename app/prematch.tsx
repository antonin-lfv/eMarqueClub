"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Shield,
  ArrowRight,
  Shirt,
  CalendarDays,
  Clock3,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  type ClubState,
  type Team,
  type Player,
  type Official,
  prepareMatch,
  calculateStartingScore,
  newMatch,
  teamColor,
  uid,
  localMatchDateTime,
  scheduledMatchTime,
  kitInk,
} from "@/lib/game";
import { Field, Picker, Modal, Confirm } from "./widgets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OfficialEditor,
  AddRosterPlayer,
  defaultOfficials,
  licenseOptions,
} from "./people";
export function Prematch({
  state,
  onStart,
  onCancel,
  canCancel,
  onSaveKnown,
}: {
  state: ClubState;
  onStart: (next: ClubState) => void;
  onCancel: () => void;
  canCancel: boolean;
  onSaveKnown: (
    id: string,
    values: { number?: number; license?: Player["license"] },
  ) => void;
}) {
  const [teams, setTeams] = useState(state.teams),
    [home, setHome] = useState(state.teams[0]?.id ?? ""),
    [away, setAway] = useState(state.teams[1]?.id ?? ""),
    [kitColors, setKitColors] = useState<Record<string, string>>({}),
    [schedule, setSchedule] = useState(() => localMatchDateTime()),
    [edits, setEdits] = useState<Record<string, Partial<Player>>>({}),
    [absent, setAbsent] = useState<string[]>([]),
    [loans, setLoans] = useState<Player[]>([]),
    [adding, setAdding] = useState<string | null>(null),
    [teamDraft, setTeamDraft] = useState<Team | null>(null),
    [officials, setOfficials] = useState<Official[]>(defaultOfficials),
    [stage, setStage] = useState<"pool" | "final">("pool"),
    [agreement, setAgreement] = useState({ home: false, away: false }),
    [confirmStart, setConfirmStart] = useState<ClubState | null>(null);
  useEffect(
    () =>
      setTeams((current) => [
        ...state.teams,
        ...current.filter((t) => !state.teams.some((x) => x.id === t.id)),
      ]),
    [state.teams],
  );
  const base = state.players.map((p) => ({
    ...p,
    ...edits[p.id],
    license: p.license ?? edits[p.id]?.license ?? "never",
  }));
  const own = base.filter(
    (p) =>
      (p.teamId === home || p.teamId === away) &&
      !loans.some((l) => l.id === p.id),
  );
  const all = [
    ...own,
    ...loans
      .filter((p) => p.teamId === home || p.teamId === away)
      .map((p) => {
        const original = state.players.find((j) => j.id === p.id);
        return original
          ? {
              ...p,
              name: original.name,
              license: original.license ?? p.license ?? "never",
              limited: original.limited,
              cap: original.cap,
              sourceTeamId: original.teamId,
            }
          : { ...p, license: p.license ?? "never" };
      }),
  ];
  const selected = all.filter((p) => !absent.includes(p.id));
  const matchTeam = (id: string, side: "home" | "away") => {
    const team = teams.find((t) => t.id === id);
    return team
      ? {
          ...team,
          color:
            kitColors[id] ??
            teamColor(team, side === "home" ? "#92c5ed" : "#f2a58c"),
        }
      : undefined;
  };
  const h = matchTeam(home, "home"),
    a = matchTeam(away, "away");
  const provisional =
    h && a && h.id !== a.id
      ? { ...newMatch("", h, a, selected, state.rules), stage }
      : null;
  const opening = provisional
    ? calculateStartingScore(provisional)
    : { home: 0, away: 0 };
  function pickTeam(side: "home" | "away", id: string) {
    if (id === (side === "home" ? home : away)) return;
    if (id === (side === "home" ? away : home)) {
      toast.error("Choisissez deux équipes différentes.");
      return;
    }
    side === "home" ? setHome(id) : setAway(id);
    setAgreement((previous) => ({ ...previous, [side]: false }));
  }
  function teamPanel(teamId: string, side: "home" | "away") {
    const team = matchTeam(teamId, side),
      ps = all.filter((p) => p.teamId === teamId),
      present = selected.filter((p) => p.teamId === teamId),
      borrowed = present.filter(
        (p) => p.sourceTeamId && p.sourceTeamId !== p.teamId,
      );
    return (
      <section
        className="prematch-team"
        style={{
          color: team
            ? `color-mix(in srgb, ${teamColor(team, side === "home" ? "#92c5ed" : "#f2a58c")} 30%, var(--foreground))`
            : undefined,
        }}
      >
        <header>
          <Shield />
          <h2>{team?.name ?? "Choisir une équipe"}</h2>
          <span>
            {present.length}/{state.rules.maxRoster ?? 10} présents
          </span>
        </header>
        <div className="attendance-head">
          <span>Présent / joueur</span>
          <span>Maillot</span>
          <span>Licence</span>
        </div>
        {ps.map((p) => {
          const original = state.players.find((j) => j.id === p.id);
          return (
            <div
              key={p.id}
              className={
                "attendance-row " + (absent.includes(p.id) ? "absent" : "")
              }
            >
              <label className="attendance-name">
                <Checkbox
                  checked={!absent.includes(p.id)}
                  onCheckedChange={(v) =>
                    setAbsent((old) =>
                      v === true
                        ? old.filter((id) => id !== p.id)
                        : [...old, p.id],
                    )
                  }
                />
                <span>
                  {p.name}
                  {p.sourceTeamId && p.sourceTeamId !== p.teamId && (
                    <small>
                      Renfort ·{" "}
                      {teams.find((t) => t.id === p.sourceTeamId)?.name}
                    </small>
                  )}
                </span>
              </label>
              <input
                className="jersey-input"
                aria-label={`Maillot ${p.name}`}
                type="number"
                min={0}
                max={99}
                placeholder="N°"
                value={p.number ?? ""}
                onChange={(e) => {
                  const number =
                    e.target.value === "" ? null : Number(e.target.value);
                  if (loans.some((l) => l.id === p.id))
                    setLoans((ls) =>
                      ls.map((l) => (l.id === p.id ? { ...l, number } : l)),
                    );
                  else
                    setEdits((x) => ({ ...x, [p.id]: { ...x[p.id], number } }));
                }}
                onBlur={() => {
                  if (
                    original?.number == null &&
                    p.number !== null &&
                    Number.isInteger(p.number) &&
                    p.number >= 0 &&
                    p.number <= 99
                  )
                    onSaveKnown(p.id, { number: p.number });
                }}
              />
              {original?.license ? (
                <span className="known-value">
                  {
                    licenseOptions.find((l) => l.value === original.license)
                      ?.label
                  }
                </span>
              ) : (
                <Picker
                  label={`Licence ${p.name}`}
                  value={p.license ?? ""}
                  onChange={(v) => {
                    const license = v as Player["license"];
                    if (original) onSaveKnown(p.id, { license });
                    if (loans.some((l) => l.id === p.id))
                      setLoans((ls) =>
                        ls.map((l) => (l.id === p.id ? { ...l, license } : l)),
                      );
                    else
                      setEdits((x) => ({
                        ...x,
                        [p.id]: { ...x[p.id], license },
                      }));
                  }}
                  options={licenseOptions}
                />
              )}
            </div>
          );
        })}
        <div className="attendance-footer">
          <button
            className="text-button"
            disabled={!team}
            onClick={() => setAdding(teamId)}
          >
            <Plus size={15} />
            Compléter depuis la base
          </button>
          <span>{borrowed.length} / 2 renforts</span>
        </div>
        {(borrowed.length > 0 || present.length < 5) && (
          <label className="agreement">
            <Checkbox
              checked={agreement[side]}
              onCheckedChange={(v) =>
                setAgreement((x) => ({ ...x, [side]: v === true }))
              }
            />
            <span>
              L’adversaire accepte de valider le score malgré l’effectif
              incomplet / les renforts.
              <small>
                Sans accord : équipe perdante selon l’article 10. Aucun score ne
                sera remplacé automatiquement.
              </small>
            </span>
          </label>
        )}
      </section>
    );
  }
  function launch() {
    try {
      if (!h || !a) throw Error("Choisissez les deux équipes.");
      if (selected.some((p) => !p.license))
        throw Error("Renseignez la licence de chaque joueur présent.");
      const next = prepareMatch(
        { ...state, teams },
        "",
        h,
        a,
        selected,
        officials,
        [],
        {
          stage,
          agreement,
          scheduledAt: scheduledMatchTime(schedule.date, schedule.time),
          kitColors: { home: h.color!, away: a.color! },
        },
      );
      const incomplete =
        selected.filter((p) => p.teamId === home).length < 5 ||
        selected.filter((p) => p.teamId === away).length < 5 ||
        selected.some((p) => p.sourceTeamId && p.sourceTeamId !== p.teamId);
      if (incomplete) setConfirmStart(next);
      else onStart(next);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="prematch">
      <div className="section-heading">
        <div>
          <h2>Avant-match</h2>
          <p>Présents, maillots, licences et officiels.</p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            setTeamDraft({ id: uid(), name: "", short: "", color: "#92c5ed" })
          }
        >
          <Plus size={16} />
          Nouvelle équipe
        </button>
        {canCancel && (
          <button className="button secondary" onClick={onCancel}>
            Retour au match
          </button>
        )}
      </div>
      <section
        className="panel match-metadata"
        aria-label="Informations de la rencontre"
      >
        <Field label="Date du match">
          <div className="schedule-input">
            <CalendarDays size={18} />
            <input
              type="date"
              required
              value={schedule.date}
              onChange={(e) =>
                setSchedule({ ...schedule, date: e.target.value })
              }
            />
          </div>
        </Field>
        <Field label="Heure prévue">
          <div className="schedule-input">
            <Clock3 size={18} />
            <input
              type="time"
              required
              value={schedule.time}
              onChange={(e) =>
                setSchedule({ ...schedule, time: e.target.value })
              }
            />
          </div>
        </Field>
        <Field label="Phase">
          <Picker
            label="Phase du tournoi"
            value={stage}
            onChange={(v) => setStage(v as typeof stage)}
            options={[
              { value: "pool", label: "Poules · pénalités activées" },
              { value: "final", label: "Phase finale · sans pénalités" },
            ]}
          />
        </Field>
      </section>
      <section className="fixture-builder">
        <div className="fixture-teams">
          {(["home", "away"] as const).map((side) => {
            const team = side === "home" ? h : a;
            const color =
              team?.color ?? (side === "home" ? "#92c5ed" : "#f2a58c");
            return (
              <section className="fixture-team-card" key={side}>
                <div className="fixture-side">
                  {side === "home"
                    ? "ÉQUIPE À DOMICILE"
                    : "ÉQUIPE À L’EXTÉRIEUR"}
                </div>
                <div className="fixture-team-choice">
                  <div
                    className="kit-preview"
                    style={{ background: color, color: kitInk(color) }}
                  >
                    <Shirt aria-hidden="true" />
                  </div>
                  <Select
                    value={side === "home" ? home : away}
                    onValueChange={(id) => pickTeam(side, id)}
                  >
                    <SelectTrigger
                      className="fixture-team-select"
                      aria-label={
                        side === "home"
                          ? "Équipe à domicile"
                          : "Équipe à l’extérieur"
                      }
                    >
                      <SelectValue placeholder="Choisir une équipe" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {teams.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          disabled={t.id === (side === "home" ? away : home)}
                        >
                          <span
                            className="team-color-dot"
                            style={{ background: teamColor(t) }}
                          />
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="kit-label">
                  <Shirt size={15} />
                  <span>Maillot pour cette rencontre</span>
                </div>
                <div className="kit-palette">
                  {[
                    { label: "Blanc", color: "#ffffff" },
                    { label: "Noir", color: "#171717" },
                    { label: "Bleu", color: "#2563eb" },
                    { label: "Rouge", color: "#dc2626" },
                    { label: "Vert", color: "#16a34a" },
                    { label: "Jaune", color: "#facc15" },
                    { label: "Orange", color: "#f97316" },
                    { label: "Violet", color: "#9333ea" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      className={
                        "kit-swatch " + (color === c.color ? "chosen" : "")
                      }
                      style={{ background: c.color }}
                      aria-label={`${c.label} · ${side === "home" ? "domicile" : "extérieur"}`}
                      aria-pressed={color === c.color}
                      title={c.label}
                      disabled={!team}
                      onClick={() =>
                        team &&
                        setKitColors((prev) => ({
                          ...prev,
                          [team.id]: c.color,
                        }))
                      }
                    />
                  ))}
                  <label className="custom-kit" title="Couleur personnalisée">
                    <input
                      type="color"
                      aria-label={`Couleur personnalisée ${side === "home" ? "domicile" : "extérieur"}`}
                      value={color}
                      disabled={!team}
                      onChange={(e) =>
                        team &&
                        setKitColors((prev) => ({
                          ...prev,
                          [team.id]: e.target.value,
                        }))
                      }
                    />
                    <span>Autre</span>
                  </label>
                </div>
                <p className="kit-hint">Cette couleur est propre au match.</p>
              </section>
            );
          })}
          <span className="fixture-versus" aria-hidden="true">
            VS
          </span>
        </div>
        {h && a && h.color === a.color && (
          <p className="kit-warning">
            Les deux équipes portent la même couleur. Choisissez des maillots
            distincts pour faciliter la saisie.
          </p>
        )}
      </section>
      <div className="setup-teams">
        {teamPanel(home, "home")}
        {teamPanel(away, "away")}
      </div>
      <p className="footnote">
        Les maillots et licences manquants sont mémorisés dès leur première
        saisie. Les informations déjà enregistrées restent en base ; un autre
        maillot peut être utilisé uniquement pour cette rencontre. Pour corriger
        une licence existante, ouvrez la fiche du joueur dans la base.
      </p>
      <OfficialEditor
        state={{ ...state, teams }}
        players={selected}
        officials={officials}
        onChange={setOfficials}
      />
      <section className="setup-launch">
        <div className="opening-score">
          <span>Score de départ</span>
          <strong>
            <span
              style={{
                color:
                  h &&
                  `color-mix(in srgb, ${teamColor(h)} 30%, var(--foreground))`,
              }}
            >
              {opening.home}
            </span>
            <em>–</em>
            <span
              style={{
                color:
                  a &&
                  `color-mix(in srgb, ${teamColor(a, "#f2a58c")} 30%, var(--foreground))`,
              }}
            >
              {opening.away}
            </span>
          </strong>
          <small>
            {stage === "pool"
              ? "Pénalités compensées entre les présents"
              : "Pas de pénalités en phase finale"}
          </small>
        </div>
        <div className="launch-detail">
          <b>
            {state.rules.periods} × {state.rules.minutes} minutes
          </b>
          <span>
            {selected.length} présents · {officials.length} officiels
          </span>
        </div>
        <button className="button primary" onClick={launch}>
          Ouvrir la table de marque
          <ArrowRight size={18} />
        </button>
      </section>
      {adding && teams.find((t) => t.id === adding) && (
        <AddRosterPlayer
          state={{ ...state, teams }}
          team={teams.find((t) => t.id === adding)!}
          roster={selected}
          officials={officials}
          onClose={() => setAdding(null)}
          onSave={(p) => {
            if (all.some((j) => j.id === p.id) && !absent.includes(p.id)) {
              toast.error("Ce joueur est déjà présent.");
              return;
            }
            setLoans((ls) => [...ls.filter((l) => l.id !== p.id), p]);
            setAbsent((ids) => ids.filter((id) => id !== p.id));
            setAdding(null);
          }}
        />
      )}
      {teamDraft && (
        <Modal
          title="Créer une équipe"
          description="Choisissez son nom et sa couleur."
          onClose={() => setTeamDraft(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTeams((ts) => [...ts, teamDraft]);
              if (!home) setHome(teamDraft.id);
              else if (!away) setAway(teamDraft.id);
              setTeamDraft(null);
            }}
          >
            <Field label="Nom">
              <input
                required
                value={teamDraft.name}
                maxLength={90}
                onChange={(e) =>
                  setTeamDraft({ ...teamDraft, name: e.target.value })
                }
              />
            </Field>
            <Field label="Abréviation">
              <input
                required
                maxLength={5}
                value={teamDraft.short}
                onChange={(e) =>
                  setTeamDraft({
                    ...teamDraft,
                    short: e.target.value.toUpperCase(),
                  })
                }
              />
            </Field>
            <Field label="Couleur">
              <input
                type="color"
                value={teamDraft.color}
                onChange={(e) =>
                  setTeamDraft({ ...teamDraft, color: e.target.value })
                }
              />
            </Field>
            <button className="button primary">Créer</button>
          </form>
        </Modal>
      )}
      {confirmStart && (
        <Confirm
          title="Confirmer l’effectif incomplet / les renforts"
          description="Vérifiez l’accord adverse. Sans cet accord, l’équipe incomplète est déclarée perdante par le règlement ; l’organisateur devra traiter le résultat. Le score joué sera conservé."
          onClose={() => setConfirmStart(null)}
          onConfirm={() => {
            onStart(confirmStart);
            setConfirmStart(null);
          }}
        />
      )}
    </div>
  );
}
