import React, { useState } from "react";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import { DAYS, penceToPounds, poundsToPence } from "../lib/format.js";
import { ConfirmButton, EmptyState, Notice, PageHeader, Segmented, SkeletonRows, SportTag, Switch, ToggleGroup, useLoad, useNow } from "../lib/ui.jsx";
import { describeRule, RuleHealth } from "./Overview.jsx";

const DEFAULT_RULE = {
  name: "Weekend basketball",
  sport: "basketball",
  enabled: true,
  activity_ids: [],
  days_of_week: [5, 6],
  start_time: "12:00",
  end_time: "22:00",
  lookahead_days: 10,
  run_interval_minutes: 5,
  max_price_pence: null,
  notify_on_success: true,
  notify_on_failure: true,
  notify_on_availability: false,
  aston_account_id: null,
  duration_minutes: 60,
  preferred_start_time: null,
  allow_fallback: false,
};

function toForm(rule) {
  return {
    ...DEFAULT_RULE,
    ...rule,
    max_price: penceToPounds(rule.max_price_pence),
    preferred_start_time: rule.preferred_start_time ?? "",
    aston_account_id: rule.aston_account_id ?? "",
  };
}

function toPayload(form) {
  const payload = {
    name: form.name.trim(),
    sport: form.sport,
    enabled: form.enabled,
    activity_ids: form.activity_ids,
    days_of_week: form.days_of_week,
    start_time: form.start_time,
    end_time: form.end_time,
    lookahead_days: Number(form.lookahead_days),
    run_interval_minutes: Number(form.run_interval_minutes),
    max_price_pence: poundsToPence(form.max_price),
    notify_on_success: form.notify_on_success,
    notify_on_failure: form.notify_on_failure,
    notify_on_availability: form.notify_on_availability,
    duration_minutes: Number(form.duration_minutes),
    preferred_start_time: form.preferred_start_time || null,
    allow_fallback: form.allow_fallback,
  };
  // "My default account" leaves the choice to the server (and an edit keeps the current account).
  if (form.aston_account_id !== "") payload.aston_account_id = Number(form.aston_account_id);
  return payload;
}

function problems(form) {
  const found = [];
  if (!form.name.trim()) found.push("Give the rule a name.");
  if (!form.days_of_week.length) found.push("Choose at least one day.");
  if (form.start_time >= form.end_time) found.push("The window must end after it starts.");
  if (form.preferred_start_time && (form.preferred_start_time < form.start_time || form.preferred_start_time > form.end_time)) {
    found.push("The preferred start must be inside the window.");
  }
  return found;
}

