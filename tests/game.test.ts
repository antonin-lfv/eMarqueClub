import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fixtureState } from "./fixture.ts";
import {
  initialState,
  finishMatch,
  resetTable,
  localMatchDateTime,
  scheduledMatchTime,
  matchDateLabel,
  courtSides,
  teamFouls,
  startingPoints,
  removeDemo,
  prepareMatch,
  calculateStartingScore,
  score,
  stats,
  addEvent,
  undoLast,
  adjustClock,
  timeLeft,
  nextPeriod,
  timeoutsUsed,
  excluded,
  updatePlayerInClub,
  updateTeamInClub,
  addMatchPlayer,
  stateSchema,
  shotValue,
  type Official,
  type Player,
} from "../lib/game.ts";
const officials: Official[] = [
  "Marqueur",
  "Chronométreur",
  "Arbitre",
  "Arbitre",
].map((role, i) => ({
  id: `o${i}`,
  name: `Personne ${i}`,
  role: role as Official["role"],
  playerId: null,
}));
function setup() {
  const s = fixtureState();
  s.matches = [];
  s.activeId = null;
  s.players[0].license = "current";
  s.players[1].license = "former";
  s.players[6].license = "current";
  s.players[7].license = "current";
  s.players[8].license = "former";
  return prepareMatch(s, "", s.teams[0], s.teams[1], s.players, officials);
}
const basket = (playerId = "demo-0", teamId = "aigles") => ({
  kind: "shot" as const,
  playerId,
  teamId,
  value: 2,
  made: true,
  x: 25,
  y: 7.5,
});
const loan = (i = 1): Player => ({
  id: `loan${i}`,
  name: `Renfort ${i}`,
  teamId: "aigles",
  sourceTeamId: "third",
  number: 40 + i,
  license: "current",
  limited: false,
  cap: null,
});
describe("Feuilles Corpo", () => {
  it("starts empty and removes only the demo while retaining real matches and library", () => {
    assert.equal(stateSchema.parse(initialState()).activeId, null);
    const s = setup();
    s.matches.push({ ...s.matches[0], id: "demo" });
    s.activeId = "demo";
    const next = removeDemo(s);
    assert.equal(next.matches.length, 1);
    assert.equal(next.activeId, null);
    assert.deepEqual(next.players, s.players);
  });
  it("compensates 4 versus 7 as 3–0 without assigning handicap to player statistics", () => {
    const m = setup().matches[0];
    assert.deepEqual(m.startingScore, { home: 3, away: 0 });
    const after = addEvent(m, basket());
    assert.equal(score(after, "aigles"), 5);
    assert.equal(stats(after, "demo-0").points, 2);
    assert.equal(score(undoLast(after), "aigles"), 3);
  });
  it("removes penalties for finals and includes match-only arrival penalties in pools", () => {
    const m = setup().matches[0];
    m.players[0].extraPenalty = 1;
    assert.deepEqual(calculateStartingScore(m), { home: 2, away: 0 });
    m.stage = "final";
    assert.deepEqual(calculateStartingScore(m), { home: 0, away: 0 });
  });
  it("allows any present player to score and rejects misses and substitutions", () => {
    const m = setup().matches[0];
    assert.equal(m.initial, undefined);
    assert.equal(stats(addEvent(m, basket("demo-5")), "demo-5").points, 2);
    assert.throws(() => addEvent(m, { ...basket(), made: false }), /marqués/);
    assert.throws(
      () => addEvent(m, { kind: "sub", teamId: "aigles", playerId: "demo-0" }),
      /changements/,
    );
  });
  it("keeps field-point caps, permits free throws beyond the cap, and undoes instantly", () => {
    let m = setup().matches[0];
    for (let i = 0; i < 6; i++) m = addEvent(m, basket());
    assert.throws(() => addEvent(m, basket()), /Plafond/);
    m = addEvent(m, {
      kind: "free",
      teamId: "aigles",
      playerId: "demo-0",
      value: 1,
      made: true,
    });
    assert.equal(stats(m, "demo-0").points, 13);
    assert.equal(stats(undoLast(m), "demo-0").points, 12);
  });
  it("excludes after four personal fouls or two unsportsmanlike fouls", () => {
    for (const type of ["Personnelle", "Antisportive"] as const) {
      let m = setup().matches[0];
      for (let i = 0; i < (type === "Personnelle" ? 4 : 2); i++)
        m = addEvent(m, {
          kind: "foul",
          teamId: "aigles",
          playerId: "demo-0",
          foulType: type,
        });
      assert.ok(excluded(m, "demo-0"));
      assert.throws(() => addEvent(m, basket()), /exclu/);
    }
  });
  it("tracks one timeout each half and restores it when undone", () => {
    let m = setup().matches[0];
    m = addEvent(m, { kind: "timeout", teamId: "aigles", playerId: "" });
    assert.equal(timeoutsUsed(m, "aigles"), 1);
    assert.throws(
      () => addEvent(m, { kind: "timeout", teamId: "aigles", playerId: "" }),
      /utilisés/,
    );
    assert.equal(timeoutsUsed(undoLast(m), "aigles"), 0);
    m.period = 2;
    assert.equal(timeoutsUsed(m, "aigles"), 0);
  });
  it("uses running Corpo time until final two minutes; free throws always pause", () => {
    let m = setup().matches[0];
    m.runningUntil = 301000;
    const foul = {
      kind: "foul" as const,
      teamId: "aigles",
      playerId: "demo-0",
      foulType: "Personnelle" as const,
    };
    assert.equal(addEvent(m, foul, 1000).runningUntil, 301000);
    m.period = 2;
    m.runningUntil = 121000;
    assert.equal(addEvent(m, foul, 1000).runningUntil, null);
    assert.equal(
      addEvent(
        { ...m, period: 1 },
        {
          kind: "free",
          teamId: "aigles",
          playerId: "demo-0",
          made: true,
          value: 1,
        },
        1000,
      ).runningUntil,
      null,
    );
  });
  it("adjusts clocks within period bounds without changing event timestamps", () => {
    let m = addEvent(setup().matches[0], basket());
    const events = m.events;
    m.remaining = 100;
    m = adjustClock(m, 10, 1000);
    assert.equal(m.remaining, 110);
    m.runningUntil = 101000;
    m = adjustClock(m, -10, 1000);
    assert.equal(timeLeft(m, 1000), 90);
    assert.equal(adjustClock(m, -1000, 1000).runningUntil, null);
    assert.equal(adjustClock(m, 1000, 1000).remaining, 600);
    assert.deepEqual(m.events, events);
  });
  it("starts overtime only on a tied total score and preserves made baskets", () => {
    let m = setup().matches[0];
    m.remaining = 0;
    m.period = 2;
    assert.throws(() => nextPeriod(m), /égalité/);
    m.startingScore = { home: 0, away: 0 };
    assert.equal(nextPeriod(m).remaining, 180);
  });
  it("uses basket position to value shots and reverses ends after halftime", () => {
    const m = setup().matches[0];
    assert.equal(shotValue(m, "aigles", 2, 7.5), 2);
    assert.equal(shotValue(m, "aigles", 14, 7.5), 3);
    m.period = 2;
    assert.equal(shotValue(m, "aigles", 26, 7.5), 2);
  });
  it("requires unique valid jerseys and known licenses, with no starters required", () => {
    for (const value of [null, 5, 100]) {
      const s = fixtureState();
      s.players[0].number = value;
      assert.throws(
        () => prepareMatch(s, "", s.teams[0], s.teams[1], s.players, officials),
        /maillot/,
      );
    }
    const s = fixtureState();
    s.players[0].license = undefined;
    assert.throws(
      () => prepareMatch(s, "", s.teams[0], s.teams[1], s.players, officials),
      /licence/,
    );
  });
  it("requires two table staff and one or two distinct referees, outside the present roster", () => {
    const s = fixtureState(),
      run = (o: Official[]) =>
        prepareMatch(s, "", s.teams[0], s.teams[1], s.players, o);
    assert.doesNotThrow(() => run(officials.slice(0, 3)));
    assert.throws(() => run(officials.slice(1)), /deux personnes/);
    assert.throws(() =>
      run([officials[0], officials[0], ...officials.slice(2)]),
    );
    assert.throws(
      () =>
        run(
          officials.map((o, i) =>
            i === 0 ? { ...o, playerId: s.players[0].id } : o,
          ),
        ),
      /présent/,
    );
  });
  it("remembers first jersey/license but retains previously saved base values", () => {
    const s = fixtureState();
    s.players[0].number = null;
    s.players[0].license = undefined;
    const roster = s.players.map((p, i) =>
      i === 0
        ? { ...p, number: 42, license: "current" as const }
        : i === 1
          ? { ...p, number: 43 }
          : p,
    );
    const next = prepareMatch(s, "", s.teams[0], s.teams[1], roster, officials);
    assert.equal(next.players[0].number, 42);
    assert.equal(next.players[0].license, "current");
    assert.equal(next.players[1].number, 5);
    assert.equal(next.matches.at(-1)!.players[1].number, 43);
  });
  it("adds reinforcements mid-match without losing the clock, score events or original team", () => {
    const s = setup();
    s.matches[0] = addEvent(s.matches[0], basket());
    s.matches[0].runningUntil = Date.now() + 100000;
    const old = s.matches[0];
    s.players.push({
      ...loan(),
      teamId: "third",
      number: 10,
      sourceTeamId: undefined,
    });
    const next = addMatchPlayer(s, old.id, loan());
    const m = next.matches[0];
    assert.deepEqual(m.events, old.events);
    assert.equal(m.runningUntil, old.runningUntil);
    assert.deepEqual(m.startingScore, { home: 0, away: 0 });
    assert.equal(score(m, "aigles"), 2);
    assert.equal(next.players.at(-1)!.teamId, "third");
    assert.equal(next.players.at(-1)!.number, 10);
    assert.equal(m.players.at(-1)!.sourceTeamId, "third");
  });
  it("rejects duplicate, official, third reinforcement and overfull additions", () => {
    let s = setup();
    const id = s.matches[0].id;
    assert.throws(() => addMatchPlayer(s, id, s.players[0]), /déjà/);
    s = addMatchPlayer(s, id, loan(1));
    s = addMatchPlayer(s, id, loan(2));
    assert.throws(() => addMatchPlayer(s, id, loan(3)), /Deux renforts/);
    s.matches[0].rules.maxRoster = 8;
    assert.throws(
      () => addMatchPlayer(s, id, { ...loan(3), sourceTeamId: "aigles" }),
      /maximal/,
    );
  });
  it("propagates important player edits to open matches with warnings, retaining history and finished snapshots", () => {
    const s = setup();
    s.matches[0] = addEvent(s.matches[0], basket());
    s.matches.push({
      ...structuredClone(s.matches[0]),
      id: "finished",
      status: "finished",
    });
    const events = s.matches[0].events;
    const { next, warnings } = updatePlayerInClub(s, {
      ...s.players[0],
      name: "Nom corrigé",
      license: "never",
      cap: 1,
    });
    assert.equal(next.matches[0].players[0].name, "Nom corrigé");
    assert.deepEqual(next.matches[0].startingScore, { home: 6, away: 0 });
    assert.deepEqual(next.matches[0].events, events);
    assert.equal(next.matches[1].players[0].name, s.players[0].name);
    assert.ok(warnings.some((w) => w.includes("licence")));
    assert.ok(warnings.some((w) => w.includes("plafond")));
  });
  it("keeps an existing match jersey on collision and maintains loan assignment after base edits", () => {
    const s = setup();
    const { next, warnings } = updatePlayerInClub(s, {
      ...s.players[0],
      number: 5,
      teamId: "third",
    });
    assert.equal(next.matches[0].players[0].number, 4);
    assert.equal(next.matches[0].players[0].teamId, "aigles");
    assert.equal(next.matches[0].players[0].sourceTeamId, "third");
    assert.ok(warnings.length >= 2);
  });
  it("propagates colors and linked official names while finished sheets stay frozen", () => {
    const s = setup();
    s.matches[0].officials[0].playerId = "outsider";
    s.matches.push({
      ...structuredClone(s.matches[0]),
      id: "finished",
      status: "finished",
    });
    let next = updateTeamInClub(s, { ...s.teams[0], color: "#ff0000" });
    assert.equal(next.matches[0].home.color, "#ff0000");
    assert.equal(next.matches[1].home.color, undefined);
    next = updatePlayerInClub(next, {
      ...loan(),
      id: "outsider",
      name: "Officiel renommé",
      teamId: "third",
    }).next;
    assert.equal(next.matches[0].officials[0].name, "Officiel renommé");
    assert.equal(next.matches[1].officials[0].name, "Personne 0");
  });
  it("persists final messages and remarks through validation and refuses scoring a finished match", () => {
    const s = setup();
    Object.assign(s.matches[0], {
      status: "finished",
      closingMessage: "Merci à tous",
      remarks: "Accord adverse reçu\nIncident signalé",
    });
    const saved = stateSchema.parse(JSON.parse(JSON.stringify(s)));
    assert.equal(saved.matches[0].remarks, s.matches[0].remarks);
    assert.throws(() => addEvent(saved.matches[0], basket()), /terminé/);
  });
});

