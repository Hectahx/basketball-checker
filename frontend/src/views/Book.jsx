import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api.js";
import { dayKey, formatDay, formatLongDay, formatRelative, formatTime, slotIdentity } from "../lib/format.js";
import { EmptyState, Notice, PageHeader, Segmented, SkeletonRows, SportTag, ToggleGroup, useLoad, useMedia, useNow } from "../lib/ui.jsx";

function shortHall(name) {
  return name.replace(/^Sports Hall\s*/i, "H");
}

/** Groups the availability into day × start-time cells. */
function buildGrid(slots, holds, me, activityFilter) {
  const held = new Map();
  for (const hold of holds) {
    for (const identity of hold.slot_identities ?? []) held.set(identity, hold);
  }
  const cells = new Map();
  const days = new Set();
  const times = new Set();
  for (const slot of slots) {
    if (activityFilter.length && !activityFilter.includes(slot.activity_id)) continue;
    const hold = held.get(slotIdentity(slot));
    if (!slot.available && !hold) continue;
    const day = dayKey(slot.start_time_local);
    const time = formatTime(slot.start_time_local);
    days.add(day);
    times.add(time);
    const key = `${day}|${time}`;
    if (!cells.has(key)) cells.set(key, { day, time, free: [], mine: [], theirs: [], holdId: null });
    const cell = cells.get(key);
    if (!hold) cell.free.push(slot);
    else if (!me || hold.user_id === me.id) cell.mine.push(slot);
    else cell.theirs.push({ slot, hold });
    if (hold && !cell.holdId) cell.holdId = hold.id;
  }
  return { cells, days: [...days].sort(), times: [...times].sort() };
}

const minutesOf = (time) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

/** One day's cells, with the consecutive hours of a single hold joined into one court box. */
function rowSegments(grid, day) {
  const segments = [];
  for (let index = 0; index < grid.times.length; index += 1) {
    const time = grid.times[index];
    const cell = grid.cells.get(`${day}|${time}`);
    const state = cellState(cell);
    let span = 1;
    if (cell?.holdId && state !== "free") {
      while (index + span < grid.times.length) {
        const nextTime = grid.times[index + span];
        const next = grid.cells.get(`${day}|${nextTime}`);
        const contiguous = minutesOf(nextTime) - minutesOf(grid.times[index + span - 1]) === 60;
        if (!next || next.holdId !== cell.holdId || cellState(next) !== state || !contiguous) break;
        span += 1;
      }
    }
    segments.push({ time, cell, state, span, until: minutesOf(grid.times[index + span - 1]) + 60 });
    index += span - 1;
  }
  return segments;
}

