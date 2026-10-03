"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Camera, X, ScanBarcode } from "lucide-react";
import { Book, Library, Draft, Loan, normalize } from "../lib/model";
import { MessageKey } from "../lib/i18n";
import { compress, recognize, upload } from "../lib/photos";
import { BatchReview } from "./batch-review";
export type T = (key: MessageKey) => string;
export type Editor = Partial<Book> & {
  location?: string;
  note?: string;
  wishId?: string;
  copyId?: string;
};
export type Dialog =
  | { type: "add" }
  | { type: "edit"; editor: Editor }
  | { type: "loan"; copyId?: string }
  | { type: "return"; loan: Loan }
  | { type: "detail"; id: string }
  | { type: "photo"; draft?: Draft }
  | { type: "barcode" };
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
export function Cover({ book, label }: { book: Book; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="cover">
      {book.cover && !failed ? (
        <img
          src={book.cover}
          alt={book.title}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="missing-cover">
          <BookOpen size={30} />
          <span>{label}</span>
        </span>
      )}
    </span>
  );
}
export function Empty({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      <div className="inline-actions">{children}</div>
    </div>
  );
}
export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  );
}
export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: (string | { value: string; label: string })[];
  all: string;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
export function Modal({
  label,
  children,
  close,
}: {
  label: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled):not([hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2>{label}</h2>
          <button aria-label={label + " ×"} onClick={close}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function AddMethods({
  t,
  photo,
  manual,
  barcode,
}: {
  t: T;
  photo: () => void;
  manual: (b: Editor) => void;
  barcode: () => void;
}) {
  return (
    <>
      <div className="method-grid">
        <button onClick={photo}>
          <Camera size={30} />
          <strong>{t("camera")}</strong>
          <span>{t("photoHint")}</span>
        </button>
        <button onClick={() => manual({})}>
          <Plus size={30} />
          <strong>{t("manual")}</strong>
        </button>
        <button onClick={barcode}>
          <ScanBarcode size={30} />
          <strong>{t("scan")}</strong>
          <span>{t("scanHint")}</span>
        </button>
      </div>
      <Catalog t={t} choose={manual} />
    </>
  );
}
export function Catalog({
  t,
  choose,
  initial = "",
}: {
  t: T;
  choose: (b: Editor) => void;
  initial?: string;
}) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<Editor[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <section className="catalog">
      <h3>{t("catalog")}</h3>
      <form
        className="catalog-search"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          try {
            const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!r.ok) throw new Error();
            setResults(((await r.json()) as { books: Editor[] }).books);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label={t("catalog")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("catalog")}
          required
        />
        <button disabled={busy}>{busy ? t("loading") : t("catalog")}</button>
      </form>
      {error && <p role="alert">{t("searchError")}</p>}
      {results?.length === 0 && <p>{t("noResults")}</p>}
      <div className="catalog-results">
        {results?.map((b, i) => (
          <button key={i} onClick={() => choose(b)}>
            <span>
              <strong>{b.title}</strong>
              <small>
                {b.author} · {b.isbn}
              </small>
            </span>
            <Plus size={20} />
          </button>
        ))}
      </div>
    </section>
  );
}
export function EditorForm({
  editor,
  data,
  t,
  busy,
  lang,
  save,
}: {
  editor: Editor;
  data: Library;
  t: T;
  busy: boolean;
  lang: string;
  save: (
    e: Editor,
    duplicate?: string,
  ) => Promise<{ ok?: boolean; duplicate?: Book }>;
}) {
  const [value, setValue] = useState<Editor>({
    ...editor,
    language: editor.language ?? lang,
    location: editor.location ?? data.locations[0],
  });
  const [duplicate, setDuplicate] = useState<Book | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const set = (key: keyof Editor, v: string) =>
    setValue((old) => ({ ...old, [key]: v }));
  return (
    <form
      className="editor-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await save(value, forceNew ? "force-new" : undefined);
        if (result.duplicate) setDuplicate(result.duplicate);
      }}
    >
      {error && <p role="alert">{t(error)}</p>}
      {!value.copyId && (
        <>
          <div className="form-grid">
            <Field
              label={t("title")}
              required
              autoFocus
              value={value.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              maxLength={500}
            />
            <Field
              label={t("author")}
              value={value.author ?? ""}
              onChange={(e) => set("author", e.target.value)}
              maxLength={500}
            />
            <Field
              label={t("genre")}
              value={value.genre ?? ""}
              onChange={(e) => set("genre", e.target.value)}
            />
            <Field
              label={t("language")}
              value={value.language ?? "he"}
              onChange={(e) => set("language", e.target.value)}
              list="book-languages"
              required
            />
            <datalist id="book-languages">
              <option value="he" />
              <option value="en" />
            </datalist>
            <Field
              label={t("isbn")}
              value={value.isbn ?? ""}
              onChange={(e) => set("isbn", e.target.value)}
              dir="ltr"
            />
            <Field
              label={t("aliases")}
              value={value.aliases ?? ""}
              onChange={(e) => set("aliases", e.target.value)}
            />
          </div>
          <Field
            label={t("coverUrl")}
            value={value.cover ?? ""}
            onChange={(e) => set("cover", e.target.value)}
            pattern="https://.*|/api/images/.*"
          />
          <label>
            {t("cover")}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  set("cover", await upload(await compress(file)));
                } catch {
                  setError("imageError");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </>
      )}
      {!value.id && (
        <>
          <label>
            {t("location")}
            <select
              value={value.location}
              onChange={(e) => set("location", e.target.value)}
            >
              {[...new Set([...data.locations, value.location!])].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            {t("note")}
            <textarea
              value={value.note ?? ""}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
          <p className="muted">
            {t("owner")}: {data.owner || t("brand")}
          </p>
        </>
      )}
      {duplicate && (
        <div className="duplicate-notice">
          <h3>{duplicate.title}</h3>
          <p>{t("duplicate")}</p>
          <div className="inline-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(value, duplicate.id)}
            >
              {t("addCopy")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDuplicate(null);
                setForceNew(true);
              }}
            >
              {t("newTitle")}
            </button>
          </div>
        </div>
      )}
      <button className="primary" disabled={busy || uploading}>
        {busy || uploading ? t("saving") : t("save")}
      </button>
    </form>
  );
}
export function LoanForm({
  data,
  initial,
  t,
  busy,
  save,
}: {
  data: Library;
  initial?: string;
  t: T;
  busy: boolean;
  save: (id: string, name: string, date: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(initial ?? "");
  const [query, setQuery] = useState("");
  const [borrower, setBorrower] = useState("");
  const [date, setDate] = useState(today());
  const [confirming, setConfirming] = useState(false);
  const available = data.copies.filter((c) => c.status === "available");
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) setConfirming(true);
        else void save(selected, borrower, date);
      }}
    >
      <p>{t("loanHint")}</p>
      {!confirming ? (
        <>
          <Field
            label={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label>
            {t("choose")}
            <select
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("choose")}</option>
              {available
                .filter((c) => {
                  const b = data.books.find((b) => b.id === c.bookId)!;
                  return (
                    !query ||
                    normalize([b.title, b.author, b.isbn].join(" ")).includes(
                      normalize(query),
                    )
                  );
                })
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {data.books.find((b) => b.id === c.bookId)?.title} ·{" "}
                    {data.owner || t("brand")} · {c.location} ·{" "}
                    {c.id.slice(0, 4)}
                  </option>
                ))}
            </select>
          </label>
          {!available.length && <p>{t("noAvailable")}</p>}
          <Field
            label={t("borrower")}
            required
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
            maxLength={200}
          />
          <Field
            label={t("loanDate")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today()}
            required
          />
        </>
      ) : (
        <div className="confirm-panel">
          <h3>
            {
              data.books.find(
                (b) =>
                  b.id === data.copies.find((c) => c.id === selected)?.bookId,
              )?.title
            }
          </h3>
          <p>
            {borrower} · {date}
          </p>
          <button type="button" onClick={() => setConfirming(false)}>
            {t("edit")}
          </button>
        </div>
      )}
      <button className="primary" disabled={busy || !available.length}>
        {busy ? t("saving") : t("confirmLoan")}
      </button>
    </form>
  );
}
export function ReturnForm({
  loan,
  locations,
  t,
  busy,
  save,
}: {
  loan: Loan;
  locations: string[];
  t: T;
  busy: boolean;
  save: (s: string) => Promise<void>;
}) {
  const [location, setLocation] = useState(loan.previousLocation);
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(location);
      }}
    >
      <p>
        {loan.borrower} · {loan.date}
      </p>
      <label>
        {t("returnLocation")}
        <select
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          {[...new Set([loan.previousLocation, ...locations])].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <button className="primary" disabled={busy}>
        {busy ? t("saving") : t("confirmReturn")}
      </button>
    </form>
  );
}
export function PhotoFlow({
  t,
  draft,
  busy,
  counts,
  add,
  saveDraft,
  complete,
  locations,
  saveBatch,
}: {
  locations: string[];
  saveBatch: (entries: Editor[]) => Promise<boolean>;
  t: T;
  draft?: Draft;
  busy: boolean;
  counts: { titles: number; copies: number };
  add: (e: Editor) => void;
  saveDraft: (d: Draft) => Promise<boolean>;
  complete: (id: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState(draft);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [text, setText] = useState(draft?.text ?? "");
  const [image, setImage] = useState(draft?.image ?? "");
  const blobRef = useRef<Blob | null>(null);
  async function process(file: File) {
    setWorking(true);
    setError(null);
    try {
      const blob = await compress(file);
      blobRef.current = blob;
      const local = URL.createObjectURL(blob);
      setImage(local);
      const url = await upload(blob);
      URL.revokeObjectURL(local);
      setImage(url);
      const d = {
        id: crypto.randomUUID(),
        image: url,
        text: "",
        created: new Date().toISOString(),
      };
      if (!(await saveDraft(d))) throw new Error("storageError");
      setCurrent(d);
      const cleanup = indexedDB.open("library-photo-drafts", 1);
      cleanup.onsuccess = () => {
        const db = cleanup.result;
        const tx = db.transaction("photos", "readwrite");
        tx.objectStore("photos").delete("pending");
        tx.oncomplete = () => db.close();
      };
      try {
        const result = await recognize(blob);
        setText(result);
        const next = { ...d, text: result };
        if (await saveDraft(next)) setCurrent(next);
        if (!result.trim()) setError("ocrFailed");
      } catch {
        setError("ocrFailed");
      }
    } catch {
      setError("imageError");
      if (blobRef.current) {
        try {
          const request = indexedDB.open("library-photo-drafts", 1);
          request.onupgradeneeded = () =>
            request.result.createObjectStore("photos");
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("photos", "readwrite");
            tx.objectStore("photos").put(blobRef.current, "pending");
            tx.oncomplete = () => db.close();
          };
        } catch {
          /* Preview stays available to retry. */
        }
      }
    } finally {
      setWorking(false);
    }
  }
  useEffect(() => {
    const request = indexedDB.open("library-photo-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction("photos").objectStore("photos").get("pending");
      get.onsuccess = () => {
        if (get.result && !draft) {
          blobRef.current = get.result;
          setImage(URL.createObjectURL(get.result));
          setError("imageError");
        }
        db.close();
      };
    };
  }, [draft]);
  return (
    <div className="photo-flow">
      <p>{t("photoHint")}</p>
      <label className="photo-upload">
        <Camera size={32} />
        {t("photo")}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={working || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void process(file);
          }}
        />
      </label>
      <label>
        {t("cover")}
        <input
          type="file"
          accept="image/*"
          disabled={working || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void process(file);
          }}
        />
      </label>
      {image && <img className="photo-preview" src={image} alt={t("draft")} />}
      <p role="status">
        {working ? t("recognizing") : current ? t("photoSaved") : ""}
      </p>
      {error && <p role="alert">{t(error)}</p>}
      {current && (
        <>
          <h3>{t("reviewNeeded")}</h3>
          <p>{t("ocrHint")}</p>
          <textarea
            aria-label={t("reviewNeeded")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
          <div className="inline-actions">
            <button
              disabled={busy || working}
              onClick={() => void saveDraft({ ...current, text })}
            >
              {t("save")}
            </button>
            <button disabled={busy || working} onClick={() => add({})}>
              {t("manual")}
            </button>
            <button
              disabled={busy || working}
              onClick={() => void complete(current.id)}
            >
              {t("completeDraft")}
            </button>
          </div>
          {text
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 2)
            .map((line, i) => (
              <button
                className="ocr-line"
                key={i}
                onClick={() => add({ title: line })}
              >
                {line}
                <Plus size={18} />
              </button>
            ))}
          <BatchReview
            key={text}
            text={text}
            t={t}
            busy={busy || working}
            locations={locations}
            save={saveBatch}
          />
          <Catalog t={t} choose={add} />
          <p>
            {t("batchSummary")}: {counts.titles} {t("titles")} · {counts.copies}{" "}
            {t("copies")}
          </p>
        </>
      )}
      {error === "imageError" && (
        <button
          disabled={working}
          onClick={async () => {
            if (blobRef.current)
              await process(
                new File([blobRef.current], "photo.jpg", {
                  type: "image/jpeg",
                }),
              );
          }}
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
type BarcodeDetectorType = new (options: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
export function Barcode({ t, choose }: { t: T; choose: (b: Editor) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const [isbn, setIsbn] = useState("");
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let ended = false;
    async function run() {
      try {
        const Detector = (
          window as unknown as { BarcodeDetector?: BarcodeDetectorType }
        ).BarcodeDetector;
        if (!Detector) throw new Error();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (ended) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current!.srcObject = stream;
        await video.current!.play();
        const detector = new Detector({ formats: ["ean_13", "ean_8"] });
        async function scan() {
          if (ended) return;
          try {
            const results = await detector.detect(video.current!);
            if (results[0]) {
              ended = true;
              stream?.getTracks().forEach((t) => t.stop());
              setIsbn(results[0].rawValue);
              return;
            }
          } catch {
            setError(true);
          }
          timer = setTimeout(() => void scan(), 350);
        }
        void scan();
      } catch {
        setError(true);
      }
    }
    void run();
    return () => {
      ended = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <div className="editor-form">
      {error ? (
        <p role="status">{t("scanUnavailable")}</p>
      ) : (
        <video ref={video} muted playsInline className="barcode-video" />
      )}
      <Field
        label={t("isbn")}
        value={isbn}
        onChange={(e) => setIsbn(e.target.value)}
        dir="ltr"
      />
      <button
        className="primary"
        disabled={!isbn}
        onClick={() => choose({ isbn })}
      >
        {t("manual")}
      </button>
      <Catalog key={isbn} t={t} initial={isbn} choose={choose} />
    </div>
  );
}