describe("Cycle de la table de marque", () => {
  it("archives the finished result and notes, stops time and leaves the table empty even after reload", () => {
    const s = setup();
    const id = s.activeId!;
    s.matches[0] = addEvent(s.matches[0], basket());
    s.matches[0].runningUntil = 101000;
    const next = finishMatch(s, id, "Merci", "Accord reçu", 1000);
    assert.equal(next.activeId, null);
    assert.equal(next.matches.length, 1);
    assert.equal(next.matches[0].status, "finished");
    assert.equal(next.matches[0].runningUntil, null);
    assert.equal(next.matches[0].remaining, 100);
    assert.equal(score(next.matches[0], "aigles"), 5);
    assert.deepEqual(next.matches[0].events, s.matches[0].events);
    assert.equal(next.matches[0].remarks, "Accord reçu");
    assert.equal(
      removeDemo(stateSchema.parse(JSON.parse(JSON.stringify(next)))).activeId,
      null,
    );
    assert.throws(() => finishMatch(next, id, "", ""), /terminée/);
    assert.throws(() => resetTable(next, id), /réinitialisée/);
  });
  it("discards only the reset active sheet and preserves the library and archived results", () => {
    const s = setup();
    const active = s.activeId!;
    s.matches[0] = addEvent(s.matches[0], basket());
    const archive = {
      ...structuredClone(s.matches[0]),
      id: "archive",
      status: "finished" as const,
    };
    s.matches.push(archive);
    const next = resetTable(s, active);
    assert.equal(next.activeId, null);
    assert.deepEqual(next.matches, [archive]);
    assert.deepEqual(next.players, s.players);
    assert.deepEqual(next.teams, s.teams);
    assert.deepEqual(next.rules, s.rules);
    assert.deepEqual(next.officials, s.officials);
    assert.equal(
      removeDemo(stateSchema.parse(JSON.parse(JSON.stringify(next)))).activeId,
      null,
    );
  });
  it("does not activate another pending match automatically or reopen a legacy finished sheet", () => {
    const s = setup();
    s.matches.push({ ...structuredClone(s.matches[0]), id: "pending" });
    const next = resetTable(s, s.activeId!);
    assert.equal(removeDemo(next).activeId, null);
    assert.equal(next.matches[0].id, "pending");
    next.activeId = "pending";
    next.matches[0].status = "finished";
    assert.equal(removeDemo(next).activeId, null);
  });
  it("starts a new independent sheet after closing while keeping the previous result immutable", () => {
    const s = setup();
    const oldId = s.activeId!;
    const closed = finishMatch(s, oldId, "Message", "Remarques");
    const next = prepareMatch(
      closed,
      "",
      s.teams[0],
      s.teams[1],
      s.players,
      officials,
    );
    assert.notEqual(next.activeId, oldId);
    assert.deepEqual(next.matches[0], closed.matches[0]);
    assert.equal(next.matches[1].events.length, 0);
    assert.equal(next.matches[1].remaining, 600);
  });
});

