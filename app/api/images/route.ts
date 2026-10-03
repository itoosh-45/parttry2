import { env } from "cloudflare:workers";
export async function POST(request: Request) {
  try {
    const blob = await request.blob();
    if (
      blob.size > 5_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(blob.type)
    )
      return Response.json({ error: "imageError" }, { status: 400 });
    const id = crypto.randomUUID();
    await env.BUCKET!.put(id, blob.stream(), {
      httpMetadata: { contentType: blob.type },
    });
    return Response.json({ url: `/api/images/${id}` });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "imageError" }, { status: 503 });
  }
}