function RuleEditor({ rule, sports, accounts, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(rule ?? DEFAULT_RULE));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentSport = sports.find((item) => item.id === form.sport);
  const issues = problems(form);
  const set = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = rule?.id
        ? await api(`/api/rules/${rule.id}`, { method: "PATCH", body: toPayload(form) })
        : await api("/api/rules", { method: "POST", body: toPayload(form) });
      onSaved(saved, Boolean(rule?.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rule-editor" data-sport={form.sport} onSubmit={submit} noValidate>
      <h2>{rule?.id ? `Edit “${rule.name}”` : "New rule"}</h2>

      <div className="form-grid">
        <label className="field span-2">
          <span>Name</span>
          <input value={form.name} onChange={(event) => set("name")(event.target.value)} maxLength={120} required />
        </label>

        <Segmented
          sportTone
          label="Sport"
          value={form.sport}
          onChange={(value) => setForm((current) => ({ ...current, sport: value, activity_ids: [] }))}
          options={sports.map((item) => ({ value: item.id, label: item.label }))}
        />
        <ToggleGroup
          label="Halls"
          values={form.activity_ids}
          onChange={set("activity_ids")}
          options={(currentSport?.activities ?? []).map((activity) => ({ value: activity.id, label: activity.name }))}
          hint={form.activity_ids.length ? null : "None selected means either hall"}
        />

        <ToggleGroup
          label="Days"
          values={form.days_of_week}
          onChange={(value) => set("days_of_week")([...value].sort())}
          options={DAYS.map((day, index) => ({ value: index, label: day }))}
        />
        <Segmented
          label="Length"
          value={String(form.duration_minutes)}
          onChange={(value) => set("duration_minutes")(Number(value))}
          options={[60, 120, 180, 240].map((minutes) => ({ value: String(minutes), label: `${minutes / 60}h` }))}
        />

        <fieldset className="time-window">
          <legend>Start between</legend>
          <label className="field">
            <span>From</span>
            <input type="time" value={form.start_time} onChange={(event) => set("start_time")(event.target.value)} required />
          </label>
          <label className="field">
            <span>To</span>
            <input type="time" value={form.end_time} onChange={(event) => set("end_time")(event.target.value)} required />
          </label>
        </fieldset>

        <fieldset className="time-window">
          <legend>Preferred start (optional)</legend>
          <label className="field">
            <span className="visually-hidden">Preferred start time</span>
            <input type="time" value={form.preferred_start_time} onChange={(event) => set("preferred_start_time")(event.target.value)} />
          </label>
          {form.preferred_start_time ? (
            <Segmented
              label="If it's taken"
              value={form.allow_fallback ? "nearest" : "nothing"}
              onChange={(value) => set("allow_fallback")(value === "nearest")}
              options={[
                { value: "nothing", label: "Book nothing" },
                { value: "nearest", label: "Take the nearest time" },
              ]}
            />
          ) : (
            <small className="field-hint">Without one, the earliest free time in the window is booked.</small>
          )}
        </fieldset>
      </div>

      <details className="more-settings">
        <summary>Schedule, price, account and alerts</summary>
        <div className="form-grid">
          <label className="field">
            <span>Check every (minutes)</span>
            <input type="number" min="1" max="1440" value={form.run_interval_minutes} onChange={(event) => set("run_interval_minutes")(event.target.value)} />
          </label>
          <label className="field">
            <span>Look ahead (days)</span>
            <input type="number" min="1" max="31" value={form.lookahead_days} onChange={(event) => set("lookahead_days")(event.target.value)} />
          </label>
          <label className="field">
            <span>Max price per hour (£)</span>
            <input inputMode="decimal" placeholder="No limit" value={form.max_price} onChange={(event) => set("max_price")(event.target.value)} />
          </label>
          <label className="field">
            <span>Aston account</span>
            <select value={form.aston_account_id} onChange={(event) => set("aston_account_id")(event.target.value)}>
              <option value="">My default account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
          <div className="switch-stack span-2">
            <Switch checked={form.notify_on_success} onChange={set("notify_on_success")} label="Tell me when it books" />
            <Switch checked={form.notify_on_failure} onChange={set("notify_on_failure")} label="Tell me when a booking fails" />
            <Switch checked={form.notify_on_availability} onChange={set("notify_on_availability")} label="Tell me whenever matching sessions are free" description="Can be noisy: every check that finds a match sends an alert." />
          </div>
        </div>
      </details>

      <Notice tone="danger">{error}</Notice>

      <div className="form-actions">
        <Switch checked={form.enabled} onChange={set("enabled")} label={form.enabled ? "On: runs automatically" : "Off: saved but paused"} />
        <div>
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? "Saving…" : rule?.id ? "Save changes" : "Create rule"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function Rules({ sports, accounts, me }) {
  const now = useNow();
  const rules = useLoad(() => api("/api/rules"));
  const [editing, setEditing] = useState(null); // "new" | rule id
  const [message, setMessage] = useState(null);
  const [running, setRunning] = useState(null);

  async function act(task, success) {
    setMessage(null);
    try {
      const result = await task();
      if (success) setMessage({ tone: "ok", text: success(result) });
      await rules.reload();
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    }
  }

  async function run(rule) {
    setRunning(rule.id);
    await act(
      () => api(`/api/rules/${rule.id}/run`, { method: "POST" }),
      (result) => {
        const booked = result.booking_attempts.filter((attempt) => attempt.status === "success").length;
        return `${rule.name}: checked ${result.checked_slots} slots, ${result.matched_slots} matched${booked ? `, booked ${booked}` : ""}.`;
      },
    );
    setRunning(null);
  }

  function saved(rule, wasEdit) {
    setEditing(null);
    setMessage({ tone: "ok", text: wasEdit ? `Saved “${rule.name}”.` : `Created “${rule.name}”. It will run within a minute.` });
    rules.reload();
  }

  return (
    <>
      <PageHeader title="Rules" description="Each rule checks Sport Aston on a schedule and books one block of time per run when a session fits.">
        {editing !== "new" && (
          <button type="button" className="button primary" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden="true" /> New rule
          </button>
        )}
      </PageHeader>

      <Notice tone={message?.tone} onDismiss={() => setMessage(null)}>
        {message?.text}
      </Notice>
      <Notice tone="danger">{rules.error}</Notice>

      {editing === "new" && <RuleEditor sports={sports} accounts={accounts} onSaved={saved} onCancel={() => setEditing(null)} />}

      {rules.loading && !rules.data ? (
        <SkeletonRows count={3} height="5.5rem" />
      ) : rules.data?.length ? (
        <ul className="rule-list">
          {rules.data.map((rule) =>
            editing === rule.id ? (
              <li key={rule.id} className="rule-list-editing">
                <RuleEditor rule={rule} sports={sports} accounts={accounts} onSaved={saved} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={rule.id} className="rule-row" data-sport={rule.sport} data-enabled={rule.enabled}>
                <Switch
                  checked={rule.enabled}
                  onChange={(enabled) => act(() => api(`/api/rules/${rule.id}`, { method: "PATCH", body: { enabled } }))}
                  label={<span className="visually-hidden">Turn {rule.name} {rule.enabled ? "off" : "on"}</span>}
                />
                <div className="rule-body">
                  <div className="rule-mini-title">
                    <strong>{rule.name}</strong>
                    <SportTag sport={rule.sport} />
                    {me && rule.user_id !== me.id && <span className="owner">by {rule.owner_username ?? `user ${rule.user_id}`}</span>}
                  </div>
                  <span>{describeRule(rule)}</span>
                  <small className="muted">
                    Every {rule.run_interval_minutes} min · {rule.lookahead_days} days ahead
                    {rule.max_price_pence !== null && rule.max_price_pence !== undefined ? ` · up to £${penceToPounds(rule.max_price_pence)}/hr` : ""}
                  </small>
                  <RuleHealth rule={rule} now={now} />
                </div>
                <div className="row-actions">
                  <button type="button" className="button secondary" onClick={() => run(rule)} disabled={running === rule.id}>
                    <Play size={15} aria-hidden="true" /> {running === rule.id ? "Running…" : "Run now"}
                  </button>
                  <button type="button" className="button secondary" onClick={() => setEditing(rule.id)}>
                    <Pencil size={15} aria-hidden="true" /> Edit
                  </button>
                  <ConfirmButton
                    className="button danger-quiet"
                    confirmLabel="Delete?"
                    onConfirm={() => act(() => api(`/api/rules/${rule.id}`, { method: "DELETE" }), () => `Deleted “${rule.name}”. Its history is kept.`)}
                    aria-label={`Delete ${rule.name}`}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Delete
                  </ConfirmButton>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        editing !== "new" && (
          <EmptyState title="No rules yet" actions={<button type="button" className="button primary" onClick={() => setEditing("new")}>Create your first rule</button>}>
            Tell Hall Pass which days and times you want, and it books them the moment they appear.
          </EmptyState>
        )
      )}

      <p className="footnote">
        Sharing an Aston account? When two rules want the same session, an exact preferred start beats “nearest time”, which beats no preference. Ties go to whoever booked least recently.
      </p>
    </>
  );
}
