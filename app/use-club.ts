"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  initialState,
  stateSchema,
  removeDemo,
  type ClubState,
} from "@/lib/game";
import { SaveQueue, type SaveDraft, type SaveRequest } from "@/lib/save-queue";
const draftKey = "emarque-pending-v2";
export function useClub() {
  const [state, setState] = useState<ClubState>(initialState),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const stateRef = useRef(state),
    queue = useRef<SaveQueue<ClubState> | null>(null),
    loading = useRef(false);
  const load = useCallback(async () => {
    if (loading.current || queue.current?.pending) return;
    loading.current = true;
    try {
      const r = await fetch("/api/club", { cache: "no-store" });
      const data = (await r.json()) as {
        state: ClubState;
        revision: number;
        error?: string;
      };
      if (!r.ok) throw Error(data.error);
      let draft: SaveDraft<ClubState> | undefined;
      try {
        const raw = sessionStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          if (
            stateSchema.safeParse(d.state).success &&
            Number.isInteger(d.revision)
          )
            draft = {
              ...d,
              state: removeDemo(d.state),
              request: d.request
                ? { ...d.request, state: removeDemo(d.request.state) }
                : null,
            };
        }
      } catch {
        /* Browser storage may be unavailable; server remains authoritative. */
      }
      const send = async (req: SaveRequest<ClubState>) => {
        const result = await fetch("/api/club", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
          signal: AbortSignal.timeout(12000),
        });
        const body = (await result.json()) as {
          revision: number;
          error?: string;
        };
        if (!result.ok) throw Error(body.error ?? "Sauvegarde indisponible.");
        return body.revision;
      };
      const q = new SaveQueue<ClubState>(
        removeDemo(data.state),
        data.revision,
        send,
        () => {
          stateRef.current = q.state;
          setState(q.state);
          setPending(q.pending);
          setError(q.error);
        },
        (d) => {
          try {
            if (d) sessionStorage.setItem(draftKey, JSON.stringify(d));
            else sessionStorage.removeItem(draftKey);
          } catch {
            toast.warning(
              "La copie de secours locale est indisponible. Gardez cette page ouverte jusqu’à la fin de la sauvegarde.",
              { id: "storage" },
            );
          }
        },
        draft,
      );
      queue.current = q;
      stateRef.current = q.state;
      setState(q.state);
      setLoaded(true);
      setPending(q.pending);
      setError("");
      if (draft) q.retry();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loading.current = false;
    }
  }, []);
  useEffect(() => {
    void load();
    const before = (e: BeforeUnloadEvent) => {
      if (queue.current?.pending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const online = () => queue.current?.retry();
    window.addEventListener("beforeunload", before);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("online", online);
    };
  }, [load]);
  const commit = async (next: ClubState, message?: string) => {
    if (!queue.current) {
      toast.error("Attendez le chargement du tournoi.");
      return false;
    }
    queue.current.replace(next);
    if (message) toast.success(message, { duration: 1500 });
    return true;
  };
  const retry = () => (queue.current ? queue.current.retry() : void load());
  return { state, stateRef, loaded, error, pending, commit, retry };
}
