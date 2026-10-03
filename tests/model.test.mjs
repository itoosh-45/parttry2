import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  emptyLibrary,
  duplicateBook,
  halfYear,
  validateLibrary,
  normalize,
} from "../lib/model.ts";

const fixture = () => {
  const data = emptyLibrary();
  data.books.push({
    id: "b",
    title: "ספר",
    author: "מחבר",
    genre: "",
    language: "he",
    isbn: "978-0000000000",
    aliases: "",
    cover: "",
    added: "2026-01-01",
    rating: 0,
    review: "",
  });
  data.copies.push({
    id: "c",
    bookId: "b",
    location: "home",
    status: "available",
    note: "",
    added: "2026-01-01",
  });
  return data;
};
test("Hebrew search ignores vowel marks and punctuation", () =>
  assert.equal(normalize("סֵפֶר!"), normalize("ספר")));
test("same title by different authors is a distinct title", () => {
  const data = fixture();
  assert.equal(
    duplicateBook(data, { title: "ספר", author: "אחר", isbn: "" }),
    undefined,
  );
  assert.equal(
    duplicateBook(data, { title: "ספר", author: "מחבר", isbn: "" }).id,
    "b",
  );
});
test("ISBN matches even when displayed with separators", () =>
  assert.equal(
    duplicateBook(fixture(), {
      title: "Different",
      author: "Other",
      isbn: "9780000000000",
    }).id,
    "b",
  ));
test("six-month reminders respect calendar months and short February", () => {
  assert.equal(halfYear("2026-04-03", new Date("2026-10-02T12:00:00")), false);
  assert.equal(halfYear("2026-04-03", new Date("2026-10-03T12:00:00")), true);
  assert.equal(halfYear("2025-08-31", new Date("2026-02-28T13:00:00")), true);
});
test("backup rejects orphan copies, duplicate ids and invalid ratings", () => {
  const data = fixture();
  validateLibrary(data);
  data.copies[0].bookId = "missing";
  assert.throws(() => validateLibrary(data));
  data.copies[0].bookId = "b";
  data.copies.push({ ...data.copies[0] });
  assert.throws(() => validateLibrary(data));
  data.copies.pop();
  data.books[0].rating = 6;
  assert.throws(() => validateLibrary(data));
});
test("active loan and copy status must agree; double lending is rejected", () => {
  const data = fixture();
  const loan = {
    id: "l",
    copyId: "c",
    borrower: "Dana",
    date: "2026-01-01",
    previousLocation: "home",
    returned: null,
  };
  data.loans.push(loan);
  assert.throws(() => validateLibrary(data));
  data.copies[0].status = "loaned";
  validateLibrary(data);
  data.loans.push({ ...loan, id: "l2" });
  assert.throws(() => validateLibrary(data));
});
test("return keeps history and supports restoring the previous state", () => {
  const data = fixture();
  data.copies[0].status = "loaned";
  data.loans.push({
    id: "l",
    copyId: "c",
    borrower: "Dana",
    date: "2026-01-01",
    previousLocation: "home",
    returned: null,
  });
  const previous = structuredClone(data);
  data.copies[0].status = "available";
  data.copies[0].location = "office";
  data.loans[0].returned = "2026-10-03";
  data.loans[0].returnLocation = "office";
  validateLibrary(data);
  assert.equal(data.loans.length, 1);
  validateLibrary(previous);
  assert.equal(previous.copies[0].status, "loaned");
});
test("prepared optimistic writes reject stale device data without changing saved records", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE library (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)",
  );
  const insert = db.prepare(
    "INSERT INTO library (id, data, revision, updated_at) SELECT ?, ?, 1, ? WHERE ? = 0 ON CONFLICT(id) DO UPDATE SET data = excluded.data, revision = library.revision + 1, updated_at = excluded.updated_at WHERE library.revision = ? RETURNING revision",
  );
  const update = db.prepare(
    "UPDATE library SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING revision",
  );
  assert.equal(insert.get("personal", "first", "now", 0, 0).revision, 1);
  assert.equal(insert.get("personal", "stale", "now", 0, 0), undefined);
  assert.equal(update.get("second", "now", "personal", 1).revision, 2);
  assert.equal(update.get("lost", "now", "personal", 1), undefined);
  assert.equal(db.prepare("SELECT data FROM library").get().data, "second");
  db.close();
});
