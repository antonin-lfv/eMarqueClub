import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  addEvent,
  stats,
  excluded,
  lineup,
  nextPeriod,
  timeLeft,
  shotValue,
  attackingRight,
  stateSchema,
  newMatch,
} from "../lib/game.ts";
const match = () => structuredClone(initialState().matches[0]);
describe("Basketball table rules", () => {
  it("counts makes, misses and free throws independently", () => {
    let m = match();
    m = addEvent(m, {
      kind: "shot",
      playerId: "demo-0",
      teamId: "aigles",
      x: 2,
      y: 7,
      value: 2,
      made: true,
    });
    m = addEvent(m, {
      kind: "shot",
      playerId: "demo-0",
      teamId: "aigles",
      x: 9,
      y: 7,
      value: 3,
      made: false,
    });
    m = addEvent(m, {
      kind: "free",
      playerId: "demo-0",
      teamId: "aigles",
      value: 1,
      made: true,
    });
    const s = stats(m, "demo-0");
    assert.equal(s.points, 3);
    assert.equal(s.field, 2);
    assert.equal(s.shots, 2);
    assert.equal(s.made, 1);
    assert.deepEqual(s.free, [1, 1]);
  });
  it("blocks exceeding 12 field points but allows unlimited free throws and misses", () => {
    let m = match();
    for (let i = 0; i < 4; i++)
      m = addEvent(m, {
        kind: "shot",
        playerId: "demo-0",
        teamId: "aigles",
        x: 9,
        y: 7,
        value: 3,
        made: true,
      });
    assert.throws(
      () =>
        addEvent(m, {
          kind: "shot",
          playerId: "demo-0",
          teamId: "aigles",
          x: 2,
          y: 7,
          value: 2,
          made: true,
        }),
      /Plafond/,
    );
    m = addEvent(m, {
      kind: "free",
      playerId: "demo-0",
      teamId: "aigles",
      value: 1,
      made: true,
    });
    m = addEvent(m, {
      kind: "shot",
      playerId: "demo-0",
      teamId: "aigles",
      x: 2,
      y: 7,
      value: 2,
      made: false,
    });
    assert.equal(stats(m, "demo-0").points, 13);
  });
  it("rejects an entire basket when 11+2 exceeds the cap", () => {
    let m = match();
    for (const v of [3, 3, 3, 2])
      m = addEvent(m, {
        kind: "shot",
        playerId: "demo-0",
        teamId: "aigles",
        x: 9,
        y: 7,
        value: v,
        made: true,
      });
    assert.throws(
      () =>
        addEvent(m, {
          kind: "shot",
          playerId: "demo-0",
          teamId: "aigles",
          x: 2,
          y: 7,
          value: 2,
          made: true,
        }),
      /Plafond/,
    );
  });
  it("excludes after five fouls and allows a replacement into the free place", () => {
    let m = match();
    for (let i = 0; i < 5; i++)
      m = addEvent(m, {
        kind: "foul",
        playerId: "demo-0",
        teamId: "aigles",
        foulType: "Personnelle",
      });
    assert.equal(excluded(m, "demo-0"), true);
    assert.equal(lineup(m, "aigles").length, 4);
    assert.throws(
      () =>
        addEvent(m, {
          kind: "free",
          playerId: "demo-0",
          teamId: "aigles",
          made: true,
        }),
      /terrain/,
    );
    m = addEvent(m, {
      kind: "sub",
      teamId: "aigles",
      playerId: "",
      otherId: "demo-5",
    });
    assert.equal(lineup(m, "aigles").length, 5);
  });
  it("excludes for a technical and an unsportsmanlike foul", () => {
    let m = match();
    m = addEvent(m, {
      kind: "foul",
      teamId: "aigles",
      playerId: "demo-0",
      foulType: "Technique",
    });
    m = addEvent(m, {
      kind: "foul",
      teamId: "aigles",
      playerId: "demo-0",
      foulType: "Antisportive",
    });
    assert.equal(excluded(m, "demo-0"), true);
  });
  it("rejects bench scoring and overfull substitutions", () => {
    const m = match();
    assert.throws(
      () =>
        addEvent(m, {
          kind: "shot",
          teamId: "aigles",
          playerId: "demo-5",
          x: 2,
          y: 7,
          value: 2,
          made: true,
        }),
      /terrain/,
    );
    assert.throws(
      () =>
        addEvent(m, {
          kind: "sub",
          teamId: "aigles",
          playerId: "",
          otherId: "demo-5",
        }),
      /sortant/,
    );
    const changed = addEvent(m, {
      kind: "sub",
      teamId: "aigles",
      playerId: "demo-0",
      otherId: "demo-5",
    });
    assert.ok(lineup(changed, "aigles").some((p) => p.id === "demo-5"));
    changed.events[0].voided = true;
    assert.ok(lineup(changed, "aigles").some((p) => p.id === "demo-0"));
  });
  it("enforces timeouts and pauses the running clock", () => {
    let m = match();
    m.runningUntil = 110000;
    m = addEvent(
      m,
      { kind: "timeout", teamId: "aigles", playerId: "" },
      100000,
    );
    assert.equal(m.remaining, 10);
    assert.equal(m.runningUntil, null);
    for (let i = 0; i < 2; i++)
      m = addEvent(m, { kind: "timeout", teamId: "aigles", playerId: "" });
    assert.throws(
      () => addEvent(m, { kind: "timeout", teamId: "aigles", playerId: "" }),
      /temps morts/,
    );
  });
  it("keeps elapsed time accurate regardless of polling intervals", () => {
    const m = match();
    m.runningUntil = 160000;
    assert.equal(timeLeft(m, 100000), 60);
    assert.equal(timeLeft(m, 130300), 30);
    assert.equal(timeLeft(m, 200000), 0);
  });
  it("allows overtime only at zero and on a tied score", () => {
    let m = match();
    assert.throws(() => nextPeriod(m), /zéro/);
    m.remaining = 0;
    m.period = 4;
    m = nextPeriod(m);
    assert.equal(m.period, 5);
    assert.equal(m.remaining, 300);
    m = addEvent(m, {
      kind: "free",
      teamId: "aigles",
      playerId: "demo-0",
      made: true,
    });
    m.remaining = 0;
    assert.throws(() => nextPeriod(m), /égalité/);
  });
  it("detects 2/3 points and reverses hoops at halftime", () => {
    let m = match();
    assert.equal(shotValue(m, "aigles", 1.575, 7.5), 2);
    assert.equal(shotValue(m, "aigles", 8.5, 7.5), 3);
    assert.equal(shotValue(m, "aigles", 1, 0.5), 3);
    assert.equal(shotValue(m, "renards", 26.425, 7.5), 2);
    m.period = 3;
    assert.equal(attackingRight(m, "aigles"), true);
    assert.equal(shotValue(m, "aigles", 26.425, 7.5), 2);
    m.swapped = true;
    assert.equal(attackingRight(m, "aigles"), false);
  });
  it("undo removes points from every aggregate and finished matches reject scoring", () => {
    let m = match();
    m = addEvent(m, {
      kind: "free",
      teamId: "aigles",
      playerId: "demo-0",
      made: true,
    });
    m.events[0].voided = true;
    assert.equal(stats(m).points, 0);
    assert.equal(stats(m, "demo-0").points, 0);
    m.status = "finished";
    assert.throws(
      () =>
        addEvent(m, {
          kind: "free",
          teamId: "aigles",
          playerId: "demo-0",
          made: true,
        }),
      /terminé/,
    );
  });
  it("copies rosters and rules and validates stored records", () => {
    const s = initialState();
    const m = newMatch("Test", s.teams[0], s.teams[1], s.players, s.rules);
    s.players[0].name = "Changed";
    s.rules.foulLimit = 3;
    assert.equal(m.players[0].name, "Lucas Martin");
    assert.equal(m.rules.foulLimit, 5);
    assert.equal(stateSchema.safeParse(s).success, true);
    s.rules.periods = 0;
    assert.equal(stateSchema.safeParse(s).success, false);
  });
});
