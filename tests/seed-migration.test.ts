import { it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fixtureState } from "./fixture.ts";
import { stateSchema } from "../lib/game.ts";
it("adds eight test players exactly once without altering any match or existing record", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE club_state(id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER,mutation_id TEXT,updated_at TEXT)",
    );
    const original = fixtureState();
    original.matches[0].runningUntil = Date.now() + 50000;
    db.prepare("INSERT INTO club_state VALUES(?,?,?,?,?)").run(
      "club",
      JSON.stringify(original),
      4,
      "previous",
      "old",
    );
    const sql = readFileSync(
      new URL("../drizzle/0002_add_lynx_test_team.sql", import.meta.url),
      "utf8",
    );
    db.exec(sql);
    const row = db.prepare("SELECT * FROM club_state").get()!;
    const next = stateSchema.parse(JSON.parse(row.payload as string));
    assert.deepEqual(next.matches, original.matches);
    assert.equal(next.activeId, original.activeId);
    assert.deepEqual(next.rules, original.rules);
    assert.deepEqual(next.officials, original.officials);
    assert.deepEqual(next.teams.slice(0, -1), original.teams);
    assert.deepEqual(next.players.slice(0, -8), original.players);
    assert.equal(next.teams.at(-1)!.id, "test-lynx-corpo");
    const players = next.players.slice(-8);
    assert.equal(new Set(players.map((p) => p.number)).size, 8);
    assert.ok(
      players.every((p) => p.teamId === "test-lynx-corpo" && p.license),
    );
    assert.equal(row.revision, 5);
    assert.equal(row.mutation_id, null);
    db.exec(sql);
    assert.deepEqual(db.prepare("SELECT * FROM club_state").get(), row);
  } finally {
    db.close();
  }
});
