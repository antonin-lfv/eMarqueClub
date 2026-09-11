"use client";
import { useEffect, useState } from "react";
import { Plus, Shield, ArrowRight, Trash2 } from "lucide-react";
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
} from "@/lib/game";
import { Field, Picker, Modal, Confirm } from "./widgets";
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
    [edits, setEdits] = useState<Record<string, Partial<Player>>>({}),
    [absent, setAbsent] = useState<string[]>([]),
    [loans, setLoans] = useState<Player[]>([]),
    [adding, setAdding] = useState<string | null>(null),
    [teamDraft, setTeamDraft] = useState<Team | null>(null),
    [officials, setOfficials] = useState<Official[]>(defaultOfficials),
    [stage, setStage] = useState<"pool" | "final">("pool"),
    [agreement, setAgreement] = useState({ home: false, away: false }),
    [pendingTeam, setPendingTeam] = useState<{
      side: "home" | "away";
      id: string;
    } | null>(null),
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
    license: p.license ?? edits[p.id]?.license,
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
              license: original.license ?? p.license,
              limited: original.limited,
              cap: original.cap,
              sourceTeamId: original.teamId,
            }
          : p;
      }),
  ];
  const selected = all.filter((p) => !absent.includes(p.id));
  const h = teams.find((t) => t.id === home),
    a = teams.find((t) => t.id === away);
  const provisional =
    h && a && h.id !== a.id
      ? { ...newMatch("", h, a, selected, state.rules), stage }
      : null;
  const opening = provisional
    ? calculateStartingScore(provisional)
    : { home: 0, away: 0 };
  function pickTeam(side: "home" | "away", id: string) {
    if (id === (side === "home" ? away : home)) {
      toast.error("Choisissez deux équipes différentes.");
      return;
    }
    if (!(side === "home" ? home : away)) {
      side === "home" ? setHome(id) : setAway(id);
      return;
    }
    setPendingTeam({ side, id });
  }
  function teamPanel(teamId: string, side: "home" | "away") {
    const team = teams.find((t) => t.id === teamId),
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
            ? teamColor(team, side === "home" ? "#92c5ed" : "#f2a58c")
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
        { stage, agreement },
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
        {canCancel && (
          <button className="button secondary" onClick={onCancel}>
            Retour au match
          </button>
        )}
      </div>
      <section className="panel setup-meta">
        <Field label="Domicile">
          <Picker
            label="Domicile"
            value={home}
            onChange={(id) => pickTeam("home", id)}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="Extérieur">
          <Picker
            label="Extérieur"
            value={away}
            onChange={(id) => pickTeam("away", id)}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
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
        <button
          className="button secondary"
          onClick={() =>
            setTeamDraft({ id: uid(), name: "", short: "", color: "#92c5ed" })
          }
        >
          <Plus size={15} />
          Équipe
        </button>
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
            <span style={{ color: h && teamColor(h) }}>{opening.home}</span>
            <em>–</em>
            <span style={{ color: a && teamColor(a, "#f2a58c") }}>
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
      {pendingTeam && (
        <Confirm
          title="Changer l’équipe de cette préparation ?"
          description="Les sélections de l’équipe remplacée seront écartées de cette préparation. Aucun match enregistré, score ou chronomètre ne sera remis à zéro."
          onClose={() => setPendingTeam(null)}
          onConfirm={() => {
            pendingTeam.side === "home"
              ? setHome(pendingTeam.id)
              : setAway(pendingTeam.id);
            setAgreement((x) => ({ ...x, [pendingTeam.side]: false }));
            setPendingTeam(null);
          }}
        />
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
