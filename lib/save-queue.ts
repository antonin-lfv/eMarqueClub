export type SaveRequest<T> = { state: T; revision: number; mutationId: string };
export type SaveDraft<T> = {
  state: T;
  revision: number;
  request: SaveRequest<T> | null;
};
/** One in-flight write. Rapid edits are coalesced, and retries reuse the same id. */
export class SaveQueue<T> {
  state: T;
  revision: number;
  request: SaveRequest<T> | null = null;
  pending = false;
  error = "";
  private sending = false;
  private dirty = false;
  private send: (r: SaveRequest<T>) => Promise<number>;
  private notify: () => void;
  private persist: (draft: SaveDraft<T> | null) => void;
  constructor(
    state: T,
    revision: number,
    send: (r: SaveRequest<T>) => Promise<number>,
    notify: () => void,
    persist: (draft: SaveDraft<T> | null) => void,
    restore?: SaveDraft<T>,
  ) {
    this.send = send;
    this.notify = notify;
    this.persist = persist;
    this.state = restore?.state ?? state;
    this.revision = restore?.revision ?? revision;
    this.request = restore?.request ?? null;
    this.dirty = !!restore;
    this.pending = !!restore;
  }
  replace(state: T) {
    this.state = state;
    this.dirty = true;
    this.pending = true;
    this.checkpoint();
    this.notify();
    if (!this.error) void this.flush();
  }
  retry() {
    this.error = "";
    this.notify();
    void this.flush();
  }
  private checkpoint() {
    this.persist(
      this.pending
        ? { state: this.state, revision: this.revision, request: this.request }
        : null,
    );
  }
  async flush() {
    if (this.sending || this.error || !this.pending) return;
    this.sending = true;
    try {
      while (this.pending) {
        if (!this.request) {
          this.request = {
            state: this.state,
            revision: this.revision,
            mutationId: crypto.randomUUID(),
          };
          this.dirty = false;
          this.checkpoint();
        }
        const sent = this.request;
        this.revision = await this.send(sent);
        this.request = null;
        this.pending = this.dirty || this.state !== sent.state;
        this.checkpoint();
        this.notify();
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Sauvegarde indisponible.";
      this.checkpoint();
      this.notify();
    } finally {
      this.sending = false;
    }
  }
}
