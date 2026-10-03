export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ books: [] });
  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set(/^[-\d ]{10,17}$/.test(q) ? "isbn" : "q", q);
    url.searchParams.set("limit", "12");
    const result = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!result.ok) throw new Error();
    const data = (await result.json()) as {
      docs: {
        title: string;
        author_name?: string[];
        isbn?: string[];
        cover_i?: number;
        language?: string[];
      }[];
    };
    return Response.json({
      books: data.docs.map((b) => ({
        title: b.title,
        author: b.author_name?.join(", ") ?? "",
        isbn: b.isbn?.[0] ?? "",
        cover: b.cover_i
          ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`
          : "",
        language: b.language?.includes("heb") ? "he" : "en",
      })),
    });
  } catch {
    return Response.json({ error: "searchError" }, { status: 502 });
  }
}