describe("Maillots et horaire de rencontre", () => {
  it("stores match-only colors without changing the base and retains them through team edits", () => {
    const s = fixtureState();
    s.matches = [];
    s.activeId = null;
    const original = structuredClone(s.teams);
    const next = prepareMatch(
      s,
      "",
      s.teams[0],
      s.teams[1],
      s.players,
      officials,
      [],
      {
        kitColors: { home: "#ffffff", away: "#171717" },
        scheduledAt: "2026-09-12T17:30:00.000Z",
      },
    );
    const m = next.matches[0];
    assert.equal(m.home.color, "#ffffff");
    assert.equal(m.away.color, "#171717");
    assert.deepEqual(next.teams, original);
    const changed = updateTeamInClub(next, {
      ...s.teams[0],
      name: "Nouveau nom",
      color: "#ff0000",
    });
    assert.equal(changed.matches[0].home.name, "Nouveau nom");
    assert.equal(changed.matches[0].home.color, "#ffffff");
    assert.equal(changed.teams[0].color, "#ff0000");
    const saved = stateSchema.parse(JSON.parse(JSON.stringify(changed)));
    assert.deepEqual(saved.matches[0].kitColors, m.kitColors);
    assert.equal(saved.matches[0].scheduledAt, "2026-09-12T17:30:00.000Z");
    const closed = finishMatch(saved, m.id, "", "");
    assert.equal(closed.matches[0].home.color, "#ffffff");
    assert.equal(closed.matches[0].scheduledAt, m.scheduledAt);
  });
  it("validates custom colors and dates rather than silently dropping them", () => {
    const s = fixtureState();
    assert.throws(() =>
      prepareMatch(s, "", s.teams[0], s.teams[1], s.players, officials, [], {
        kitColors: { home: "red", away: "#ffffff" },
      }),
    );
    assert.throws(() =>
      prepareMatch(s, "", s.teams[0], s.teams[1], s.players, officials, [], {
        scheduledAt: "not a date",
      }),
    );
  });
  it("prefills and roundtrips the local date and time without using the UTC day", () => {
    const date = new Date(2026, 8, 11, 0, 5);
    assert.deepEqual(localMatchDateTime(date), {
      date: "2026-09-11",
      time: "00:05",
    });
    assert.equal(scheduledMatchTime("2026-09-11", "00:05"), date.toISOString());
    assert.throws(() => scheduledMatchTime("2026-02-30", "14:00"));
    assert.throws(() => scheduledMatchTime("2026-09-11", "25:05"));
    assert.throws(() => scheduledMatchTime("", ""));
  });
  it("shows the planned date while keeping legacy sheets readable", () => {
    const m = setup().matches[0];
    assert.ok(matchDateLabel(m).length > 0);
    m.scheduledAt = new Date(2026, 8, 12, 19, 30).toISOString();
    assert.match(matchDateLabel(m), /12\/09\/2026/);
    assert.match(matchDateLabel(m), /19:30/);
  });
});

