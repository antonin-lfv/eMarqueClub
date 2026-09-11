"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Shield,
  Check,
  ArrowRight,
  Users,
  ClipboardList,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  type ClubState,
  type Team,
  type Player,
  type Official,
  penaltyPoints,
  prepareMatch,
  uid,
} from "@/lib/game";
import { Field, Picker, Modal } from "./widgets";
import { PlayerForm } from "./library";
const licenses = [
  { value: "never", label: "Jamais · 0 pt" },
  { value: "former", label: "Ancien · 1 pt" },
  { value: "current", label: "Actuel · 3 pts" },
];
export function Prematch({
  state,
  onStart,
  onCancel,
}: {
  state: ClubState;
  onStart: (next: ClubState) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("Match amical"),
    [teams, setTeams] = useState(state.teams),
    [players, setPlayers] = useState(state.players),
    [home, setHome] = useState(state.teams[0]?.id ?? ""),
    [away, setAway] = useState(state.teams[1]?.id ?? ""),
    [absent, setAbsent] = useState<string[]>([]),
    [starters, setStarters] = useState<Record<string, string[]>>({}),
    [adding, setAdding] = useState<string | null>(null),
    [teamDraft, setTeamDraft] = useState<Team | null>(null);
  const [officials, setOfficials] = useState<Official[]>(
      ["Marqueur", "Chronométreur", "Arbitre"].map((role) => ({
        id: uid(),
        name: "",
        role: role as Official["role"],
        playerId: null,
      })),
    ),
    [sources, setSources] = useState<Record<number, string>>({});
  useEffect(() => {
    setTeams((current) => [
      ...current,
      ...state.teams.filter((t) => !current.some((x) => x.id === t.id)),
    ]);
    setPlayers((current) => [
      ...current,
      ...state.players.filter((p) => !current.some((x) => x.id === p.id)),
    ]);
  }, [state.teams, state.players]);
  const roster = (teamId: string) =>
    players.filter((p) => p.teamId === teamId && !absent.includes(p.id));
  const selected = players.filter(
    (p) => (p.teamId === home || p.teamId === away) && !absent.includes(p.id),
  );
  const initial = (teamId: string) => {
    const ids = roster(teamId).map((p) => p.id);
    const saved = starters[teamId] ?? ids.slice(0, state.rules.onCourt);
    return saved.filter((id) => ids.includes(id));
  };
  const penalty = (teamId: string) =>
    roster(teamId).reduce((n, p) => n + penaltyPoints(p), 0);
  const a = penalty(home),
    b = penalty(away);
  const setPlayer = (id: string, change: Partial<Player>) =>
    setPlayers((current) =>
      current.map((p) => (p.id === id ? { ...p, ...change } : p)),
    );
  function presence(p: Player, checked: boolean) {
    setAbsent((current) =>
      checked ? current.filter((id) => id !== p.id) : [...current, p.id],
    );
    setStarters((current) => {
      let list = initial(p.teamId).filter((id) => id !== p.id);
      if (checked && list.length < state.rules.onCourt) list = [...list, p.id];
      if (!checked) {
        const replacement = roster(p.teamId).find(
          (j) => j.id !== p.id && !list.includes(j.id),
        );
        if (replacement && list.length < state.rules.onCourt)
          list.push(replacement.id);
      }
      return { ...current, [p.teamId]: list };
    });
  }
  function teamPanel(teamId: string, side: string) {
    const team = teams.find((t) => t.id === teamId);
    return (
      <section className={"prematch-team " + side}>
        <header>
          <Shield size={21} />
          <h2>{team?.name ?? "Choisir une équipe"}</h2>
          <span>
            {roster(teamId).length} présents · {penalty(teamId)} pts
          </span>
        </header>
        <div className="attendance-head">
          <span>Présent / joueur</span>
          <span>Maillot</span>
          <span>Licence</span>
          <span>Départ</span>
        </div>
        {players
          .filter((p) => p.teamId === teamId)
          .map((p) => {
            const present = !absent.includes(p.id);
            return (
              <div
                className={"attendance-row " + (!present ? "absent" : "")}
                key={p.id}
              >
                <label className="attendance-name">
                  <Checkbox
                    checked={present}
                    onCheckedChange={(checked) => presence(p, checked === true)}
                    aria-label={`${p.name} présent`}
                  />
                  <span>
                    {p.name}
                    {p.limited && (
                      <small>
                        Plafond {p.cap ?? state.rules.pointCap} hors LF
                      </small>
                    )}
                  </span>
                </label>
                <input
                  className="jersey-input"
                  aria-label={`Maillot de ${p.name}`}
                  type="number"
                  min={0}
                  max={99}
                  placeholder="N°"
                  value={p.number ?? ""}
                  onChange={(e) =>
                    setPlayer(p.id, {
                      number:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <Picker
                  label={`Licence de ${p.name}`}
                  value={p.license ?? "never"}
                  onChange={(license) =>
                    setPlayer(p.id, { license: license as Player["license"] })
                  }
                  options={licenses}
                />
                <button
                  type="button"
                  className={
                    "starter-toggle " +
                    (initial(teamId).includes(p.id) ? "active" : "")
                  }
                  disabled={!present}
                  aria-label={`${p.name} titulaire`}
                  aria-pressed={initial(teamId).includes(p.id)}
                  onClick={() =>
                    setStarters((current) => ({
                      ...current,
                      [teamId]: initial(teamId).includes(p.id)
                        ? initial(teamId).filter((id) => id !== p.id)
                        : [...initial(teamId), p.id],
                    }))
                  }
                >
                  <Check size={16} />
                </button>
              </div>
            );
          })}
        <div className="attendance-footer">
          <button
            className="text-button"
            onClick={() => setAdding(teamId)}
            disabled={!team}
          >
            <Plus size={15} />
            Ajouter un joueur
          </button>
          <span>
            {initial(teamId).length}/
            {Math.min(state.rules.onCourt, roster(teamId).length)} titulaires
          </span>
        </div>
      </section>
    );
  }
  return (
    <div className="prematch">
      <div className="section-heading">
        <div>
          <h2>Tout est prêt avant l’entre-deux.</h2>
          <p>
            Cochez les présents, vérifiez les maillots et attribuez les postes.
          </p>
        </div>
        <button className="button secondary" onClick={onCancel}>
          Retour au match
        </button>
      </div>
      <section className="panel setup-meta">
        <Field label="Nom du match">
          <input
            value={title}
            maxLength={90}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Domicile">
          <Picker
            label="Équipe à domicile"
            value={home}
            onChange={setHome}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="Extérieur">
          <Picker
            label="Équipe à l’extérieur"
            value={away}
            onChange={setAway}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <button
          className="button secondary"
          onClick={() => setTeamDraft({ id: uid(), name: "", short: "" })}
        >
          <Plus size={16} />
          Équipe
        </button>
      </section>
      <div className="setup-teams">
        {teamPanel(home, "blue")}
        {teamPanel(away, "coral")}
      </div>
      <p className="footnote">
        Les numéros et statuts renseignés pour les joueurs présents sont
        mémorisés pour les prochains matchs. « Départ » indique les joueurs sur
        le terrain à l’entre-deux.
      </p>
      <section className="panel officials-setup">
        <div className="section-heading">
          <div>
            <h2>La table et les arbitres</h2>
            <p>Deux personnes à la table · Un ou deux arbitres</p>
          </div>
          <label className="second-referee">
            <Switch
              checked={officials.length === 4}
              onCheckedChange={(checked) =>
                setOfficials((o) =>
                  checked
                    ? [
                        ...o,
                        {
                          id: uid(),
                          name: "",
                          role: "Arbitre",
                          playerId: null,
                        },
                      ]
                    : o.slice(0, 3),
                )
              }
              aria-label="Deuxième arbitre"
            />
            Deuxième arbitre
          </label>
        </div>
        <div className="official-slots">
          {officials.map((o, index) => {
            const people = [
              ...state.officials
                .filter(
                  (saved) =>
                    !saved.playerId ||
                    !selected.some((p) => p.id === saved.playerId),
                )
                .map((saved) => ({
                  value: "official:" + saved.id,
                  label: saved.name,
                  name: saved.name,
                  playerId: saved.playerId,
                  id: saved.id,
                })),
              ...players
                .filter((p) => !selected.some((j) => j.id === p.id))
                .map((p) => ({
                  value: "player:" + p.id,
                  label:
                    p.name +
                    " · " +
                    (teams.find((t) => t.id === p.teamId)?.name ?? "Joueur"),
                  name: p.name,
                  playerId: p.id,
                  id:
                    state.officials.find((o) => o.playerId === p.id)?.id ??
                    uid(),
                })),
            ];
            return (
              <div className="official-slot" key={index}>
                <h3>
                  {index === 0
                    ? "01 · Marqueur"
                    : index === 1
                      ? "02 · Chronométreur"
                      : `${index - 1 === 1 ? "01" : "02"} · Arbitre`}
                </h3>
                <Picker
                  label={`Choisir ${o.role} ${index}`}
                  value={sources[index] ?? "new"}
                  onChange={(value) => {
                    setSources((s) => ({ ...s, [index]: value }));
                    const person = people.find((p) => p.value === value);
                    setOfficials((all) =>
                      all.map((o, i) =>
                        i === index
                          ? {
                              ...o,
                              id: person?.id ?? uid(),
                              name: person?.name ?? "",
                              playerId: person?.playerId ?? null,
                            }
                          : o,
                      ),
                    );
                  }}
                  options={[
                    { value: "new", label: "Saisir un nom" },
                    ...people,
                  ]}
                />
                {(!sources[index] || sources[index] === "new") && (
                  <input
                    className="official-name"
                    aria-label={`Nom ${o.role} ${index}`}
                    placeholder="Nom et prénom"
                    maxLength={90}
                    value={o.name}
                    onChange={(e) =>
                      setOfficials((all) =>
                        all.map((o, i) =>
                          i === index ? { ...o, name: e.target.value } : o,
                        ),
                      )
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="setup-launch">
        <div className="opening-score">
          <span>Score de départ</span>
          <strong>
            <span className="blue">{Math.max(0, b - a)}</span>
            <em>–</em>
            <span className="coral">{Math.max(0, a - b)}</span>
          </strong>
          <small>
            {a} pts de pénalité contre {b} · Écart compensé
          </small>
        </div>
        <div className="launch-detail">
          <b>
            {state.rules.periods} × {state.rules.minutes} minutes
          </b>
          <span>
            {selected.length} joueurs présents · {officials.length} officiels
          </span>
        </div>
        <button
          className="button primary"
          onClick={() => {
            try {
              if (!title.trim()) throw Error("Donnez un nom au match.");
              const h = teams.find((t) => t.id === home),
                a = teams.find((t) => t.id === away);
              if (!h || !a) throw Error("Choisissez deux équipes.");
              onStart(
                prepareMatch(
                  { ...state, teams },
                  title,
                  h,
                  a,
                  selected,
                  officials,
                  [...initial(home), ...initial(away)],
                ),
              );
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Ouvrir la table de marque
          <ArrowRight size={18} />
        </button>
      </section>
      {adding && (
        <Modal
          title="Ajouter un joueur"
          description="Il sera présent au match et enregistré dans la base au lancement."
          onClose={() => setAdding(null)}
        >
          <PlayerForm
            state={{
              ...state,
              teams: teams.filter((t) => t.id === adding),
              players,
            }}
            teamId={adding}
            busy={false}
            onSave={(p) => {
              setPlayers((all) => [...all, p]);
              setAdding(null);
            }}
          />
        </Modal>
      )}
      {teamDraft && (
        <Modal
          title="Créer une équipe"
          description="Elle sera enregistrée avec la préparation du match."
          onClose={() => setTeamDraft(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTeams((t) => [...t, teamDraft]);
              if (!home) setHome(teamDraft.id);
              else setAway(teamDraft.id);
              setTeamDraft(null);
            }}
          >
            <Field label="Nom">
              <input
                required
                maxLength={90}
                value={teamDraft.name}
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
            <button className="button primary">Ajouter l’équipe</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
