"use client";
import { BookDetails } from "../components/book-details";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  LibraryBig,
  House,
  Plus,
  Handshake,
  MoreHorizontal,
  Camera,
  Search,
  Bell,
  Heart,
  Settings,
  X,
  Upload,
  LayoutGrid,
  List,
  Bookmark,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Book,
  Copy,
  Loan,
  Library,
  Draft,
  duplicateBook,
  emptyLibrary,
  halfYear,
  normalize,
  validateLibrary,
} from "../lib/model";
import { messages, MessageKey } from "../lib/i18n";
import { upload } from "../lib/photos";
import {
  AddMethods,
  Barcode,
  Cover,
  Editor,
  Dialog,
  EditorForm,
  Empty,
  Field,
  LoanForm,
  Modal,
  PageTitle,
  PhotoFlow,
  ReturnForm,
  Select,
  today,
} from "../components/library-forms";
type Page =
  | "home"
  | "library"
  | "loans"
  | "reading"
  | "wishes"
  | "alerts"
  | "settings"
  | "more";
const uid = () => crypto.randomUUID();
const newBook = (e: Editor): Book => ({
  id: uid(),
  title: e.title?.trim() ?? "",
  author: e.author?.trim() ?? "",
  genre: e.genre?.trim() ?? "",
  language: e.language ?? "he",
  isbn: e.isbn?.trim() ?? "",
  aliases: e.aliases?.trim() ?? "",
  cover: e.cover ?? "",
  added: new Date().toISOString(),
  rating: 0,
  review: "",
});

