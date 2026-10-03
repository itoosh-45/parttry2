"use client";
import { Star } from "lucide-react";
import { Book, Copy, Library } from "../lib/model";
import { MessageKey } from "../lib/i18n";
import { Cover, Dialog, T } from "./library-forms";
type Props={id:string;data:Library;t:T;busy:boolean;change:(edit:(data:Library)=>void,action:string)=>Promise<boolean>;setDialog:(dialog:Dialog|null)=>void;deleteBook:(book:Book)=>Promise<void>;setError:(error:MessageKey|null)=>void};
export function BookDetails({id,data,t,busy,change,setDialog,deleteBook,setError}:Props){
const copiesOf=(bookId:string)=>data.copies.filter(c=>c.bookId===bookId);
const active=data.loans.filter(l=>!l.returned);
const book = data.books.find((b) => b.id === id);
              if (!book) return null;
              const copies = copiesOf(book.id);
              return (
                <div className="details">
                  <div className="detail-intro">
                    <Cover book={book} label={t("noCover")} />
                    <div>
                      <span className="eyebrow">
                        {book.genre || t("library")}
                      </span>
                      <h2>{book.title}</h2>
                      <p>{book.author}</p>
                      <span>{data.owner || t("brand")}</span>
                      <div className="inline-actions">
                        <button
                          onClick={() =>
                            setDialog({ type: "edit", editor: book })
                          }
                        >
                          {t("edit")}
                        </button>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => void deleteBook(book)}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                  <dl className="book-meta">
                    <div>
                      <dt>{t("isbn")}</dt>
                      <dd dir="ltr">{book.isbn || "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("language")}</dt>
                      <dd>
                        {book.language === "he"
                          ? t("hebrew")
                          : book.language === "en"
                            ? t("english")
                            : book.language}
                      </dd>
                    </div>
                    {book.aliases && (
                      <div>
                        <dt>{t("aliases")}</dt>
                        <dd>{book.aliases}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="section-head">
                    <h3>
                      {copies.length} {t("copies")}
                    </h3>
                    <button
                      onClick={() =>
                        setDialog({
                          type: "edit",
                          editor: {
                            ...book,
                            id: undefined,
                            location: data.locations[0],
                          },
                        })
                      }
                    >
                      {t("addCopy")}
                    </button>
                  </div>
                  {copies.map((c) => (
                    <article className="copy-row" key={c.id}>
                      <div>
                        <strong>
                          {t(c.status === "reading" ? "reading" : c.status)}
                        </strong>
                        <p>
                          {c.status === "loaned" ? `${t("borrower")}: ` : ""}
                          {c.location} · {c.id.slice(0, 4)}
                        </p>
                        {c.note && <small>{c.note}</small>}
                      </div>
                      <div className="inline-actions">
                        {c.status === "available" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void change((d) => {
                                  d.copies.find((x) => x.id === c.id)!.status =
                                    "reading";
                                }, "reading")
                              }
                            >
                              {t("start")}
                            </button>
                            <button
                              onClick={() =>
                                setDialog({ type: "loan", copyId: c.id })
                              }
                            >
                              {t("lend")}
                            </button>
                          </>
                        )}
                        {c.status === "reading" && (
                          <>
                            {["finish", "stop"].map((s) => (
                              <button
                                key={s}
                                disabled={busy}
                                onClick={() =>
                                  void change((d) => {
                                    d.copies.find(
                                      (x) => x.id === c.id,
                                    )!.status = "available";
                                  }, s)
                                }
                              >
                                {t(s as MessageKey)}
                              </button>
                            ))}
                          </>
                        )}
                        {c.status === "loaned" && (
                          <button
                            onClick={() =>
                              setDialog({
                                type: "return",
                                loan: active.find((l) => l.copyId === c.id)!,
                              })
                            }
                          >
                            {t("returned")}
                          </button>
                        )}
                        {c.status !== "loaned" && (
                          <>
                            <button
                              onClick={() =>
                                setDialog({
                                  type: "edit",
                                  editor: {
                                    copyId: c.id,
                                    location: c.location,
                                    note: c.note,
                                  },
                                })
                              }
                            >
                              {t("edit")}
                            </button>
                            <select
                              aria-label={t("status")}
                              value={c.status}
                              disabled={busy}
                              onChange={(e) => {
                                const value = e.target.value as Copy["status"];
                                void change((d) => {
                                  d.copies.find((x) => x.id === c.id)!.status =
                                    value;
                                }, "copy-status");
                              }}
                            >
                              {["available", "reading", "unknown"].map((s) => (
                                <option key={s} value={s}>
                                  {t(s as MessageKey)}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        {copies.length > 1 && (
                          <button
                            disabled={busy}
                            className="danger"
                            onClick={() => {
                              if (data.loans.some((l) => l.copyId === c.id)) {
                                setError("copyBlocked");
                                return;
                              }
                              void change((d) => {
                                d.copies = d.copies.filter(
                                  (x) => x.id !== c.id,
                                );
                              }, "delete-copy");
                            }}
                          >
                            {t("removeCopy")}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  <section className="rating-panel">
                    <h3>{t("rating")}</h3>
                    <p>{t("ratingHint")}</p>
                    <div className="stars">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          disabled={busy}
                          aria-label={`${n} ${t("rating")}`}
                          aria-pressed={book.rating === n}
                          onClick={() =>
                            void change((d) => {
                              d.books.find((b) => b.id === book.id)!.rating = n;
                            }, "rate")
                          }
                        >
                          <Star
                            size={28}
                            fill={book.rating >= n ? "currentColor" : "none"}
                          />
                        </button>
                      ))}
                    </div>
                    <form
                      key={book.id + book.review}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const review = String(
                          new FormData(e.currentTarget).get("review"),
                        );
                        void change((d) => {
                          d.books.find((b) => b.id === book.id)!.review =
                            review;
                        }, "review");
                      }}
                    >
                      <label>
                        {t("review")}
                        <textarea
                          name="review"
                          defaultValue={book.review}
                          maxLength={2000}
                        />
                      </label>
                      <div className="inline-actions">
                        <button disabled={busy}>{t("save")}</button>
                        {(book.rating > 0 || book.review) && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void change((d) => {
                                const b = d.books.find(
                                  (x) => x.id === book.id,
                                )!;
                                b.rating = 0;
                                b.review = "";
                              }, "remove-rating")
                            }
                          >
                            {t("removeRating")}
                          </button>
                        )}
                      </div>
                    </form>
                  </section>
                  {data.loans.some((l) =>
                    copies.some((c) => c.id === l.copyId),
                  ) && (
                    <section>
                      <h3>{t("history")}</h3>
                      {data.loans
                        .filter((l) => copies.some((c) => c.id === l.copyId))
                        .map((l) => (
                          <p key={l.id}>
                            {l.borrower} · {l.date} —{" "}
                            {l.returned || t("active")}
                          </p>
                        ))}
                    </section>
                  )}
                </div>
              );
            
}

