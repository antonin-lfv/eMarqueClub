import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fixtureState } from "./fixture.ts";
import {
  initialState,
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
    assert.equal(next.activeId, s.matches[0].id);
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
