"use client";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  type ClubState,
  type Player,
  type Official,
  type Team,
  uid,
} from "@/lib/game";
import { Modal, Field, Picker } from "./widgets";
import { PlayerForm } from "./library";
export const licenseOptions = [
  { value: "never", label: "Jamais licencié · 0 pt" },
  { value: "former", label: "Ancien licencié · 1 pt" },
  { value: "current", label: "Licencié actuel · 3 pts" },
];
export function PlayerSearch({
  players,
  teams,
  value,
  onSelect,
  label,
}: {
  players: Player[];
  teams: Team[];
  value: string | null;
  onSelect: (p: Player | null) => void;
  label: string;
}) {
  const [team, setTeam] = useState("all");
  const visible = players.filter((p) => team === "all" || p.teamId === team);
  return (
    <div className="person-search">
      <Picker
        label={`Équipe — ${label}`}
        value={team}
        onChange={(t) => {
          setTeam(t);
          onSelect(null);
        }}
        options={[
          { value: "all", label: "Toutes les équipes" },
          ...teams.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />
      <Combobox<Player>
        items={visible}
        value={players.find((p) => p.id === value) ?? null}
        itemToStringLabel={(p) => p?.name ?? ""}
        isItemEqualToValue={(a, b) => a.id === b.id}
        onValueChange={(p) => onSelect(p)}
      >
        <ComboboxInput
          aria-label={label}
          placeholder="Rechercher nom ou prénom…"
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>Aucun joueur trouvé.</ComboboxEmpty>
          <ComboboxList>
            {(p: Player) => (
              <ComboboxItem key={p.id} value={p}>
                <span>
                  {p.name}
                  <small className="person-team">
                    {teams.find((t) => t.id === p.teamId)?.name ??
                      "Sans équipe"}{" "}
                    · #{p.number ?? "—"}
                  </small>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
export function OfficialEditor({
  state,
  players,
  officials,
  onChange,
}: {
  state: ClubState;
  players: Player[];
  officials: Official[];
  onChange: (o: Official[]) => void;
}) {
  const [manual, setManual] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(officials.map((o, i) => [i, !o.playerId && !!o.name])),
  );
  const available = state.players.filter(
    (p) => !players.some((j) => j.id === p.id),
  );
  return (
    <section className="panel officials-setup">
      <div className="section-heading">
        <div>
          <h2>La table et les arbitres</h2>
          <p>Choisissez les joueurs par équipe et par nom.</p>
        </div>
        <label className="second-referee">
          <Switch
            checked={officials.length === 4}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [
                      ...officials,
                      { id: uid(), name: "", role: "Arbitre", playerId: null },
                    ]
                  : officials.slice(0, 3),
              )
            }
            aria-label="Deuxième arbitre"
          />
          Deux arbitres
        </label>
      </div>
      <div className="official-slots">
        {officials.map((o, i) => (
          <div className="official-slot" key={i}>
            <h3>
              {i === 0
                ? "Marqueur"
                : i === 1
                  ? "Chronométreur"
                  : `Arbitre ${i - 1}`}
            </h3>
            <div className="inline-actions">
              <button
                className={
                  !manual[i] ? "text-button chosen-mode" : "text-button"
                }
                onClick={() => setManual((v) => ({ ...v, [i]: false }))}
              >
                Joueur de la base
              </button>
              <button
                className={
                  manual[i] ? "text-button chosen-mode" : "text-button"
                }
                onClick={() => {
                  setManual((v) => ({ ...v, [i]: true }));
                  onChange(
                    officials.map((x, n) =>
                      n === i
                        ? { ...x, id: uid(), playerId: null, name: "" }
                        : x,
                    ),
                  );
                }}
              >
                À la volée
              </button>
            </div>
            {manual[i] ? (
              <input
                className="official-name"
                aria-label={`Nom ${o.role} ${i}`}
                placeholder="Nom et prénom"
                value={o.name}
                maxLength={90}
                onChange={(e) =>
                  onChange(
                    officials.map((x, n) =>
                      n === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            ) : (
              <PlayerSearch
                label={`${o.role} ${i}`}
                teams={state.teams}
                players={available}
                value={o.playerId}
                onSelect={(p) =>
                  onChange(
                    officials.map((x, n) =>
                      n === i
                        ? {
                            ...x,
                            id:
                              state.officials.find((o) => o.playerId === p?.id)
                                ?.id ?? uid(),
                            name: p?.name ?? "",
                            playerId: p?.id ?? null,
                          }
                        : x,
                    ),
                  )
                }
              />
            )}
            <span className="muted">{o.name || "Poste à attribuer"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
export const defaultOfficials = (): Official[] =>
  ["Marqueur", "Chronométreur", "Arbitre", "Arbitre"].map((role) => ({
    id: uid(),
    name: "",
    role: role as Official["role"],
    playerId: null,
  }));
export function AddRosterPlayer({
  state,
  team,
  roster,
  officials,
  onSave,
  onClose,
}: {
  state: ClubState;
  team: Team;
  roster: Player[];
  officials: Official[];
  onSave: (p: Player) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState("existing"),
    [chosen, setChosen] = useState<Player | null>(null),
    [number, setNumber] = useState<number | null>(null),
    [license, setLicense] = useState<Player["license"]>(),
    [extra, setExtra] = useState(false);
  const available = state.players.filter(
    (p) =>
      !roster.some((j) => j.id === p.id) &&
      !officials.some((o) => o.playerId === p.id),
  );
  return (
    <Modal
      title={`Compléter ${team.name}`}
      description="Choisissez un joueur de la base. Son équipe d’origine sera conservée et aucun panier ni chrono ne sera remis à zéro."
      onClose={onClose}
    >
      <Picker
        label="Mode d’ajout"
        value={mode}
        onChange={setMode}
        options={[
          {
            value: "existing",
            label: "Choisir un joueur / renfort dans la base",
          },
          { value: "new", label: "Créer une personne à la volée" },
        ]}
      />
      {mode === "existing" ? (
        <>
          <PlayerSearch
            label="Joueur à ajouter"
            players={available}
            teams={state.teams}
            value={chosen?.id ?? null}
            onSelect={(p) => {
              setChosen(p);
              setNumber(p?.number ?? null);
              setLicense(p?.license);
            }}
          />
          {chosen && (
            <>
              <Field
                label="Maillot pour ce match"
                hint="Le numéro en base reste inchangé s’il est déjà renseigné."
              >
                <input
                  type="number"
                  min={0}
                  max={99}
                  required
                  value={number ?? ""}
                  onChange={(e) =>
                    setNumber(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Licence">
                {chosen.license ? (
                  <span className="known-value">
                    {
                      licenseOptions.find((o) => o.value === chosen.license)
                        ?.label
                    }{" "}
                    · enregistrée
                  </span>
                ) : (
                  <Picker
                    label="Licence"
                    value={license ?? ""}
                    onChange={(v) => setLicense(v as Player["license"])}
                    options={licenseOptions}
                  />
                )}
              </Field>
              <button
                className="button primary"
                disabled={number === null || !license}
                onClick={() =>
                  onSave({
                    ...chosen,
                    number,
                    license,
                    teamId: team.id,
                    sourceTeamId: chosen.teamId,
                    extraPenalty: extra ? 1 : 0,
                  })
                }
              >
                Ajouter au match
              </button>
            </>
          )}
        </>
      ) : (
        <PlayerForm
          state={{ ...state, teams: [team] }}
          teamId={team.id}
          busy={false}
          onSave={(p) =>
            onSave({ ...p, sourceTeamId: team.id, extraPenalty: extra ? 1 : 0 })
          }
        />
      )}
      <label className="penalty-checkbox">
        <Checkbox
          checked={extra}
          onCheckedChange={(v) => setExtra(v === true)}
        />
        Nouvel arrivant au tournoi : +1 point de pénalité sur ce match (poules).
      </label>
    </Modal>
  );
}
