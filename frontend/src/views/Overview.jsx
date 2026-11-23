import React, { useState } from "react";
import { CalendarPlus, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "../lib/api.js";
import { addMinutes, describeDays, formatDay, formatRelative, formatTime, hours } from "../lib/format.js";
import { Chip, EmptyState, Notice, PageHeader, SkeletonRows, SportTag, Switch, useLoad, useNow } from "../lib/ui.jsx";

export function HoldRow({ hold, me }) {
  const start = new Date(hold.start_time_local);
  const end = addMinutes(start, hold.duration_minutes);
  const someoneElse = me && hold.user_id !== me.id;
  return (
    <li className="court-box" data-sport={hold.sport ?? "basketball"}>
      <div className="court-time">
        <span className="time-big">{formatTime(start)}</span>
        <span className="time-end">to {formatTime(end)}</span>
      </div>
      <div className="court-detail">
        <strong>{formatDay(start)}</strong>
        <span>
          {hold.activity_name ?? "Sports hall"}
          {hold.bookable_item_name && hold.bookable_item_name !== hold.activity_name ? ` · ${hold.bookable_item_name}` : ""}
        </span>
        <span className="court-meta">
          <SportTag sport={hold.sport} />
          <span>{hours(hold.duration_minutes)}</span>
          {hold.price && <span>{hold.price}/hr</span>}
          {hold.rule_name ? <span>Rule: {hold.rule_name}</span> : <span>Booked by hand</span>}
        </span>
      </div>
      <div className="court-state">
        {hold.status === "held" ? <Chip tone="pay">Pay in Sport Aston</Chip> : <Chip tone="ok">{hold.status}</Chip>}
        {someoneElse && <span className="owner">for {hold.username ?? `user ${hold.user_id}`}</span>}
      </div>
    </li>
  );
}

export function describeRule(rule) {
  const parts = [describeDays(rule.days_of_week), `${rule.start_time}–${rule.end_time}`, hours(rule.duration_minutes)];
  if (rule.preferred_start_time) parts.push(`prefers ${rule.preferred_start_time}${rule.allow_fallback ? " or nearest" : " only"}`);
  return parts.join(" · ");
}

export function RuleHealth({ rule, now }) {
  if (!rule.enabled) return <small className="muted">Paused</small>;
  if (!rule.last_check_at) return <small className="muted">Waiting for its first check</small>;
  if (rule.last_check_status === "failure") {
    return (
      <span className="rule-health">
        <Chip tone="danger">Check failed {formatRelative(rule.last_check_at, now)}</Chip>
        {rule.last_check_error && <small className="error-text">{rule.last_check_error}</small>}
      </span>
    );
  }
  return (
    <span className="rule-health">
      <Chip tone="ok">Checked {formatRelative(rule.last_check_at, now)}</Chip>
      <small className="muted">
        {rule.last_check_slots} slots seen · {rule.last_check_matched ? `${rule.last_check_matched} matched` : "none matched"}
      </small>
    </span>
  );
}

export default function Overview({ me, onNavigate }) {
  const now = useNow();
  const holds = useLoad(() => api("/api/holds"));
  const rules = useLoad(() => api("/api/rules"));
  const history = useLoad(() => api("/api/history?limit=6"));
  const [message, setMessage] = useState(null);

  const upcoming = (holds.data ?? [])
    .filter((hold) => addMinutes(hold.start_time_local, hold.duration_minutes).getTime() > now)
    .sort((a, b) => new Date(a.start_time_local) - new Date(b.start_time_local));
  const toPay = upcoming.filter((hold) => hold.status === "held").length;

  async function toggleRule(rule, enabled) {
    setMessage(null);
    try {
      await api(`/api/rules/${rule.id}`, { method: "PATCH", body: { enabled } });
      await rules.reload();
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    }
  }

  function refresh() {
    holds.reload();
    rules.reload();
    history.reload();
  }

  return (
    <>
      <PageHeader
        title="Court time"
        description={
          holds.loading && !holds.data
            ? "Loading your sessions…"
            : upcoming.length
              ? `${upcoming.length} upcoming session${upcoming.length === 1 ? "" : "s"}${toPay ? `, ${toPay} to pay for in Sport Aston` : ""}.`
              : "Nothing held yet."
        }
      >
        <button type="button" className="button secondary" onClick={refresh}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
        <button type="button" className="button primary" onClick={() => onNavigate("book")}>
          <CalendarPlus size={16} aria-hidden="true" /> Book a session
        </button>
      </PageHeader>

      <Notice tone={message?.tone}>{message?.text}</Notice>

      <div className="overview-grid">
        <section aria-labelledby="held-heading" className="region">
          <h2 id="held-heading">Held sessions</h2>
          <Notice tone="danger">{holds.error}</Notice>
          {holds.loading && !holds.data ? (
            <SkeletonRows count={3} />
          ) : upcoming.length ? (
            <ul className="court-list">
              {upcoming.map((hold) => (
                <HoldRow key={hold.id} hold={hold} me={me} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No court time held"
              actions={
                <>
                  <button type="button" className="button primary" onClick={() => onNavigate("book")}>
                    Book a session
                  </button>
                  <button type="button" className="button secondary" onClick={() => onNavigate("rules")}>
                    Set up a rule
                  </button>
                </>
              }
            >
              Rules book sessions for you as soon as they appear. You can also pick one from live availability.
            </EmptyState>
          )}
          {upcoming.length > 0 && (
            <p className="footnote">Hall Pass holds the session. Pay for it in the Sport Aston app before the deadline or it may be released.</p>
          )}
        </section>

        <aside className="side-stack">
          <section aria-labelledby="rules-heading" className="region">
            <div className="region-head">
              <h2 id="rules-heading">Rules</h2>
              <button type="button" className="text-button" onClick={() => onNavigate("rules")}>
                Manage <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
            <Notice tone="danger">{rules.error}</Notice>
            {rules.loading && !rules.data ? (
              <SkeletonRows count={2} height="3.5rem" />
            ) : rules.data?.length ? (
              <ul className="rule-mini-list">
                {rules.data.map((rule) => (
                  <li key={rule.id}>
                    <Switch checked={rule.enabled} onChange={(enabled) => toggleRule(rule, enabled)} label={<span className="visually-hidden">Turn {rule.name} {rule.enabled ? "off" : "on"}</span>} />
                    <div>
                      <div className="rule-mini-title">
                        <strong>{rule.name}</strong>
                        <SportTag sport={rule.sport} />
                      </div>
                      <small className="muted">{describeRule(rule)}</small>
                      <RuleHealth rule={rule} now={now} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No rules yet" actions={<button type="button" className="button secondary" onClick={() => onNavigate("rules")}>Create a rule</button>}>
                A rule watches for sessions that fit your days and times, and books them.
              </EmptyState>
            )}
          </section>

          <section aria-labelledby="recent-heading" className="region">
            <div className="region-head">
              <h2 id="recent-heading">Latest booking attempts</h2>
              <button type="button" className="text-button" onClick={() => onNavigate("history")}>
                History <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
            {history.loading && !history.data ? (
              <SkeletonRows count={3} height="2.25rem" />
            ) : history.data?.booking_attempts?.length ? (
              <ul className="attempt-list">
                {history.data.booking_attempts.slice(0, 5).map((attempt) => (
                  <li key={attempt.id}>
                    <Chip tone={attempt.status === "success" ? "ok" : attempt.status === "skipped" ? "neutral" : "danger"} icon={attempt.status !== "skipped"}>
                      {attempt.status === "success" ? "Booked" : attempt.status === "skipped" ? "Skipped" : "Failed"}
                    </Chip>
                    <span className="tabular">{formatDay(attempt.start_time_local)} {formatTime(attempt.start_time_local)}</span>
                    <span className="muted">{attempt.activity_name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No booking attempts yet.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
