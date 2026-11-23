import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api.js";
import { formatDateTime, formatRelative } from "../lib/format.js";
import { Chip, EmptyState, Notice, PageHeader, Segmented, SkeletonRows, SportTag, useLoad, useNow } from "../lib/ui.jsx";

const STATUS = {
  success: { tone: "ok", label: "Booked" },
  failure: { tone: "danger", label: "Failed" },
  skipped: { tone: "neutral", label: "Skipped" },
};

export default function History({ me }) {
  const now = useNow();
  const [view, setView] = useState("bookings");
  const history = useLoad(() => api("/api/history?limit=200"));
  const showWho = me?.role === "admin";
  const attempts = history.data?.booking_attempts ?? [];
  const checks = history.data?.availability_checks ?? [];
  const failedChecks = checks.filter((check) => check.status === "failure").length;

  return (
    <>
      <PageHeader title="History" description="Every booking attempt and availability check, newest first.">
        <button type="button" className="button secondary" onClick={() => history.reload()} disabled={history.loading}>
          <RefreshCw size={16} aria-hidden="true" className={history.loading ? "spin" : ""} /> Refresh
        </button>
      </PageHeader>

      <Segmented
        label="Show"
        value={view}
        onChange={setView}
        options={[
          { value: "bookings", label: `Bookings (${attempts.length})` },
          { value: "checks", label: `Checks (${checks.length}${failedChecks ? `, ${failedChecks} failed` : ""})` },
        ]}
      />

      <Notice tone="danger">{history.error}</Notice>

      {history.loading && !history.data ? (
        <SkeletonRows count={6} height="2.75rem" />
      ) : view === "bookings" ? (
        attempts.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Result</th>
                  <th scope="col">Session</th>
                  <th scope="col">Hall</th>
                  <th scope="col">How</th>
                  {showWho && <th scope="col">Who</th>}
                  <th scope="col">Tried</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => {
                  const status = STATUS[attempt.status] ?? { tone: "neutral", label: attempt.status };
                  return (
                    <tr key={attempt.id}>
                      <td>
                        <Chip tone={status.tone} icon={status.tone !== "neutral"}>
                          {status.label}
                        </Chip>
                        {attempt.error && <small className="error-text block">{attempt.error}</small>}
                      </td>
                      <td className="tabular">{formatDateTime(attempt.start_time_local)}</td>
                      <td>
                        {attempt.bookable_item_name}
                        <SportTag sport={attempt.sport} />
                      </td>
                      <td>{attempt.source === "rule" ? "Rule" : "By hand"}</td>
                      {showWho && <td>{attempt.username ?? "—"}</td>}
                      <td className="muted" title={formatDateTime(attempt.created_at)}>
                        {formatRelative(attempt.created_at, now)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No booking attempts yet">Bookings made by hand or by a rule show up here, including ones Sport Aston refused.</EmptyState>
        )
      ) : checks.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col">Sport</th>
                <th scope="col" className="numeric">Slots seen</th>
                <th scope="col" className="numeric">Matched</th>
                <th scope="col">Checked</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.id}>
                  <td>
                    <Chip tone={check.status === "success" ? "ok" : "danger"}>{check.status === "success" ? "OK" : "Failed"}</Chip>
                    {check.error && <small className="error-text block">{check.error}</small>}
                  </td>
                  <td>
                    <SportTag sport={check.sport} />
                    {check.rule_id ? <span className="muted"> · rule #{check.rule_id}</span> : <span className="muted"> · by hand</span>}
                  </td>
                  <td className="numeric tabular">{check.slot_count}</td>
                  <td className="numeric tabular">{check.matched_count}</td>
                  <td className="muted" title={formatDateTime(check.created_at)}>
                    {formatRelative(check.created_at, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No checks yet">Each time a rule runs or you open Book, the check is logged here, so you can tell an outage from an empty week.</EmptyState>
      )}
    </>
  );
}