describe("Côtés de toute la table", () => {
  it("swaps the displayed teams without transferring scores, fouls, rosters or the clock", () => {
    let m = setup().matches[0];
    m = addEvent(m, basket());
    m = addEvent(m, {
      kind: "foul",
      teamId: "aigles",
      playerId: "demo-0",
      foulType: "Personnelle",
    });
    const original = structuredClone(m),
      first = courtSides(m);
    assert.equal(first.left.id, "aigles");
    m = { ...m, swapped: !m.swapped };
    const swapped = courtSides(m);
    assert.equal(swapped.left.id, "renards");
    assert.equal(swapped.right.id, "aigles");
    assert.equal(score(m, swapped.right.id), 5);
    assert.equal(startingPoints(m, swapped.right.id), 3);
    assert.equal(teamFouls(m, swapped.right.id), 1);
    assert.equal(shotValue(m, swapped.left.id, 2, 7.5), 2);
    assert.equal(shotValue(m, swapped.right.id, 26, 7.5), 2);
    assert.deepEqual(m.players, original.players);
    assert.deepEqual(m.events, original.events);
    assert.equal(m.remaining, original.remaining);
    assert.equal(m.runningUntil, original.runningUntil);
    assert.deepEqual(courtSides({ ...m, swapped: false }), first);
  });
  it("automatically changes all display sides at halftime in two- and four-period matches, including a manual inversion", () => {
    for (const periods of [2, 4])
      for (const swapped of [false, true]) {
        let m = setup().matches[0];
        m.rules = { ...m.rules, periods };
        m.swapped = swapped;
        const first = courtSides(m);
        if (periods === 4) {
          m = nextPeriod({ ...m, remaining: 0 });
          assert.deepEqual(courtSides(m), first);
        }
        m = nextPeriod({ ...m, remaining: 0 });
        assert.equal(courtSides(m).left.id, first.right.id);
        assert.equal(courtSides(m).right.id, first.left.id);
        assert.equal(m.swapped, swapped);
        assert.equal(m.remaining, 600);
      }
  });
  it("keeps the second-half orientation throughout overtime and after reloading", () => {
    let m = setup().matches[0];
    m.period = 2;
    m.remaining = 0;
    m.startingScore = { home: 0, away: 0 };
    const secondHalf = courtSides(m);
    m = nextPeriod(m);
    assert.deepEqual(courtSides(m), secondHalf);
    m = nextPeriod({ ...m, remaining: 0 });
    assert.deepEqual(courtSides(m), secondHalf);
    const state = setup();
    state.matches = [m];
    state.activeId = m.id;
    const restored = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(courtSides(restored.matches[0]), secondHalf);
  });
});
