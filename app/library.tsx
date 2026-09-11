"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  Shield,
  Pencil,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  type ClubState,
  type Player,
  type Team,
  uid,
  updatePlayerInClub,
  updateTeamInClub,
  teamColor,
} from "@/lib/game";
import { Field, Modal, Picker, Confirm } from "./widgets";
export type Commit = (s: ClubState, message?: string) => Promise<boolean>;
export function PlayerForm({
  state,
  initial,
  teamId,
  onSave,
  busy,
}: {
  state: ClubState;
  initial?: Player;
  teamId?: string;
  onSave: (p: Player) => void;
  busy: boolean;
}) {
  const [p, setP] = useState<Player>(
    initial ?? {
      id: uid(),
      name: "",
      number: null,
      teamId: teamId ?? state.teams[0]?.id ?? "",
      limited: false,
      cap: null,
    },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          state.players.some(
            (o) =>
              p.number !== null &&
              o.id !== p.id &&
              o.teamId === p.teamId &&
              o.number === p.number,
          )
        ) {
          toast.error("Ce numéro est déjà utilisé dans cette équipe.");
          return;
        }
        if (!p.license) {
          toast.error("Renseignez la licence du joueur.");
          return;
        }
        onSave(p);
      }}
    >
      <Field label="Nom et prénom">
        <input
          required
          maxLength={90}
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          placeholder="Ex. Camille Dupont"
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Équipe">
          <Picker
            label="Équipe du joueur"
            value={p.teamId}
            onChange={(teamId) => setP({ ...p, teamId })}
            options={state.teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="Numéro de maillot">
          <input
            type="number"
            min={0}
            max={99}
            value={p.number ?? ""}
            onChange={(e) =>
              setP({
                ...p,
                number: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </Field>
      </div>
      <Field label="Licence de basketball">
        <Picker
          label="Statut de licence"
          value={p.license ?? ""}
          onChange={(license) =>
            setP({ ...p, license: license as Player["license"] })
          }
          options={[
            { value: "never", label: "Jamais licencié · 0 pt" },
            { value: "former", label: "Ancien licencié · 1 pt" },
            { value: "current", label: "Licencié actuel · 3 pts" },
          ]}
        />
      </Field>
      <div className="switch-field">
        <div>
          <strong>Limiter les points de ce joueur</strong>
          <small>
            Par exemple pour les joueurs de niveau National ou plus.
          </small>
        </div>
        <Switch
          checked={p.limited}
          onCheckedChange={(limited) => setP({ ...p, limited })}
          aria-label="Limiter les points hors lancers francs"
        />
      </div>
      {p.limited && (
        <Field
          label="Plafond individuel (facultatif)"
          hint={`Laissez vide pour utiliser le règlement : ${state.rules.pointCap} points hors lancers francs.`}
        >
          <input
            type="number"
            min={1}
            max={100}
            value={p.cap ?? ""}
            onChange={(e) =>
              setP({
                ...p,
                cap: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
      )}
      <div className="form-actions">
        <button
          disabled={busy || !p.teamId}
          type="submit"
          className="button primary"
        >
          {initial ? "Enregistrer" : "Ajouter le joueur"}
        </button>
      </div>
    </form>
  );
}
export function Library({
  state,
  commit,
  busy,
}: {
  state: ClubState;
  commit: Commit;
  busy: boolean;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [editPlayer, setEditPlayer] = useState<Player | null | undefined>(
      undefined,
    ),
    [team, setTeam] = useState<Team | null>(null),
    [remove, setRemove] = useState<Player | null>(null),
    [change, setChange] = useState<{
      player: Player;
      warnings: string[];
    } | null>(null);
  const players = state.players.filter(
    (p) =>
      (filter === "all" || p.teamId === filter) &&
      p.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Vos équipes. Tous vos joueurs.</h2>
          <p>Un effectif réutilisable pour chacun de vos tournois.</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            setTeam({ id: uid(), name: "", short: "", color: "#92c5ed" })
          }
        >
          <Plus size={16} />
          Créer une équipe
        </button>
      </div>
      <div className="team-cards">
        {state.teams.map((t, i) => (
          <div
            key={t.id}
            className={"team-card " + (filter === t.id ? "chosen" : "")}
          >
            <button
              className="team-select"
              onClick={() => setFilter(filter === t.id ? "all" : t.id)}
              aria-pressed={filter === t.id}
            >
              <span className="library-shield" style={{ color: teamColor(t) }}>
                <Shield />
              </span>
              <div>
                <h3>{t.name}</h3>
                <span>
                  {state.players.filter((p) => p.teamId === t.id).length}{" "}
                  joueurs · {t.short}
                </span>
              </div>
            </button>
            <button
              className="edit-team"
              aria-label={`Modifier ${t.name}`}
              onClick={() => setTeam({ ...t })}
            >
              <Pencil size={15} />
            </button>
          </div>
        ))}
      </div>
      <section className="panel library-panel">
        <div className="section-heading">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Rechercher un joueur"
              placeholder="Rechercher un joueur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="inline-actions">
            <Picker
              label="Filtrer par équipe"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Toutes les équipes" },
                ...state.teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <button
              className="button secondary"
              onClick={() => setEditPlayer(null)}
            >
              <Plus size={16} />
              Joueur
            </button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {["N°", "Joueur", "Équipe", "Licence", "Plafond hors LF", ""].map(
                (h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="jersey">{p.number}</span>
                </TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  {state.teams.find((t) => t.id === p.teamId)?.name}
                </TableCell>
                <TableCell>
                  {p.license === "current"
                    ? "Actuelle · 3 pts"
                    : p.license === "former"
                      ? "Ancienne · 1 pt"
                      : p.license === "never"
                        ? "Jamais · 0 pt"
                        : "À renseigner"}
                </TableCell>
                <TableCell>
                  {p.limited ? (
                    <span className="limit-tag">
                      {p.cap ?? state.rules.pointCap} points
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="inline-actions">
                    <button
                      className="icon-button"
                      aria-label={`Modifier ${p.name}`}
                      onClick={() => setEditPlayer(p)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Retirer ${p.name} de la base`}
                      onClick={() => setRemove(p)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!players.length && (
          <div className="empty-inline">
            <Users size={25} />
            Aucun joueur. Ajoutez votre premier joueur ou ajustez la recherche.
          </div>
        )}
      </section>
      <p className="footnote">
        Toute la base du tournoi. Les modifications sont répercutées dans les
        matchs non terminés. Une confirmation est demandée si le score de départ
        ou le plafond change. Les feuilles terminées restent figées.
      </p>
      {editPlayer !== undefined && (
        <Modal
          title={editPlayer ? "Modifier le joueur" : "Ajouter un joueur"}
          description="Les matchs non terminés sont mis à jour sans effacer leurs actions."
          onClose={() => setEditPlayer(undefined)}
        >
          <PlayerForm
            state={state}
            initial={editPlayer ?? undefined}
            teamId={filter === "all" ? undefined : filter}
            busy={busy}
            onSave={async (p) => {
              const plan = updatePlayerInClub(state, p);
              if (plan.warnings.length) {
                setChange({ player: p, warnings: plan.warnings });
                return;
              }
              if (await commit(plan.next, "Joueur mis à jour"))
                setEditPlayer(undefined);
            }}
          />
        </Modal>
      )}
      {team && (
        <Modal
          title={
            state.teams.some((t) => t.id === team.id)
              ? "Modifier l’équipe"
              : "Créer une équipe"
          }
          description="Ajoutez ensuite les joueurs de votre effectif."
          onClose={() => setTeam(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await commit(
                  updateTeamInClub(state, team),
                  "Équipe enregistrée",
                )
              )
                setTeam(null);
            }}
          >
            <Field label="Nom de l’équipe">
              <input
                required
                maxLength={90}
                autoFocus
                value={team.name}
                onChange={(e) => setTeam({ ...team, name: e.target.value })}
              />
            </Field>
            <Field label="Abréviation" hint="De 1 à 5 caractères">
              <input
                required
                maxLength={5}
                value={team.short}
                onChange={(e) =>
                  setTeam({ ...team, short: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Couleur de l’équipe">
              <input
                type="color"
                value={team.color ?? "#92c5ed"}
                onChange={(e) => setTeam({ ...team, color: e.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button disabled={busy} className="button primary">
                Enregistrer l’équipe
              </button>
            </div>
          </form>
        </Modal>
      )}
      {change && (
        <Confirm
          title="Mettre à jour les matchs en cours ?"
          description={change.warnings.join(" • ")}
          onClose={() => setChange(null)}
          onConfirm={() => {
            void commit(
              updatePlayerInClub(state, change.player).next,
              "Joueur et feuilles mis à jour",
            );
            setChange(null);
            setEditPlayer(undefined);
          }}
        />
      )}
      {remove && (
        <Confirm
          title={`Retirer ${remove.name} de la base ?`}
          description="Ses actions et ses statistiques dans les matchs existants sont conservées."
          onClose={() => setRemove(null)}
          onConfirm={() => {
            void commit(
              {
                ...state,
                players: state.players.filter((p) => p.id !== remove.id),
              },
              "Joueur retiré de la base",
            );
            setRemove(null);
          }}
        />
      )}
    </>
  );
}
