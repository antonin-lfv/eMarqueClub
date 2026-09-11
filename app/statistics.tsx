"use client";
import { useState, type CSSProperties } from "react";
import { Download, Target, Trophy, CircleDot } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  type Match,
  stats,
  periodName,
  score,
  startingPoints,
  teamColor,
  matchLabel,
} from "@/lib/game";
import { Court } from "./court";
import { Picker, download } from "./widgets";
export function Statistics({ match: m }: { match: Match }) {
  const [team, setTeam] = useState("all"),
    [player, setPlayer] = useState("all"),
    [period, setPeriod] = useState("all");
  const filtered = {
    ...m,
    events: m.events.filter(
      (e) =>
        (team === "all" || e.teamId === team) &&
        (player === "all" || e.playerId === player) &&
        (period === "all" || e.period === Number(period)),
    ),
  };
  const total = stats(filtered);
  const roster = m.players.filter(
    (p) =>
      (team === "all" || p.teamId === team) &&
      (player === "all" || p.id === player),
  );
  const shots = filtered.events.filter(
    (e) =>
      !e.voided &&
      e.made &&
      e.kind === "shot" &&
      e.x !== undefined &&
      e.y !== undefined,
  );
  function csv() {
    const esc = (v: string | number | null) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Équipe",
        "N°",
        "Joueur",
        "Points",
        "Tirs 2 pts réussis",
        "Tirs 3 pts réussis",
        "LF réussis",
        "Fautes",
        "Rebonds",
        "Passes",
        "Interceptions",
        "Balles perdues",
        "Contres",
      ],
      ...roster.map((p) => {
        const s = stats(filtered, p.id);
        return [
          p.teamId === m.home.id ? m.home.name : m.away.name,
          p.number,
          p.name,
          s.points,
          s.two[0],
          s.three[0],
          s.free[0],
          s.fouls,
          s.rebounds,
          s.assists,
          s.steals,
          s.turnovers,
          s.blocks,
        ];
      }),
    ];
    download(
      "statistiques-match.csv",
      "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div
      style={
        {
          "--blue": teamColor(m.home),
          "--coral": teamColor(m.away, "#f2a58c"),
        } as CSSProperties
      }
    >
      <div className="section-heading">
        <div>
          <h2>Chaque action compte.</h2>
          <p>Match sélectionné : {matchLabel(m)}</p>
        </div>
        <button className="button secondary" onClick={csv}>
          <Download size={16} />
          Exporter en CSV
        </button>
      </div>
      <div className="filters">
        <Picker
          label="Équipe"
          value={team}
          onChange={(t) => {
            setTeam(t);
            setPlayer("all");
          }}
          options={[
            { value: "all", label: "Les deux équipes" },
            { value: m.home.id, label: m.home.name },
            { value: m.away.id, label: m.away.name },
          ]}
        />
        <Picker
          label="Joueur"
          value={player}
          onChange={setPlayer}
          options={[
            { value: "all", label: "Tous les joueurs" },
            ...m.players
              .filter((p) => team === "all" || p.teamId === team)
              .map((p) => ({ value: p.id, label: `#${p.number} ${p.name}` })),
          ]}
        />
        <Picker
          label="Période"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "all", label: "Toutes les périodes" },
            ...Array.from({ length: m.period }, (_, i) => ({
              value: String(i + 1),
              label: periodName(m, i + 1),
            })),
          ]}
        />
      </div>
      <div className="stat-cards">
        {[
          { label: "Points marqués", value: total.points, icon: Trophy },
          {
            label: "Tirs réussis",
            value: total.made,
            icon: Target,
          },
          {
            label: "Lancers francs",
            value: total.free[0],
            icon: CircleDot,
          },
        ].map((v) => (
          <div className="stat-card" key={v.label}>
            <v.icon size={19} />
            <span>{v.label}</span>
            <strong>{v.value}</strong>
          </div>
        ))}
      </div>
      <div className="stats-layout">
        <section className="panel shot-chart">
          <div className="section-heading">
            <h2>Carte des tirs</h2>
            <span className="muted">{shots.length} paniers</span>
          </div>
          <Court
            shots={shots.map((e) => ({
              id: e.id,
              x: e.x!,
              y: e.y!,
              made: !!e.made,
              color:
                e.teamId === m.home.id
                  ? teamColor(m.home)
                  : teamColor(m.away, "#f2a58c"),
            }))}
          />
          <div className="chart-legend">
            <span className="blue">● {m.home.name}</span>
            <span className="coral">● {m.away.name}</span>
          </div>
          <p className="footnote">
            Positions réelles sur le terrain, changements de côté inclus. Les
            lancers francs sont comptés séparément.
          </p>
        </section>
        <section className="panel">
          <h2>Score par période</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Équipe</TableHead>
                <TableHead>Départ</TableHead>
                {Array.from({ length: m.period }, (_, i) => (
                  <TableHead key={i}>{periodName(m, i + 1)}</TableHead>
                ))}
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[m.home, m.away].map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.short}</TableCell>
                  <TableCell>{startingPoints(m, t.id)}</TableCell>
                  {Array.from({ length: m.period }, (_, i) => (
                    <TableCell key={i}>
                      {
                        stats(
                          {
                            ...m,
                            events: m.events.filter((e) => e.period === i + 1),
                          },
                          undefined,
                          t.id,
                        ).points
                      }
                    </TableCell>
                  ))}
                  <TableCell>
                    <strong>{score(m, t.id)}</strong>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="footnote">
            Le total inclut le score de départ. Les points de pénalité ne sont
            pas attribués aux joueurs. Les filtres s’appliquent à la carte et
            aux statistiques individuelles.
          </p>
        </section>
      </div>
      {(m.closingMessage || m.remarks) && (
        <section className="panel end-notes">
          <h2>Message de fin de match</h2>
          <p>{m.closingMessage || "—"}</p>
          <h3>Remarques</h3>
          <p>{m.remarks || "—"}</p>
        </section>
      )}
      <section className="panel stats-table">
        <h2>Feuille de statistiques</h2>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Joueur",
                "PTS",
                "2 pts",
                "3 pts",
                "LF",
                "F",
                "REB",
                "PD",
                "INT",
                "BP",
                "CTR",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((p) => {
              const s = stats(filtered, p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className={p.teamId === m.home.id ? "blue" : "coral"}>
                      #{p.number}
                    </span>{" "}
                    {p.name}
                  </TableCell>
                  <TableCell>
                    <strong>{s.points}</strong>
                  </TableCell>
                  <TableCell>{s.two[0]}</TableCell>
                  <TableCell>{s.three[0]}</TableCell>
                  <TableCell>{s.free[0]}</TableCell>
                  <TableCell>{s.fouls}</TableCell>
                  <TableCell>{s.rebounds}</TableCell>
                  <TableCell>{s.assists}</TableCell>
                  <TableCell>{s.steals}</TableCell>
                  <TableCell>{s.turnovers}</TableCell>
                  <TableCell>{s.blocks}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="footnote">
          F : fautes · REB : rebonds · PD : passes décisives · INT :
          interceptions · BP : balles perdues · CTR : contres
        </p>
      </section>
    </div>
  );
}
