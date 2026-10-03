export type Book = {
  id: string;
  title: string;
  author: string;
  genre: string;
  language: string;
  isbn: string;
  aliases: string;
  cover: string;
  added: string;
  rating: number;
  review: string;
  purchasedFrom?: string;
};
export type Copy = {
  id: string;
  bookId: string;
  location: string;
  status: "available" | "reading" | "loaned" | "unknown";
  note: string;
  added: string;
};
export type Loan = {
  id: string;
  copyId: string;
  borrower: string;
  date: string;
  previousLocation: string;
  returned: string | null;
  returnLocation?: string;
};
export type Wish = { id: string; title: string; purchased: boolean };
export type Draft = {
  id: string;
  image: string;
  text: string;
  created: string;
};
export type Library = {
  owner: string;
  locations: string[];
  books: Book[];
  copies: Copy[];
  loans: Loan[];
  wishes: Wish[];
  drafts: Draft[];
  activity: { date: string; action: string }[];
};
export const emptyLibrary = (): Library => ({
  owner: "",
  locations: ["הבית שלי"],
  books: [],
  copies: [],
  loans: [],
  wishes: [],
  drafts: [],
  activity: [],
});
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
export function duplicateBook(
  library: Library,
  book: Pick<Book, "title" | "author" | "isbn">,
) {
  return library.books.find(
    (b) =>
      (book.isbn &&
        b.isbn &&
        b.isbn.replace(/[- ]/g, "") === book.isbn.replace(/[- ]/g, "")) ||
      (normalize(b.title) === normalize(book.title) &&
        normalize(b.author) === normalize(book.author)),
  );
}
export function halfYear(date: string, now = new Date()) {
  const threshold = new Date(date + "T12:00:00");
  const day = threshold.getDate();
  threshold.setDate(1);
  threshold.setMonth(threshold.getMonth() + 6);
  const end = new Date(
    threshold.getFullYear(),
    threshold.getMonth() + 1,
    0,
  ).getDate();
  threshold.setDate(Math.min(day, end));
  return now >= threshold;
}
export function validateLibrary(value: unknown): asserts value is Library {
  if (!value || typeof value !== "object") throw new Error("invalidBackup");
  const l = value as Library;
  if (
    typeof l.owner !== "string" ||
    !Array.isArray(l.locations) ||
    !l.locations.length ||
    l.locations.some((x) => typeof x !== "string" || !x.trim())
  )
    throw new Error("invalidBackup");
  for (const key of [
    "books",
    "copies",
    "loans",
    "wishes",
    "drafts",
    "activity",
  ] as const)
    if (!Array.isArray(l[key]) || l[key].length > 20000)
      throw new Error("invalidBackup");
  for (const rows of [l.books, l.copies, l.loans, l.wishes, l.drafts]) {
    const ids = rows.map((x) => x.id);
    if (
      ids.some((x) => typeof x !== "string" || !x) ||
      new Set(ids).size !== ids.length
    )
      throw new Error("invalidBackup");
  }
  const stringFields = (obj: object, keys: string[]) => {
    for (const key of keys)
      if (typeof (obj as Record<string, unknown>)[key] !== "string")
        throw new Error("invalidBackup");
  };
  for (const b of l.books) {
    stringFields(b, [
      "title",
      "author",
      "genre",
      "language",
      "isbn",
      "aliases",
      "cover",
      "added",
      "review",
    ]);
    if (
      !b.title.trim() ||
      !Number.isInteger(b.rating) ||
      b.rating < 0 ||
      b.rating > 5
    )
      throw new Error("invalidBackup");
    if (b.cover && !/^https:\/\/|^\/api\/images\//.test(b.cover))
      throw new Error("invalidBackup");
  }
  for (const c of l.copies) {
    stringFields(c, ["bookId", "location", "note", "added"]);
    if (
      !l.books.some((b) => b.id === c.bookId) ||
      !["available", "reading", "loaned", "unknown"].includes(c.status)
    )
      throw new Error("invalidBackup");
  }
  for (const loan of l.loans) {
    stringFields(loan, ["copyId", "borrower", "date", "previousLocation"]);
    if (
      !l.copies.some((c) => c.id === loan.copyId) ||
      !loan.borrower.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(loan.date) ||
      !Number.isFinite(Date.parse(loan.date)) ||
      (loan.returned !== null &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(loan.returned) ||
          !Number.isFinite(Date.parse(loan.returned))))
    )
      throw new Error("invalidBackup");
  }
  for (const c of l.copies) {
    const active = l.loans.filter((x) => x.copyId === c.id && !x.returned);
    if (active.length > 1 || (c.status === "loaned") !== (active.length === 1))
      throw new Error("invalidBackup");
  }
  for (const b of l.books)
    if (!l.copies.some((c) => c.bookId === b.id))
      throw new Error("invalidBackup");
  for (const w of l.wishes) {
    stringFields(w, ["title"]);
    if (typeof w.purchased !== "boolean") throw new Error("invalidBackup");
  }
  for (const d of l.drafts) {
    stringFields(d, ["image", "text", "created"]);
    if (!/^\/api\/images\//.test(d.image)) throw new Error("invalidBackup");
  }
  for (const a of l.activity) stringFields(a, ["date", "action"]);
}
