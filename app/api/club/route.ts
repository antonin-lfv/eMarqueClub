import { clubDb } from "@/db/club";
import { stateSchema, initialState, removeDemo } from "@/lib/game";
export const dynamic = "force-dynamic";
function authorized(request: Request) {
  return (
    !!request.headers.get("oai-authenticated-user-id") || import.meta.env.DEV
  );
}
export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json(
      { error: "Connectez-vous pour accéder à la table de marque." },
      { status: 401 },
    );
  try {
    const db = clubDb();
    let row = await db
      .prepare("SELECT payload,revision FROM club_state WHERE id = ?")
      .bind("club")
      .first<{ payload: string; revision: number }>();
    if (!row) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO club_state (id,payload,revision,updated_at) VALUES (?,?,?,?)",
        )
        .bind(
          "club",
          JSON.stringify(initialState()),
          0,
          new Date().toISOString(),
        )
        .run();
      row = await db
        .prepare("SELECT payload,revision FROM club_state WHERE id = ?")
        .bind("club")
        .first<{ payload: string; revision: number }>();
    }
    if (!row) throw Error("Missing state");
    const normalized = removeDemo(JSON.parse(row.payload));
    if (JSON.stringify(normalized) !== row.payload) {
      await db
        .prepare(
          "UPDATE club_state SET payload = ?, revision = revision + 1, mutation_id = NULL, updated_at = ? WHERE id = ? AND revision = ?",
        )
        .bind(
          JSON.stringify(normalized),
          new Date().toISOString(),
          "club",
          row.revision,
        )
        .run();
      row = await db
        .prepare("SELECT payload,revision FROM club_state WHERE id = ?")
        .bind("club")
        .first<{ payload: string; revision: number }>();
      if (!row) throw Error("Missing state after cleanup");
    }

    return Response.json(
      { state: JSON.parse(row.payload), revision: row.revision },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Load club", error);
    return Response.json(
      { error: "La sauvegarde est indisponible. Réessayez dans un instant." },
      { status: 503 },
    );
  }
}
export async function PUT(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Connexion requise." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 4_000_000)
      return Response.json(
        { error: "Archive trop volumineuse." },
        { status: 413 },
      );
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return Response.json({ error: "Données invalides." }, { status: 400 });
    }
    const result = stateSchema.safeParse(data.state);
    if (
      !result.success ||
      !Number.isInteger(data.revision) ||
      data.revision < 0 ||
      (data.mutationId !== undefined &&
        (typeof data.mutationId !== "string" ||
          data.mutationId.length > 100 ||
          !data.mutationId))
    )
      return Response.json(
        { error: "Données du match invalides." },
        { status: 400 },
      );
    const r = await clubDb()
      .prepare(
        "UPDATE club_state SET payload = ?, revision = revision + 1, updated_at = ?, mutation_id = ? WHERE id = ? AND revision = ?",
      )
      .bind(
        JSON.stringify(removeDemo(result.data)),
        new Date().toISOString(),
        data.mutationId ?? null,
        "club",
        data.revision,
      )
      .run();
    if (!r.meta.changes) {
      const previous = await clubDb()
        .prepare("SELECT revision,mutation_id FROM club_state WHERE id = ?")
        .bind("club")
        .first<{ revision: number; mutation_id: string | null }>();
      if (
        data.mutationId &&
        previous &&
        previous.mutation_id === data.mutationId
      )
        return Response.json({ revision: previous.revision });
      return Response.json(
        {
          error:
            "Conflit avec une autre fenêtre. Votre saisie est conservée ici. Exportez la copie de secours avant de résoudre le conflit.",
        },
        { status: 409 },
      );
    }
    return Response.json({ revision: data.revision + 1 });
  } catch (error) {
    console.error("Save club", error);
    return Response.json(
      {
        error:
          "Sauvegarde en attente. Les actions restent visibles et conservées dans cette fenêtre ; réessayez.",
      },
      { status: 503 },
    );
  }
}
