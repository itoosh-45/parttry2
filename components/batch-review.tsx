"use client";
import { useState } from "react";
import { Editor, Field, T } from "./library-forms";
export function BatchReview({
  text,
  t,
  busy,
  locations,
  save,
}: {
  text: string;
  t: T;
  busy: boolean;
  locations: string[];
  save: (entries: Editor[]) => Promise<boolean>;
}) {
  const [entries, setEntries] = useState(() =>
    text
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
      .map((title) => ({ selected: false, title, author: "" })),
  );
  const [location, setLocation] = useState(locations[0]);
  function update(index: number, patch: Partial<(typeof entries)[number]>) {
    setEntries((old) =>
      old.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }
  return (
    <form
      className="batch-review"
      onSubmit={async (e) => {
        e.preventDefault();
        const chosen = entries.filter((e) => e.selected);
        if (
          chosen.length &&
          (await save(
            chosen.map(({ title, author }) => ({ title, author, location })),
          ))
        )
          setEntries((old) => old.filter((e) => !e.selected));
      }}
    >
      <h3>{t("reviewNeeded")}</h3>
      <p>{t("ocrHint")}</p>
      <label>
        {t("location")}
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      {entries.map((e, i) => (
        <div className="batch-entry" key={i}>
          <label className="batch-check">
            <input
              type="checkbox"
              checked={e.selected}
              onChange={(event) =>
                update(i, { selected: event.target.checked })
              }
            />
            {t("add")}
          </label>
          <Field
            label={t("title")}
            required={e.selected}
            value={e.title}
            onChange={(event) => update(i, { title: event.target.value })}
          />
          <Field
            label={t("author")}
            value={e.author}
            onChange={(event) => update(i, { author: event.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setEntries((old) => [
            ...old,
            { selected: false, title: "", author: "" },
          ])
        }
      >
        {t("add")}
      </button>
      <button
        className="primary"
        disabled={busy || !entries.some((e) => e.selected && e.title.trim())}
      >
        {busy ? t("saving") : t("save")} ·{" "}
        {entries.filter((e) => e.selected).length} {t("titles")}
      </button>
    </form>
  );
}
