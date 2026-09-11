import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SaveQueue,
  type SaveRequest,
  type SaveDraft,
} from "../lib/save-queue.ts";
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