function untilLabel(minutes) {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function cellLabel(cell, sport, span = 1) {
  const length = span > 1 ? ` · ${span}h` : "";
  if (cell.mine.length) return `Yours${length}`;
  if (cell.theirs.length && !cell.free.length) return `${cell.theirs[0].hold.username ?? "Held"}${length}`;
  if (sport === "badminton") return `${cell.free.length} court${cell.free.length === 1 ? "" : "s"}`;
  return [...new Set(cell.free.map((slot) => shortHall(slot.activity_name)))].join(" ");
}

function cellState(cell) {
  if (!cell) return "none";
  if (cell.mine.length) return "mine";
  if (cell.free.length) return "free";
  return "theirs";
}

export default function Book({ sports, accounts, me }) {
  const now = useNow();
  const compact = useMedia("(max-width: 760px)");
  const [sport, setSport] = useState(sports[0]?.id ?? "basketball");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [halls, setHalls] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookingId, setBookingId] = useState("");
  const [message, setMessage] = useState(null);

  const availability = useLoad(
    () => api(`/api/availability?sport=${sport}${accountId ? `&aston_account_id=${accountId}` : ""}`),
    [sport, accountId],
  );
  const holds = useLoad(() => api("/api/holds"));
  const currentSport = sports.find((item) => item.id === sport);
  const grid = useMemo(
    () => buildGrid(availability.data?.slots ?? [], holds.data ?? [], me, halls),
    [availability.data, holds.data, me, halls],
  );
  const freeCount = [...grid.cells.values()].reduce((total, cell) => total + cell.free.length, 0);
  const selectedCell = selected ? grid.cells.get(`${selected.day}|${selected.time}`) : null;

  function changeSport(value) {
    setSport(value);
    setHalls([]);
    setSelected(null);
    setMessage(null);
  }

  async function book(slot) {
    const id = slotIdentity(slot);
    setBookingId(id);
    setMessage(null);
    try {
      const attempt = await api("/api/bookings", {
        method: "POST",
        body: {
          sport: slot.sport,
          activity_id: slot.activity_id,
          bookable_item_id: slot.bookable_item_id,
          bookable_item_name: slot.bookable_item_name,
          start_time_utc: slot.start_time_utc,
          price: slot.price,
          source: "manual",
          aston_account_id: accountId || null,
        },
      });
      if (attempt.status === "success") {
        setMessage({ tone: "ok", text: `Held ${slot.bookable_item_name} on ${formatLongDay(slot.start_time_local)} at ${formatTime(slot.start_time_local)}. Pay for it in Sport Aston.` });
      } else {
        setMessage({ tone: "danger", text: `Sport Aston didn't accept the booking: ${attempt.error ?? attempt.response_type ?? "no reason given"}.` });
      }
      await Promise.all([availability.reload(), holds.reload()]);
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBookingId("");
    }
  }

  const loading = availability.loading && !availability.data;

  return (
    <>
      <PageHeader
        title="Book a session"
        description={
          availability.data
            ? `Live from Sport Aston · checked ${formatRelative(availability.data.checked_at, now)} · ${freeCount} free slot${freeCount === 1 ? "" : "s"} in the next 10 days`
            : "Live availability from Sport Aston for the next 10 days."
        }
      >
        <button type="button" className="button secondary" onClick={() => availability.reload()} disabled={availability.loading}>
          <RefreshCw size={16} aria-hidden="true" className={availability.loading ? "spin" : ""} /> {availability.loading ? "Checking…" : "Refresh"}
        </button>
      </PageHeader>

      <div className="filter-bar" data-sport={sport}>
        <Segmented sportTone label="Sport" value={sport} onChange={changeSport} options={sports.map((item) => ({ value: item.id, label: item.label }))} />
        <ToggleGroup
          label="Halls"
          values={halls}
          onChange={(value) => {
            setHalls(value);
            setSelected(null);
          }}
          options={(currentSport?.activities ?? []).map((activity) => ({ value: activity.id, label: activity.name }))}
          hint={halls.length ? null : "Showing both halls"}
        />
        {accounts.length > 1 && (
          <label className="field">
            <span>Aston account</span>
            <select value={accountId} onChange={(event) => setAccountId(Number(event.target.value))}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Notice tone={message?.tone} onDismiss={() => setMessage(null)}>
        {message?.text}
      </Notice>

      {availability.error && (
        <Notice tone="danger">
          {availability.error}{" "}
          <button type="button" className="text-button" onClick={() => availability.reload()}>
            Try again
          </button>
        </Notice>
      )}

      {loading ? (
        <SkeletonRows count={5} height="3rem" />
      ) : !availability.error && grid.days.length === 0 ? (
        <EmptyState title={`No free ${currentSport?.label.toLowerCase() ?? ""} sessions`}>
          Nothing is bookable in the next 10 days{halls.length ? " in the selected halls" : ""}. Sessions often appear at midnight; a rule can grab them for you.
        </EmptyState>
      ) : compact ? (
        <div className="day-list" data-sport={sport}>
          {grid.days.map((day) => (
            <section key={day} className="day-block" aria-label={formatLongDay(`${day}T12:00:00Z`)}>
              <h2>{formatDay(`${day}T12:00:00Z`)}</h2>
              <div className="time-chips">
                {rowSegments(grid, day)
                  .filter((segment) => segment.cell)
                  .map(({ time, cell, state, span, until }) => {
                    const isSelected = selected?.day === day && selected?.time === time;
                    return (
                      <button
                        type="button"
                        key={time}
                        className="court-cell"
                        data-state={state}
                        aria-pressed={isSelected}
                        style={span > 1 ? { gridColumn: `span ${Math.min(span, 2)}` } : undefined}
                        onClick={() => setSelected(isSelected ? null : { day, time })}
                      >
                        <span className="cell-time">{span > 1 ? `${time}–${untilLabel(until)}` : time}</span>
                        <span className="cell-label">{cellLabel(cell, sport, span)}</span>
                      </button>
                    );
                  })}
              </div>
              {selected?.day === day && selectedCell && <SlotDetail cell={selectedCell} sport={sport} bookingId={bookingId} onBook={book} />}
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="week-scroll" data-sport={sport}>
            <table className="week-grid">
              <caption className="visually-hidden">Free sessions by day and start time. Select a cell to see its halls and book.</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  {grid.times.map((time) => (
                    <th scope="col" key={time}>
                      {time}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.days.map((day) => (
                  <React.Fragment key={day}>
                    <tr>
                      <th scope="row">{formatDay(`${day}T12:00:00Z`)}</th>
                      {rowSegments(grid, day).map(({ time, cell, state, span, until }) => {
                        const isSelected = selected?.day === day && selected?.time === time;
                        const label = cellLabel(cell ?? { mine: [], theirs: [], free: [] }, sport, span);
                        return (
                          <td key={time} colSpan={span}>
                            {cell ? (
                              <button
                                type="button"
                                className="court-cell"
                                data-state={state}
                                aria-pressed={isSelected}
                                aria-label={`${formatLongDay(`${day}T12:00:00Z`)} ${time}${span > 1 ? ` to ${untilLabel(until)}` : ""}: ${label}`}
                                onClick={() => setSelected(isSelected ? null : { day, time })}
                              >
                                {label}
                              </button>
                            ) : (
                              <span className="court-cell" data-state="none" aria-hidden="true" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {selected?.day === day && selectedCell && (
                      <tr className="detail-row">
                        <td colSpan={grid.times.length + 1}>
                          <SlotDetail cell={selectedCell} sport={sport} bookingId={bookingId} onBook={book} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-legend" data-sport={sport}>
            <span><span className="legend-swatch" data-state="free" /> Free</span>
            <span><span className="legend-swatch" data-state="mine" /> Yours</span>
            <span><span className="legend-swatch" data-state="theirs" /> Held by someone else here</span>
            <SportTag sport={sport} />
          </div>
          {!selectedCell && <p className="footnote">Select a time to see each hall and book it.</p>}
        </>
      )}
    </>
  );
}

function SlotDetail({ cell, sport, bookingId, onBook }) {
  const first = cell.free[0] ?? cell.mine[0] ?? cell.theirs[0]?.slot;
  const ref = useRef(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [cell.day, cell.time]);
  return (
    <section ref={ref} className="slot-detail" data-sport={sport} aria-live="polite">
      <h2>
        {formatLongDay(first.start_time_local)} <span className="tabular">{cell.time}</span>
      </h2>
      <ul>
        {cell.free.map((slot) => {
          const id = slotIdentity(slot);
          return (
            <li key={id}>
              <span>
                <strong>{slot.bookable_item_name}</strong>
                {slot.bookable_item_name !== slot.activity_name && <span className="muted"> · {slot.activity_name}</span>}
              </span>
              <span className="tabular">{slot.price ?? "Price not listed"}</span>
              <button type="button" className="button primary" onClick={() => onBook(slot)} disabled={Boolean(bookingId)}>
                {bookingId === id ? "Booking…" : "Book 1 hour"}
              </button>
            </li>
          );
        })}
        {cell.mine.map((slot) => (
          <li key={slotIdentity(slot)}>
            <span>
              <strong>{slot.bookable_item_name}</strong>
            </span>
            <span className="muted">Already held by you</span>
            <span />
          </li>
        ))}
        {cell.theirs.map(({ slot, hold }) => (
          <li key={slotIdentity(slot)}>
            <span>
              <strong>{slot.bookable_item_name}</strong>
            </span>
            <span className="muted">Held for {hold.username ?? "someone else"}</span>
            <span />
          </li>
        ))}
      </ul>
    </section>
  );
}