export default function App() {
  const [lang, setLang] = useState<"he" | "en">("he");
  const [now, setNow] = useState(() => Date.now());
  const t = (key: MessageKey) => messages[lang][key];
  const [data, setData] = useState<Library>(emptyLibrary);
  const current = useRef({ data: emptyLibrary(), revision: 0 });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [page, setPage] = useState<Page>("home");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<{
    key: MessageKey;
    before?: Library;
    revision?: number;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [bookLanguage, setBookLanguage] = useState("");
  const [minimum, setMinimum] = useState(0);
  const [sort, setSort] = useState("added");
  const [view, setView] = useState("grid");
  const [history, setHistory] = useState(false);
  const [wish, setWish] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [counts, setCounts] = useState({ titles: 0, copies: 0 });
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const preference = localStorage.getItem("library-language");
    // Restore a browser-only preference after the server's Hebrew initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preference === "en") setLang("en");
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    localStorage.setItem("library-language", lang);
  }, [lang]);
  async function load() {
    if (saving.current) return;
    try {
      const r = await fetch("/api/library", { cache: "no-store" });
      if (!r.ok) throw new Error("storageError");
      const result = (await r.json()) as { data: Library; revision: number };
      validateLibrary(result.data);
      if (saving.current || result.revision < current.current.revision) return;
      current.current = { data: result.data, revision: result.revision };
      setData(result.data);
      setNow(Date.now());
      setLoaded(true);
      setError(null);
    } catch {
      setError("storageError");
    }
  }
  useEffect(() => {
    // Load authoritative external state once on mount, retaining SSR's empty shell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  useEffect(() => {
    if (dialog || busy || !loaded) return;
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !document.querySelector("input:focus,textarea:focus")
      )
        void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [dialog, busy, loaded]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 12000);
    return () => clearTimeout(id);
  }, [toast]);
  async function persist(next: Library, undo = true) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      validateLibrary(next);
      const before = structuredClone(current.current.data);
      const r = await fetch("/api/library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: next,
          revision: current.current.revision,
        }),
      });
      if (!r.ok) {
        const e = (await r.json()) as { error: string };
        throw new Error(e.error);
      }
      const result = (await r.json()) as { revision: number };
      current.current = { data: next, revision: result.revision };
      setToast({
        key: "saved",
        before: undo ? before : undefined,
        revision: result.revision,
      });
      setData(next);
      return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError((code in messages.he ? code : "storageError") as MessageKey);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function change(edit: (d: Library) => void, action: string) {
    const next = structuredClone(current.current.data);
    edit(next);
    next.activity.unshift({ date: new Date().toISOString(), action });
    next.activity = next.activity.slice(0, 1000);
    return persist(next);
  }
  const active = data.loans.filter((x) => !x.returned);
  const reminders = active.filter((x) => halfYear(x.date, new Date(now)));
  const alertCount = reminders.length + data.drafts.length;
  const copiesOf = (id: string) => data.copies.filter((c) => c.bookId === id);
  const bookOf = (copyId: string) =>
    data.books.find(
      (b) => b.id === data.copies.find((c) => c.id === copyId)?.bookId,
    );
  const filtered = data.books
    .filter((b) => {
      const copies = copiesOf(b.id);
      return (
        (!query ||
          normalize(
            [
              b.title,
              b.author,
              b.aliases,
              b.genre,
              data.owner,
              ...copies.map((c) => c.location),
            ].join(" "),
          ).includes(normalize(query))) &&
        (!genre || b.genre === genre) &&
        (!status || copies.some((c) => c.status === status)) &&
        (!location || copies.some((c) => c.location === location)) &&
        (!bookLanguage || b.language === bookLanguage) &&
        b.rating >= minimum
      );
    })
    .sort((a, b) =>
      sort === "rating"
        ? b.rating - a.rating
        : sort === "added"
          ? b.added.localeCompare(a.added)
          : String(a[sort as "title" | "author"]).localeCompare(
              String(b[sort as "title" | "author"]),
              lang,
            ),
    );
  function clear() {
    setQuery("");
    setGenre("");
    setStatus("");
    setLocation("");
    setBookLanguage("");
    setMinimum(0);
  }
  async function deleteBook(book: Book) {
    const cs = copiesOf(book.id);
    if (cs.some((c) => c.status === "loaned")) {
      setError("deleteBlocked");
      return;
    }
    if (
      data.loans.some((l) => cs.some((c) => c.id === l.copyId)) &&
      !confirm(t("deleteConfirm"))
    )
      return;
    if (
      await change((d) => {
        const ids = cs.map((c) => c.id);
        d.books = d.books.filter((b) => b.id !== book.id);
        d.copies = d.copies.filter((c) => c.bookId !== book.id);
        d.loans = d.loans.filter((l) => !ids.includes(l.copyId));
      }, "delete-book")
    )
      setDialog(null);
  }
  async function exportBackup() {
    setBusy(true);
    try {
      const snapshot = structuredClone(current.current.data);
      const urls = [
        ...new Set(
          [
            ...snapshot.books.map((b) => b.cover),
            ...snapshot.drafts.map((d) => d.image),
          ].filter((u) => u.startsWith("/api/images/")),
        ),
      ];
      const images: Record<string, string> = {};
      for (const url of urls) {
        const r = await fetch(url);
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        images[url] = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const blob = new Blob(
        [
          JSON.stringify(
            { format: "personal-library", version: 1, data: snapshot, images },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-library-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("storageError");
    } finally {
      setBusy(false);
    }
  }
  async function importBackup(file: File) {
    try {
      if (file.size > 100_000_000) throw new Error();
      const backup = JSON.parse(await file.text());
      if (backup.format !== "personal-library" || backup.version !== 1)
        throw new Error();
      validateLibrary(backup.data);
      if (!backup.images || typeof backup.images !== "object")
        throw new Error();
      const imageMap = backup.images as Record<string, string>;
      for (const [url, value] of Object.entries(imageMap)) {
        if (
          !url.startsWith("/api/images/") ||
          typeof value !== "string" ||
          !/^data:image\/(jpeg|png|webp);base64,/.test(value) ||
          value.length > 7_000_000
        )
          throw new Error();
      }
      const needed = [
        ...backup.data.books.map((b: Book) => b.cover),
        ...backup.data.drafts.map((d: Draft) => d.image),
      ].filter((s: string) => s.startsWith("/api/images/"));
      if (needed.some((url: string) => !imageMap[url])) throw new Error();
      if (!confirm(t("importConfirm"))) return;
      setBusy(true);
      const mapping: Record<string, string> = {};
      for (const [old, value] of Object.entries(imageMap)) {
        const blob = await (await fetch(value)).blob();
        mapping[old] = await upload(blob);
      }
      for (const b of backup.data.books) b.cover = mapping[b.cover] ?? b.cover;
      for (const d of backup.data.drafts) d.image = mapping[d.image];
      await persist(backup.data);
    } catch {
      setError("invalidBackup");
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = "";
    }
  }
  async function saveEditor(
    e: Editor,
    duplicate?: string,
  ): Promise<{ ok?: boolean; duplicate?: Book }> {
    const match =
      !e.id && !e.copyId && !duplicate
        ? duplicateBook(current.current.data, newBook(e))
        : undefined;
    if (match) return { duplicate: match };
    let wasNew = false;
    const ok = await change((d) => {
      if (e.id) {
        const b = d.books.find((b) => b.id === e.id)!;
        Object.assign(b, {
          title: e.title!.trim(),
          author: e.author?.trim() ?? "",
          genre: e.genre ?? "",
          language: e.language ?? "he",
          isbn: e.isbn ?? "",
          aliases: e.aliases ?? "",
          cover: e.cover ?? "",
        });
      } else if (e.copyId) {
        const c = d.copies.find((c) => c.id === e.copyId)!;
        c.location = e.location!;
        c.note = e.note ?? "";
      } else {
        const book =
          duplicate && duplicate !== "force-new"
            ? d.books.find((b) => b.id === duplicate)!
            : newBook(e);
        if (!duplicate || duplicate === "force-new") {
          d.books.push(book);
          wasNew = true;
        }
        d.copies.push({
          id: uid(),
          bookId: book.id,
          location: e.location || d.locations[0],
          status: "available",
          note: e.note ?? "",
          added: new Date().toISOString(),
        });
        if (e.wishId) {
          const w = d.wishes.find((w) => w.id === e.wishId);
          if (w) {
            w.purchased = true;
            book.purchasedFrom = w.id;
          }
        }
      }
    }, "save-book");
    if (ok) {
      if (!e.id && !e.copyId)
        setCounts((c) => ({
          titles: c.titles + (wasNew ? 1 : 0),
          copies: c.copies + 1,
        }));
      setDialog(null);
    }
    return { ok };
  }
  const nav = [
    { id: "home", icon: House },
    { id: "library", icon: LibraryBig },
    { id: "add", icon: Plus },
    { id: "loans", icon: Handshake },
    { id: "more", icon: MoreHorizontal },
  ] as const;
  const extra = [
    { id: "reading", icon: Bookmark },
    { id: "wishes", icon: Heart },
    { id: "alerts", icon: Bell },
    { id: "settings", icon: Settings },
  ];
  function go(id: string) {
    if (id === "add") setDialog({ type: "add" });
    else {
      setPage(id as Page);
      setQuery("");
      if (id === "alerts") setDismissed([]);
    }
  }
  const bookCard = (b: Book) => (
    <button
      className={`book-card ${view === "list" ? "list-card" : ""}`}
      key={b.id}
      onClick={() => setDialog({ type: "detail", id: b.id })}
    >
      <Cover book={b} label={t("noCover")} />
      <span className="book-copy">
        <strong>{b.title}</strong>
        <span>{b.author || "—"}</span>
        <small>
          {data.owner || t("brand")}
          {copiesOf(b.id).length > 1
            ? ` · ${copiesOf(b.id).length} ${t("copies")}`
            : ""}
        </small>
      </span>
    </button>
  );
  const bookSection = (label: MessageKey, books: Book[], hint?: MessageKey) => (
    <section className="book-section">
      <div className="section-head">
        <div>
          <h2>{t(label)}</h2>
          {hint && <p>{t(hint)}</p>}
        </div>
        <span className="section-count">{books.length}</span>
      </div>
      <div className="books">{books.map(bookCard)}</div>
    </section>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => go("home")}>
          <span className="brand-icon">
            <BookOpen size={25} />
          </span>
          <span>
            <b>{t("brand")}</b>
            <small>{t("personal")}</small>
          </span>
        </button>
        <nav aria-label={t("library")}>
          {nav
            .filter((n) => n.id !== "more")
            .map((n) => (
              <button
                key={n.id}
                className={
                  (page === n.id ? "selected " : "") +
                  (n.id === "add" ? "nav-add" : "")
                }
                onClick={() => go(n.id)}
                disabled={n.id === "add" && !loaded}
              >
                <n.icon size={21} />
                {t(n.id as MessageKey)}
              </button>
            ))}
          <div className="nav-divider" />
          {extra.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "selected" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={21} />
              {t(n.id as MessageKey)}
              {n.id === "alerts" && alertCount > 0 && (
                <span className="badge">{alertCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{data.owner?.[0] || "א"}</span>
          <span>
            {data.owner || t("brand")}
            <small>{t("owner")}</small>
          </span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>{t(page as MessageKey)}</span>
          <div>
            <button
              className="language-toggle"
              onClick={() => setLang(lang === "he" ? "en" : "he")}
            >
              {lang === "he" ? "EN" : "עב"}
            </button>
            <button
              className="notification-button"
              aria-label={t("alerts")}
              onClick={() => go("alerts")}
            >
              <Bell size={19} />
              <span>{t("alerts")}</span>
              {alertCount > 0 && <b>{alertCount}</b>}
            </button>
          </div>
        </header>
        <div className="content">
          {offline && (
            <div role="status" className="notice">
              {t("offline")}
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {t(error)}{" "}
              <button onClick={() => void load()}>{t("reload")}</button>
            </div>
          )}
          {!loaded ? (
            <div className="empty">
              <BookOpen size={42} />
              <h1>{t("loading")}</h1>
              {error && (
                <button className="primary" onClick={() => void load()}>
                  {t("retry")}
                </button>
              )}
            </div>
          ) : (
            <>
              {(page === "home" || page === "library") && (
                <>
                  <div className="page-title">
                    <div>
                      <span className="eyebrow">
                        {data.owner || t("brand")}
                      </span>
                      <h1>{page === "home" ? t("welcome") : t("library")}</h1>
                      <p>{t("homeHint")}</p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setDialog({ type: "add" })}
                    >
                      <Plus size={19} />
                      {t("add")}
                    </button>
                  </div>
                  <div className="searchbar">
                    <Search size={22} />
                    <input
                      aria-label={t("search")}
                      placeholder={t("search")}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        if (page === "home") setPage("library");
                      }}
                    />
                    {query && (
                      <button
                        aria-label={t("clear")}
                        onClick={() => setQuery("")}
                      >
                        <X size={19} />
                      </button>
                    )}
                  </div>
                  {page === "home" && (
                    <>
                      <div className="quick-actions">
                        <button onClick={() => setDialog({ type: "photo" })}>
                          <Camera size={24} />
                          <span>{t("photo")}</span>
                        </button>
                        <button onClick={() => setDialog({ type: "loan" })}>
                          <Handshake size={24} />
                          <span>{t("lend")}</span>
                        </button>
                        <button onClick={() => go("reading")}>
                          <Bookmark size={24} />
                          <span>{t("reading")}</span>
                        </button>
                      </div>
                      {reminders.length > 0 && (
                        <button
                          className="reminder-strip"
                          onClick={() => go("loans")}
                        >
                          <Bell size={20} />
                          {t("months")} · {reminders.length}
                        </button>
                      )}
                      {data.books.length === 0 ? (
                        <Empty
                          icon={<BookOpen size={48} />}
                          title={t("empty")}
                          hint={t("emptyHint")}
                        >
                          <button
                            className="primary"
                            onClick={() => setDialog({ type: "add" })}
                          >
                            {t("add")}
                          </button>
                        </Empty>
                      ) : (
                        <>
                          {data.books.some((b) =>
                            copiesOf(b.id).some((c) => c.status === "reading"),
                          ) &&
                            bookSection(
                              "reading",
                              data.books.filter((b) =>
                                copiesOf(b.id).some(
                                  (c) => c.status === "reading",
                                ),
                              ),
                            )}
                          {bookSection(
                            "recent",
                            [...data.books]
                              .sort((a, b) => b.added.localeCompare(a.added))
                              .slice(0, 8),
                          )}
                          {data.books.some((b) => b.rating >= 4) &&
                            bookSection(
                              "recommended",
                              data.books
                                .filter((b) => b.rating >= 4)
                                .sort((a, b) => b.rating - a.rating),
                              "recommendReason",
                            )}
                        </>
                      )}
                    </>
                  )}
                  {page === "library" && (
                    <>
                      <div className="filters">
                        <Select
                          label={t("genre")}
                          value={genre}
                          onChange={setGenre}
                          all={t("all")}
                          options={[
                            ...new Set(
                              data.books.map((b) => b.genre).filter(Boolean),
                            ),
                          ]}
                        />
                        <Select
                          label={t("location")}
                          value={location}
                          onChange={setLocation}
                          all={t("all")}
                          options={[
                            ...new Set([
                              ...data.locations,
                              ...data.copies.map((c) => c.location),
                            ]),
                          ]}
                        />
                        <Select
                          label={t("status")}
                          value={status}
                          onChange={setStatus}
                          all={t("all")}
                          options={[
                            "available",
                            "reading",
                            "loaned",
                            "unknown",
                          ].map((s) => ({
                            value: s,
                            label: t(s as MessageKey),
                          }))}
                        />
                        <Select
                          label={t("language")}
                          value={bookLanguage}
                          onChange={setBookLanguage}
                          all={t("all")}
                          options={[
                            { value: "he", label: t("hebrew") },
                            { value: "en", label: t("english") },
                            ...[...new Set(data.books.map((b) => b.language))]
                              .filter((s) => s !== "he" && s !== "en")
                              .map((s) => ({ value: s, label: s })),
                          ]}
                        />
                        <label>
                          {t("rating")}
                          <select
                            value={minimum}
                            onChange={(e) => setMinimum(Number(e.target.value))}
                          >
                            <option value={0}>{t("all")}</option>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n} ★ +
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="results-head">
                        <span>
                          {filtered.length} {t("titles")}
                        </span>
                        <div>
                          <label className="sort-label">
                            {t("sort")}
                            <select
                              value={sort}
                              onChange={(e) => setSort(e.target.value)}
                            >
                              {["added", "title", "author", "rating"].map(
                                (s) => (
                                  <option key={s} value={s}>
                                    {t(s as MessageKey)}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <button
                            aria-label={t("grid")}
                            aria-pressed={view === "grid"}
                            onClick={() => setView("grid")}
                          >
                            <LayoutGrid size={19} />
                          </button>
                          <button
                            aria-label={t("list")}
                            aria-pressed={view === "list"}
                            onClick={() => setView("list")}
                          >
                            <List size={19} />
                          </button>
                        </div>
                      </div>
                      {filtered.length ? (
                        <div
                          className={`books ${view === "list" ? "list-view" : ""}`}
                        >
                          {filtered.map(bookCard)}
                        </div>
                      ) : (
                        <Empty title={t("noResults")} hint={t("emptyHint")}>
                          <button onClick={clear}>{t("clear")}</button>
                          {query && (
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() =>
                                void change((d) => {
                                  d.wishes.push({
                                    id: uid(),
                                    title: query,
                                    purchased: false,
                                  });
                                }, "add-wish")
                              }
                            >
                              {t("addWish")}
                            </button>
                          )}
                        </Empty>
                      )}
                    </>
                  )}
                </>
              )}
              {page === "loans" && (
                <>
                  <PageTitle title={t("loans")} hint={t("loanHint")} />
                  <div className="section-head">
                    <div className="tabs">
                      <button
                        className={!history ? "active" : ""}
                        onClick={() => setHistory(false)}
                      >
                        {t("active")}
                      </button>
                      <button
                        className={history ? "active" : ""}
                        onClick={() => setHistory(true)}
                      >
                        {t("history")}
                      </button>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setDialog({ type: "loan" })}
                    >
                      <Plus size={18} />
                      {t("lend")}
                    </button>
                  </div>
                  {(history ? data.loans.filter((l) => l.returned) : active)
                    .length === 0 && (
                    <Empty
                      title={t("noItems")}
                      icon={<Handshake size={42} />}
                    />
                  )}
                  <div className="rows">
                    {(history
                      ? data.loans.filter((l) => l.returned)
                      : active
                    ).map((l) => {
                      const b = bookOf(l.copyId);
                      return (
                        b && (
                          <article
                            key={l.id}
                            className={`loan-row ${!l.returned && halfYear(l.date, new Date(now)) ? "long-loan" : ""}`}
                          >
                            <button
                              className="row-cover"
                              aria-label={t("viewBook") + ": " + b.title}
                              onClick={() =>
                                setDialog({ type: "detail", id: b.id })
                              }
                            >
                              <Cover book={b} label={t("noCover")} />
                            </button>
                            <div className="row-main">
                              <h3>{b.title}</h3>
                              <p>
                                {l.borrower} · {data.owner || t("brand")}
                              </p>
                              <small>
                                {l.date} ·{" "}
                                {Math.max(
                                  0,
                                  Math.floor(
                                    (now - Date.parse(l.date)) /
                                      86400000,
                                  ),
                                )}{" "}
                                {t("days")}
                              </small>
                              {!l.returned && halfYear(l.date, new Date(now)) && (
                                <p className="gentle">{t("months")}</p>
                              )}
                              {l.returned && (
                                <small>
                                  {t("returnDate")}: {l.returned} ·{" "}
                                  {l.returnLocation}
                                </small>
                              )}
                            </div>
                            {!l.returned && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setDialog({ type: "return", loan: l })
                                }
                              >
                                {t("returned")}
                              </button>
                            )}
                          </article>
                        )
                      );
                    })}
                  </div>
                </>
              )}
              {page === "reading" && (
                <>
                  <PageTitle title={t("reading")} />
                  {!data.copies.some((c) => c.status === "reading") && (
                    <Empty title={t("noItems")} icon={<Bookmark size={42} />} />
                  )}
                  <div className="rows">
                    {data.copies
                      .filter((c) => c.status === "reading")
                      .map((c) => {
                        const b = bookOf(c.id)!;
                        return (
                          <article className="loan-row" key={c.id}>
                            <button
                              className="row-cover"
                              aria-label={t("viewBook") + ": " + b.title}
                              onClick={() =>
                                setDialog({ type: "detail", id: b.id })
                              }
                            >
                              <Cover book={b} label={t("noCover")} />
                            </button>
                            <div className="row-main">
                              <h3>{b.title}</h3>
                              <p>
                                {b.author} · {c.location}
                              </p>
                              <div className="inline-actions">
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
                                {copiesOf(b.id).some(
                                  (x) =>
                                    x.id !== c.id && x.status === "available",
                                ) && (
                                  <label>
                                    {t("switchCopy")}
                                    <select
                                      defaultValue=""
                                      disabled={busy}
                                      onChange={(e) => {
                                        const id = e.target.value;
                                        if (id)
                                          void change((d) => {
                                            d.copies.find(
                                              (x) => x.id === c.id,
                                            )!.status = "available";
                                            d.copies.find(
                                              (x) => x.id === id,
                                            )!.status = "reading";
                                          }, "switch-copy");
                                      }}
                                    >
                                      <option value="">{t("choose")}</option>
                                      {copiesOf(b.id)
                                        .filter(
                                          (x) =>
                                            x.id !== c.id &&
                                            x.status === "available",
                                        )
                                        .map((x) => (
                                          <option key={x.id} value={x.id}>
                                            {x.location} · {x.id.slice(0, 4)}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                </>
              )}
              {page === "wishes" && (
                <>
                  <PageTitle title={t("wishes")} hint={t("wishHint")} />
                  <form
                    className="wish-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (wish.trim())
                        void change((d) => {
                          d.wishes.push({
                            id: uid(),
                            title: wish.trim(),
                            purchased: false,
                          });
                        }, "add-wish").then((ok) => {
                          if (ok) setWish("");
                        });
                    }}
                  >
                    <input
                      aria-label={t("title")}
                      required
                      placeholder={t("title")}
                      value={wish}
                      onChange={(e) => setWish(e.target.value)}
                    />
                    <button className="primary" disabled={busy}>
                      {t("add")}
                    </button>
                  </form>
                  {!data.wishes.length && (
                    <Empty title={t("noItems")} icon={<Heart size={42} />} />
                  )}
                  <div className="rows">
                    {data.wishes.map((w) => (
                      <article className="simple-row" key={w.id}>
                        <div>
                          <h3>{w.title}</h3>
                          <small>
                            {data.owner || t("brand")}
                            {w.purchased ? ` · ${t("purchased")}` : ""}
                          </small>
                        </div>
                        <div className="inline-actions">
                          {!w.purchased && (
                            <button
                              onClick={() =>
                                setDialog({
                                  type: "edit",
                                  editor: { title: w.title, wishId: w.id },
                                })
                              }
                            >
                              {t("buy")}
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() =>
                              void change((d) => {
                                d.wishes = d.wishes.filter(
                                  (x) => x.id !== w.id,
                                );
                              }, "delete-wish")
                            }
                          >
                            {t("delete")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {page === "alerts" && (
                <>
                  <PageTitle
                    title={t("alerts")}
                    hint={t("notificationsHint")}
                  />
                  {alertCount === 0 && (
                    <Empty
                      title={t("notificationsEmpty")}
                      icon={<Check size={42} />}
                    />
                  )}
                  <div className="rows">
                    {reminders
                      .filter((l) => !dismissed.includes(l.id))
                      .map((l) => (
                        <article className="simple-row" key={l.id}>
                          <div>
                            <h3>
                              {bookOf(l.copyId)?.title} · {l.borrower}
                            </h3>
                            <p>{t("months")}</p>
                          </div>
                          <div className="inline-actions">
                            <button
                              onClick={() =>
                                setDialog({ type: "return", loan: l })
                              }
                            >
                              {t("returned")}
                            </button>
                            <button
                              onClick={() => setDismissed([...dismissed, l.id])}
                            >
                              {t("dismiss")}
                            </button>
                          </div>
                        </article>
                      ))}
                    {data.drafts.map((d) => (
                      <article className="simple-row" key={d.id}>
                        <div>
                          <h3>{t("draft")}</h3>
                          <p>
                            {t("reviewNeeded")} ·{" "}
                            {new Date(d.created).toLocaleDateString(lang)}
                          </p>
                        </div>
                        <div className="inline-actions">
                          <button
                            onClick={() =>
                              setDialog({ type: "photo", draft: d })
                            }
                          >
                            {t("edit")}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void change((l) => {
                                l.drafts = l.drafts.filter(
                                  (x) => x.id !== d.id,
                                );
                              }, "delete-draft")
                            }
                          >
                            {t("delete")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {page === "more" && (
                <>
                  <PageTitle title={t("more")} />
                  <div className="more-links">
                    {extra.map((n) => (
                      <button key={n.id} onClick={() => go(n.id)}>
                        <n.icon size={24} />
                        {t(n.id as MessageKey)}
                        {n.id === "alerts" && alertCount > 0 && (
                          <span className="badge">{alertCount}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {page === "settings" && (
                <>
                  <PageTitle title={t("settings")} />
                  <div className="settings-panels">
                    <section className="panel">
                      <h2>{t("owner")}</h2>
                      <p>{t("profileHint")}</p>
                      <form
                        key={data.owner + data.locations.join("|")}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const values = new FormData(e.currentTarget);
                          const locations = [
                            ...new Set(
                              String(values.get("locations"))
                                .split("\n")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            ),
                          ];
                          if (!locations.length) {
                            setError("required");
                            return;
                          }
                          void change((d) => {
                            d.owner = String(values.get("owner")).trim();
                            d.locations = locations;
                          }, "settings");
                        }}
                      >
                        <Field
                          label={t("name")}
                          name="owner"
                          defaultValue={data.owner}
                        />
                        <label>
                          {t("locations")}
                          <textarea
                            name="locations"
                            defaultValue={data.locations.join("\n")}
                            required
                            rows={4}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          {t("save")}
                        </button>
                      </form>
                    </section>
                    <section className="panel">
                      <h2>{t("settings")}</h2>
                      <p>{t("backupHint")}</p>
                      <div className="stack-actions">
                        <button
                          disabled={busy}
                          onClick={() => void exportBackup()}
                        >
                          <Upload size={18} />
                          {t("export")}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => importRef.current?.click()}
                        >
                          <RotateCcw size={18} />
                          {t("import")}
                        </button>
                        <input
                          type="file"
                          ref={importRef}
                          hidden
                          accept="application/json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void importBackup(file);
                          }}
                        />
                        <button
                          onClick={() => setLang(lang === "he" ? "en" : "he")}
                        >
                          {lang === "he" ? "English" : "עברית"}
                        </button>
                      </div>
                      <p className="muted">{t("privacy")}</p>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <footer className="footer">
          {t("brand")}
          <span>·</span>
          <BookOpen size={15} />
        </footer>
      </main>
      <nav className="mobile-nav" aria-label={t("library")}>
        {nav.map((n) => (
          <button
            key={n.id}
            disabled={n.id === "add" && !loaded}
            className={
              (page === n.id ? "selected " : "") +
              (n.id === "add" ? "central-add" : "")
            }
            onClick={() => go(n.id)}
          >
            <n.icon size={23} />
            <span>{t(n.id as MessageKey)}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          {t(toast.key)}
          {toast.before && (
            <button
              disabled={busy}
              onClick={() => {
                if (toast.revision !== current.current.revision) {
                  setError("conflict");
                  return;
                }
                const before = toast.before!;
                void persist(before, false);
              }}
            >
              {t("undo")}
            </button>
          )}
          <button aria-label={t("close")} onClick={() => setToast(null)}>
            <X size={17} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          label={t(
            dialog.type === "detail"
              ? "bookDetails"
              : dialog.type === "return"
                ? "returned"
                : dialog.type === "loan"
                  ? "lend"
                  : dialog.type === "photo"
                    ? "photo"
                    : "add",
          )}
          close={() => {
            if (!busy) setDialog(null);
          }}
        >
          {error && (
            <div role="alert" className="error">
              {t(error)}
              {error === "conflict" && (
                <button onClick={() => void load()}>{t("reload")}</button>
              )}
            </div>
          )}
          {dialog.type === "add" && (
            <AddMethods
              t={t}
              photo={() => setDialog({ type: "photo" })}
              manual={(editor) => setDialog({ type: "edit", editor })}
              barcode={() => setDialog({ type: "barcode" })}
            />
          )}
          {dialog.type === "edit" && (
            <EditorForm
              key={
                dialog.editor.id ??
                dialog.editor.copyId ??
                dialog.editor.wishId ??
                "new"
              }
              editor={dialog.editor}
              data={data}
              t={t}
              busy={busy}
              lang={lang}
              save={saveEditor}
            />
          )}
          {dialog.type === "loan" && (
            <LoanForm
              data={data}
              initial={dialog.copyId}
              t={t}
              busy={busy}
              save={async (copyId, borrower, date) => {
                const c = current.current.data.copies.find(
                  (c) => c.id === copyId,
                );
                if (!c || c.status !== "available") return;
                const ok = await change((d) => {
                  const copy = d.copies.find((c) => c.id === copyId)!;
                  d.loans.push({
                    id: uid(),
                    copyId,
                    borrower: borrower.trim(),
                    date,
                    previousLocation: copy.location,
                    returned: null,
                  });
                  copy.status = "loaned";
                  copy.location = borrower.trim();
                }, "lend");
                if (ok) setDialog(null);
              }}
            />
          )}
          {dialog.type === "return" && (
            <ReturnForm
              loan={dialog.loan}
              locations={data.locations}
              t={t}
              busy={busy}
              save={async (location) => {
                const ok = await change((d) => {
                  const loan = d.loans.find((l) => l.id === dialog.loan.id)!;
                  loan.returned = today();
                  loan.returnLocation = location;
                  const copy = d.copies.find((c) => c.id === loan.copyId)!;
                  copy.status = "available";
                  copy.location = location;
                }, "return");
                if (ok) setDialog(null);
              }}
            />
          )}
          {dialog.type === "detail" && <BookDetails id={dialog.id} data={data} t={t} busy={busy} change={change} setDialog={setDialog} deleteBook={deleteBook} setError={setError}/>}
          {dialog.type === "photo" && (
            <PhotoFlow
              locations={data.locations}
              saveBatch={async (entries) => {
                const preview = structuredClone(current.current.data);
                let titles = 0;
                for (const e of entries) {
                  const book = newBook(e);
                  const existing = duplicateBook(preview, book);
                  if (existing) {
                    if (!confirm(t("duplicate") + " " + existing.title))
                      return false;
                  } else {
                    preview.books.push(book);
                    titles++;
                  }
                  preview.copies.push({
                    id: uid(),
                    bookId: existing?.id ?? book.id,
                    location: e.location ?? preview.locations[0],
                    status: "available",
                    note: "",
                    added: new Date().toISOString(),
                  });
                }
                preview.activity.unshift({
                  date: new Date().toISOString(),
                  action: "batch-add",
                });
                const ok = await persist(preview);
                if (ok)
                  setCounts((c) => ({
                    titles: c.titles + titles,
                    copies: c.copies + entries.length,
                  }));
                return ok;
              }}
              t={t}
              draft={dialog.draft}
              busy={busy}
              counts={counts}
              add={(editor) => setDialog({ type: "edit", editor })}
              saveDraft={async (draft) =>
                change((d) => {
                  const index = d.drafts.findIndex((x) => x.id === draft.id);
                  if (index < 0) d.drafts.push(draft);
                  else d.drafts[index] = draft;
                }, "photo-draft")
              }
              complete={async (id) => {
                const ok = await change((d) => {
                  d.drafts = d.drafts.filter((x) => x.id !== id);
                }, "complete-draft");
                if (ok) setDialog(null);
              }}
            />
          )}
          {dialog.type === "barcode" && (
            <Barcode
              t={t}
              choose={(editor) => setDialog({ type: "edit", editor })}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

