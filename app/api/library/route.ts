import { env } from "cloudflare:workers";
import { emptyLibrary, validateLibrary } from "../../../lib/model";
export async function GET() {
  try {
    const row = await env
      .DB!.prepare("SELECT data, revision FROM library WHERE id = ?")
      .bind("personal")
      .first<{ data: string; revision: number }>();
    return Response.json(
      {
        data: row ? JSON.parse(row.data) : emptyLibrary(),
        revision: row?.revision ?? 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "storageError" }, { status: 503 });
  }
}
export async function PUT(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 4_000_000)
      return Response.json({ error: "invalidBackup" }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 4_000_000)
      return Response.json({ error: "invalidBackup" }, { status: 413 });
    const { data, revision } = JSON.parse(raw);
    validateLibrary(data);
    if (!Number.isInteger(revision) || revision < 0)
      return Response.json({ error: "invalidBackup" }, { status: 400 });
    const r = await env
      .DB!.prepare(
        "INSERT INTO library (id, data, revision, updated_at) SELECT ?, ?, 1, ? WHERE ? = 0 ON CONFLICT(id) DO UPDATE SET data = excluded.data, revision = library.revision + 1, updated_at = excluded.updated_at WHERE library.revision = ? RETURNING revision",
      )
      .bind(
        "personal",
        JSON.stringify(data),
        new Date().toISOString(),
        revision,
        revision,
      )
      .first<{ revision: number }>();
    // Existing rows need an UPDATE when the submitted revision is nonzero.
    const result =
      r ??
      (revision > 0
        ? await env
            .DB!.prepare(
              "UPDATE library SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING revision",
            )
            .bind(
              JSON.stringify(data),
              new Date().toISOString(),
              "personal",
              revision,
            )
            .first<{ revision: number }>()
        : null);
    if (!result) return Response.json({ error: "conflict" }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error:
          error instanceof Error && error.message === "invalidBackup"
            ? "invalidBackup"
            : "storageError",
      },
      {
        status:
          error instanceof Error && error.message === "invalidBackup"
            ? 400
            : 503,
      },
    );
  }
}
