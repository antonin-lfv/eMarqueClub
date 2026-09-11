import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  prepareMatch,
  penaltyPoints,
  score,
  stats,
  adjustClock,
  timeLeft,
  addEvent,
  undoLast,
  nextPeriod,
  type Official,
} from "../lib/game.ts";
import {
  SaveQueue,
  type SaveRequest,
  type SaveDraft,
} from "../lib/save-queue.ts";
function setup() {
  const s = initialState();
  s.players[0].license = "current";
  s.players[1].license = "former";
  s.players[6].license = "current";
  s.players[7].license = "current";
  s.players[8].license = "former";
  const officials: Official[] = ["Marqueur", "Chronométreur", "Arbitre"].map(
    (role, i) => ({
      id: "o" + i,
      name: "Officiel " + i,
      role: role as Official["role"],
      playerId: null,
    }),
  );
  return { s, officials, initial: s.matches[0].initial };
}
describe("Preparation and fast scoring", () => {
  it("compensates 4 vs 7 as 3–0, excluding starting points from player stats and caps", () => {
    const { s, officials, initial } = setup();
    const next = prepareMatch(
      s,
      "Tournoi",
      s.teams[0],
      s.teams[1],
      s.players,
      officials,
      initial,
    );
    const m = next.matches.at(-1)!;
    assert.deepEqual(m.startingScore, { home: 3, away: 0 });
    assert.equal(score(m, "aigles"), 3);
    assert.equal(stats(m, "demo-0").points, 0);
    const scored = addEvent(m, {
      kind: "shot",
      teamId: "aigles",
      playerId: "demo-0",
      x: 2,
      y: 7,
      value: 2,
      made: true,
    });
    assert.equal(score(scored, "aigles"), 5);
    assert.equal(stats(scored, "demo-0").field, 2);
    assert.equal(score(undoLast(scored), "aigles"), 3);
  });
  it("counts present players only and remembers their jerseys and licenses", () => {
    const { s, officials, initial } = setup();
    const roster = s.players.filter((p) => p.id !== "demo-5");
    roster[0] = { ...roster[0], number: 42 };
    const next = prepareMatch(
      s,
      "Match",
      s.teams[0],
      s.teams[1],
      roster,
      officials,
      initial,
    );
    assert.equal(next.matches.at(-1)!.players.length, 11);
    assert.equal(next.players.find((p) => p.id === "demo-0")!.number, 42);
    assert.equal(
      next.players.find((p) => p.id === "demo-0")!.license,
      "current",
    );
    assert.equal(s.players[0].number, 4);
  });
  it("rejects missing, duplicated and invalid jerseys", () => {
    for (const number of [null, 5, 100]) {
      const { s, officials, initial } = setup();
      s.players[0].number = number;
      assert.throws(
        () =>
          prepareMatch(
            s,
            "Match",
            s.teams[0],
            s.teams[1],
            s.players,
            officials,
            initial,
          ),
        /maillot/,
      );
    }
  });
  it("requires exactly two table officials and one or two referees", () => {
    const { s, officials, initial } = setup();
    assert.throws(
      () =>
        prepareMatch(
          s,
          "Match",
          s.teams[0],
          s.teams[1],
          s.players,
          officials.slice(1),
          initial,
        ),
      /deux personnes/,
    );
    const two = [
      ...officials,
      {
        id: "o3",
        name: "Second arbitre",
        role: "Arbitre" as const,
        playerId: null,
      },
    ];
    assert.doesNotThrow(() =>
      prepareMatch(s, "Match", s.teams[0], s.teams[1], s.players, two, initial),
    );
    assert.throws(
      () =>
        prepareMatch(
          s,
          "Match",
          s.teams[0],
          s.teams[1],
          s.players,
          [...two, { ...two[3], id: "o4", name: "Troisième" }],
          initial,
        ),
      /arbitres/,
    );
  });
  it("rejects duplicate officials and a present player acting as official", () => {
    const { s, officials, initial } = setup();
    officials[1].name = officials[0].name;
    assert.throws(
      () =>
        prepareMatch(
          s,
          "Match",
          s.teams[0],
          s.teams[1],
          s.players,
          officials,
          initial,
        ),
      /deux postes/,
    );
    officials[1].name = "Distinct";
    officials[0].playerId = "demo-0";
    assert.throws(
      () =>
        prepareMatch(
          s,
          "Match",
          s.teams[0],
          s.teams[1],
          s.players,
          officials,
          initial,
        ),
      /présent/,
    );
  });
  it("validates the starters and keeps old matches without penalties unchanged", () => {
    const { s, officials } = setup();
    assert.throws(
      () =>
        prepareMatch(
          s,
          "Match",
          s.teams[0],
          s.teams[1],
          s.players,
          officials,
          [],
        ),
      /titulaires/,
    );
    assert.equal(score(s.matches[0], "aigles"), 0);
  });
  it("prevents overtime if starting points break a tie on field scoring", () => {
    const { s, officials, initial } = setup();
    const m = prepareMatch(
      s,
      "Match",
      s.teams[0],
      s.teams[1],
      s.players,
      officials,
      initial,
    ).matches.at(-1)!;
    m.period = 4;
    m.remaining = 0;
    assert.throws(() => nextPeriod(m), /égalité/);
  });
  it("adjusts a running or paused clock, clamps bounds, and preserves event timestamps", () => {
    let m = initialState().matches[0];
    m.remaining = 100;
    m = adjustClock(m, 10, 1000);
    assert.equal(m.remaining, 110);
    assert.equal(m.runningUntil, null);
    m.runningUntil = 101000;
    m = adjustClock(m, -10, 1000);
    assert.equal(timeLeft(m, 1000), 90);
    assert.equal(m.runningUntil, 91000);
    assert.equal(adjustClock(m, -1000, 1000).runningUntil, null);
    assert.equal(adjustClock(m, 1000, 1000).remaining, 600);
  });
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
describe("Immediate background saves", () => {
  it("updates synchronously and coalesces rapid actions behind a single in-flight save", async () => {
    const calls: {
      req: SaveRequest<number>;
      resolve: (revision: number) => void;
    }[] = [];
    const q = new SaveQueue(
      0,
      0,
      (req) => new Promise((resolve) => calls.push({ req, resolve })),
      () => {},
      () => {},
    );
    q.replace(1);
    q.replace(2);
    q.replace(3);
    assert.equal(q.state, 3);
    assert.equal(calls.length, 1);
    assert.equal(q.pending, true);
    calls[0].resolve(1);
    await tick();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].req.state, 3);
    assert.equal(calls[1].req.revision, 1);
    calls[1].resolve(2);
    await tick();
    assert.equal(q.pending, false);
    assert.equal(q.revision, 2);
  });
  it("undo during a save never resurrects the action", async () => {
    const calls: {
      req: SaveRequest<string[]>;
      resolve: (revision: number) => void;
    }[] = [];
    const q = new SaveQueue<string[]>(
      [],
      0,
      (req) => new Promise((resolve) => calls.push({ req, resolve })),
      () => {},
      () => {},
    );
    q.replace(["shot"]);
    q.replace([]);
    calls[0].resolve(1);
    await tick();
    assert.deepEqual(calls[1].req.state, []);
    assert.deepEqual(q.state, []);
    calls[1].resolve(2);
    await tick();
    assert.deepEqual(q.state, []);
  });
  it("retains the exact request after a lost response and retries without a new mutation id", async () => {
    const ids: string[] = [];
    let fail = true;
    let draft: SaveDraft<number> | null = null;
    const q = new SaveQueue(
      0,
      7,
      async (req) => {
        ids.push(req.mutationId);
        if (fail) throw Error("Network timeout");
        return 8;
      },
      () => {},
      (d) => {
        draft = d;
      },
    );
    q.replace(1);
    await tick();
    assert.equal(q.state, 1);
    assert.equal(q.pending, true);
    assert.match(q.error, /timeout/);
    assert.ok(draft);
    fail = false;
    q.retry();
    await tick();
    assert.equal(ids.length, 2);
    assert.equal(ids[0], ids[1]);
    assert.equal(q.pending, false);
    assert.equal(draft, null);
  });
  it("restores a pending session and keeps later local actions through a retry", async () => {
    const req = { state: 1, revision: 4, mutationId: "lost-response" };
    const calls: SaveRequest<number>[] = [];
    const q = new SaveQueue(
      0,
      4,
      async (r) => {
        calls.push(r);
        return r.revision + 1;
      },
      () => {},
      () => {},
      { state: 2, revision: 4, request: req },
    );
    q.retry();
    await tick();
    assert.equal(calls[0].mutationId, "lost-response");
    assert.equal(calls[1].state, 2);
    assert.equal(calls[1].revision, 5);
    assert.equal(q.state, 2);
    assert.equal(q.pending, false);
  });
  it("a conflict preserves the local state and does not auto-overwrite the server", async () => {
    let calls = 0;
    const q = new SaveQueue(
      0,
      1,
      async () => {
        calls++;
        throw Error("Conflict");
      },
      () => {},
      () => {},
    );
    q.replace(1);
    await tick();
    q.replace(2);
    await tick();
    assert.equal(q.state, 2);
    assert.equal(q.pending, true);
    assert.equal(calls, 1);
    assert.equal(q.error, "Conflict");
  });
});
