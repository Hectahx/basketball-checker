import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarClock, ClipboardList, History, LogOut, RefreshCw, Users, Zap } from "lucide-react";
import "./styles.css";

const API_BASE =
  import.meta.env.VITE_API_BASE ??
  `${window.location.protocol}//${window.location.hostname}:8000`;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getToken() {
  return localStorage.getItem("bookerToken");
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed with ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Login({ onLogin }) {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useShared, setUseShared] = useState(true);
  const [astonUsername, setAstonUsername] = useState("");
  const [astonPassword, setAstonPassword] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api(inviteToken ? "/api/invites/accept" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(inviteToken ? { token: inviteToken, username, password, use_shared_account: useShared, aston_username: astonUsername || null, aston_password: astonPassword || null } : { username, password }),
      });
      localStorage.setItem("bookerToken", result.token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <h1>Basketball Booker</h1>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {inviteToken && <>
          <label><input type="checkbox" checked={useShared} onChange={(e) => setUseShared(e.target.checked)} /> Use the shared Aston account</label>
          <p className="eyebrow">You can add private Aston credentials as well, or use them instead.</p>
          <label>Aston username <input value={astonUsername} onChange={(e) => setAstonUsername(e.target.value)} /></label>
          <label>Aston password <input type="password" value={astonPassword} onChange={(e) => setAstonPassword(e.target.value)} /></label>
        </>}
        {error && <p className="error">{error}</p>}
        <button disabled={loading || !password}>{loading ? "Signing in..." : inviteToken ? "Create account" : "Sign in"}</button>
      </form>
    </main>
  );
}

function UsersView({ accounts }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "user", shared_access: true });
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState("");
  const [inviteShared, setInviteShared] = useState(true);

  async function loadUsers() {
    setUsers(await api("/api/users"));
  }
  async function toggleUser(user) {
    await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !user.enabled }) });
    await loadUsers();
  }
  async function toggleRole(user) {
    const nextRole = user.role === "admin" ? "user" : "admin";
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) });
      setMessage(`${user.username} is now ${nextRole}.`);
      await loadUsers();
    } catch (err) { setMessage(err.message); }
  }
  async function toggleShared(user) {
    const shared = accounts.find((account) => account.credential_mode === "environment");
    if (!shared) return;
    if (user.shared_access) {
      await api(`/api/aston-accounts/${shared.id}/members/${user.id}`, { method: "DELETE" });
      setMessage(`Shared Aston access revoked for ${user.username}.`);
    } else {
      await api(`/api/aston-accounts/${shared.id}/members/${user.id}`, { method: "POST" });
      setMessage(`Shared Aston access granted to ${user.username}.`);
    }
    await loadUsers();
  }

  useEffect(() => { loadUsers(); }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", password: "", role: "user", shared_access: true });
      setMessage("Account created.");
      await loadUsers();
    } catch (err) {
      setMessage(err.message);
    }
  }
  async function createInvite(event) {
    event.preventDefault();
    try { const result = await api("/api/invites", { method: "POST", body: JSON.stringify({ shared_access: inviteShared }) }); setInvite(result.invite_url); }
    catch (err) { setMessage(err.message); }
  }

  return <section className="panel">
    <div className="users-heading">
      <div><p className="eyebrow">Admin workspace</p><h2>People & access</h2><p>Invite friends, control their access, and keep the shared Aston account in one place.</p></div>
      <div className="member-count"><strong>{users.length}</strong><span>total members</span></div>
    </div>
    <div className="users-layout">
      <form className="invite-card" onSubmit={createInvite}>
        <div className="invite-icon">+</div>
        <div><h3>Invite someone</h3><p>Create a private link that expires after seven days.</p></div>
        <label className="switch-row"><input type="checkbox" checked={inviteShared} onChange={(e) => setInviteShared(e.target.checked)} /><span><strong>Shared Aston access</strong><small>They can choose the shared account, their own account, or both.</small></span></label>
        <button>Create invite link</button>
        {invite && <label className="invite-link">Ready to send<input readOnly value={invite} onFocus={(e) => e.target.select()} /></label>}
      </form>
      <details className="manual-user-card">
        <summary>Create an account manually <span>For users not using an invite</span></summary>
        <form className="manual-user-form" onSubmit={submit}>
          <label>Username<input value={form.username} required minLength="3" onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
          <label>Temporary password<input type="password" value={form.password} required minLength="8" onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="user">User</option><option value="admin">Admin</option></select></label>
          <label className="switch-row"><input type="checkbox" checked={form.shared_access} onChange={(event) => setForm({ ...form, shared_access: event.target.checked })} /><span><strong>Grant shared Aston access</strong></span></label>
          <button>Create account</button>
        </form>
      </details>
    </div>
    {message && <p className={message === "Account created." || message.includes("granted") ? "success" : "error"}>{message}</p>}
    <section className="members-section">
      <div className="members-title"><div><h3>Members</h3><p>Changes take effect immediately.</p></div></div>
      <div className="members-table">
        <table className="members-data">
          <colgroup><col className="member-col" /><col className="role-col" /><col className="status-col" /><col className="access-col" /><col className="joined-col" /><col className="controls-col" /></colgroup>
          <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Shared account</th><th>Joined</th><th>Controls</th></tr></thead>
          <tbody>{users.map((user) => {
            const mainAdminId = users.filter((member) => member.role === "admin").sort((a, b) => a.id - b.id)[0]?.id;
            const isMainAdmin = user.id === mainAdminId;
            return <tr key={user.id}>
              <td><div className="member-name"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><strong>{user.username}</strong></div></td>
              <td><span className={`role-badge ${user.role}`}>{user.role}{isMainAdmin ? " · main" : ""}</span></td>
              <td><span className={`status-badge ${user.enabled ? "active" : "disabled"}`}>{user.enabled ? "Active" : "Disabled"}</span></td>
              <td><span className={`access-badge ${user.shared_access ? "granted" : "private"}`}>{user.shared_access ? "Shared access" : "No shared access"}</span></td>
              <td className="joined-date">{formatDateTime(user.created_at)}</td>
              <td><div className="member-actions"><button className="secondary" onClick={() => toggleShared(user)}>{user.shared_access ? "Revoke shared access" : "Grant shared access"}</button>{!isMainAdmin && <button className="secondary" onClick={() => toggleRole(user)}>{user.role === "admin" ? "Demote to user" : "Promote to admin"}</button>}<button className={user.enabled ? "danger ghost-danger" : "secondary"} onClick={() => toggleUser(user)}>{user.enabled ? "Disable" : "Enable"}</button></div></td>
            </tr>;
          })}</tbody>
        </table>
        {users.length === 0 && <p className="empty">No members yet. Create an invite to get started.</p>}
      </div>
    </section>
  </section>;
}

function HoldsView() {
  const [holds, setHolds] = useState([]);
  useEffect(() => { api("/api/holds").then(setHolds); }, []);
  return <section className="panel"><div className="toolbar"><div><h2>Holds awaiting payment</h2><p>Pay through Sport Aston; this app does not process payments.</p></div></div><div className="table">{holds.map((hold) => <div className="table-row" key={hold.id}><span>{formatDateTime(hold.start_time_local)}</span><span>{hold.duration_minutes / 60} hour(s)</span><span>{hold.status}</span><span>User #{hold.user_id}</span></div>)}{holds.length === 0 && <p className="empty">No holds recorded yet.</p>}</div></section>;
}

function AccountsView({ accounts, onChanged }) {
  const [form, setForm] = useState({ label: "My Aston account", username: "", password: "" });
  const [message, setMessage] = useState("");
  const [webhook, setWebhook] = useState("");
  async function submit(event) {
    event.preventDefault();
    try {
      await api("/api/aston-accounts", { method: "POST", body: JSON.stringify(form) });
      setForm({ label: "My Aston account", username: "", password: "" });
      setMessage("Your private Aston account was added.");
      await onChanged();
    } catch (err) { setMessage(err.message); }
  }
  async function saveNotifications(event) {
    event.preventDefault();
    try { await api("/api/notification-preferences", { method: "PUT", body: JSON.stringify({ discord_webhook_url: webhook || null }) }); setWebhook(""); setMessage("Notification settings saved."); }
    catch (err) { setMessage(err.message); }
  }
  return <section className="panel">
    <div className="toolbar"><div><h2>Aston accounts</h2><p>Use the shared admin account or add your own. Passwords are encrypted before storage.</p></div></div>
    <div className="table">{accounts.map((account) => <div className="table-row" key={account.id}><span>{account.label}</span><span>{account.credential_mode === "environment" ? "Shared admin account" : "Private account"}</span></div>)}</div>
    <form className="rule-form" onSubmit={submit}>
      <label>Account label<input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
      <label>Aston username<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
      <label>Aston password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {message && <p className={message.includes("added") ? "success" : "error"}>{message}</p>}
      <button>Add private Aston account</button>
    </form>
    <form className="rule-form" onSubmit={saveNotifications}>
      <h3>My notifications</h3>
      <label>Discord webhook URL<input type="password" placeholder="Optional private Discord webhook" value={webhook} onChange={(e) => setWebhook(e.target.value)} /></label>
      <button>Save notification settings</button>
    </form>
  </section>;
}

function Dashboard({ sports }) {
  const [sport, setSport] = useState("basketball");
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });

  const availableSlots = useMemo(() => availability?.slots?.filter((slot) => slot.available) ?? [], [availability]);
  const filteredSlots = useMemo(() => {
    return availableSlots.filter((slot) => {
      const slotDate = slot.start_time_local.slice(0, 10);
      const slotTime = slot.start_time_local.slice(11, 16);
      if (search.date && slotDate !== search.date) return false;
      if (search.startTime && slotTime < search.startTime) return false;
      if (search.endTime && slotTime > search.endTime) return false;
      return true;
    });
  }, [availableSlots, search]);
  const slotsByDay = useMemo(() => {
    const groups = new Map();
    for (const slot of filteredSlots) {
      const dayKey = slot.start_time_local.slice(0, 10);
      if (!groups.has(dayKey)) groups.set(dayKey, []);
      groups.get(dayKey).push(slot);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, slots]) => ({
        day,
        slots: slots.sort((a, b) => a.start_time_utc - b.start_time_utc),
      }));
  }, [filteredSlots]);

  function setSearchField(name, value) {
    setSearch((current) => ({ ...current, [name]: value }));
  }

  function clearSearch() {
    setSearch({ date: "", startTime: "", endTime: "" });
  }

  async function loadAvailability() {
    setLoading(true);
    setMessage("");
    try {
      const data = await api(`/api/availability?sport=${sport}`);
      setAvailability(data);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function book(slot) {
    const id = `${slot.activity_id}:${slot.bookable_item_id}:${slot.start_time_utc}`;
    setBookingId(id);
    setMessage("");
    try {
      const attempt = await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          sport: slot.sport,
          activity_id: slot.activity_id,
          bookable_item_id: slot.bookable_item_id,
          bookable_item_name: slot.bookable_item_name,
          start_time_utc: slot.start_time_utc,
          price: slot.price,
          source: "manual",
        }),
      });
      setMessage(attempt.status === "success" ? "Booked successfully." : `Booking failed: ${attempt.error ?? attempt.response_type ?? "unknown error"}`);
      await loadAvailability();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBookingId("");
    }
  }

  useEffect(() => {
    loadAvailability();
  }, [sport]);

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>Live Availability</h2>
          <p>{availability ? `Last checked ${formatDateTime(availability.checked_at)}` : "Check sessions and book immediately."}</p>
        </div>
        <div className="toolbar-controls">
          <select value={sport} onChange={(event) => setSport(event.target.value)}>
            {sports.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <button className="secondary" onClick={loadAvailability} disabled={loading}>
            <RefreshCw size={16} /> {loading ? "Checking..." : "Refresh"}
          </button>
        </div>
      </div>
      {message && <p className={message.includes("failed") || message.includes("error") ? "error" : "success"}>{message}</p>}
      <div className="search-bar">
        <label>
          Day
          <input
            type="date"
            value={search.date}
            onChange={(event) => setSearchField("date", event.target.value)}
          />
        </label>
        <label>
          From
          <input
            type="time"
            value={search.startTime}
            onChange={(event) => setSearchField("startTime", event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="time"
            value={search.endTime}
            onChange={(event) => setSearchField("endTime", event.target.value)}
          />
        </label>
        <button className="secondary" onClick={clearSearch} disabled={!search.date && !search.startTime && !search.endTime}>
          Clear search
        </button>
        <span>
          Showing {filteredSlots.length} of {availableSlots.length} available session{availableSlots.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="day-grid">
        {slotsByDay.map(({ day, slots }) => (
          <section className="day-column" key={day}>
            <div className="day-header">
              <strong>{formatDay(`${day}T12:00:00`)}</strong>
              <span>{slots.length} session{slots.length === 1 ? "" : "s"}</span>
            </div>
            <div className="day-sessions">
              {slots.map((slot) => {
                const id = `${slot.activity_id}:${slot.bookable_item_id}:${slot.start_time_utc}`;
                return (
                  <article className="session-card" key={id}>
                    <div>
                      <strong>{formatTime(slot.start_time_local)}</strong>
                      <span>{slot.activity_name}</span>
                      <span>{slot.bookable_item_name}</span>
                    </div>
                    <div className="slot-actions">
                      <span className="price">{slot.price ?? "No price"}</span>
                      <button onClick={() => book(slot)} disabled={bookingId === id}>
                        {bookingId === id ? "Booking..." : "Book"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {!loading && availableSlots.length === 0 && <p className="empty">No available slots in this window.</p>}
        {!loading && availableSlots.length > 0 && filteredSlots.length === 0 && <p className="empty">No sessions match this search.</p>}
      </div>
    </section>
  );
}

function RuleForm({ sports, accounts, onCreated }) {
  const [form, setForm] = useState({
    name: "Weekend basketball",
    sport: "basketball",
    enabled: true,
    activity_ids: [],
    days_of_week: [5, 6],
    start_time: "12:00",
    end_time: "22:00",
    lookahead_days: 10,
    run_interval_minutes: 5,
    max_price_pence: "",
    notify_on_success: true,
    notify_on_failure: true,
    notify_on_availability: false,
    aston_account_id: "",
    duration_minutes: 60,
    preferred_start_time: "",
    allow_fallback: false,
  });
  const [error, setError] = useState("");

  const currentSport = sports.find((item) => item.id === form.sport);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleDay(index) {
    const next = form.days_of_week.includes(index)
      ? form.days_of_week.filter((day) => day !== index)
      : [...form.days_of_week, index].sort();
    setField("days_of_week", next);
  }

  function toggleActivity(activityId) {
    const next = form.activity_ids.includes(activityId)
      ? form.activity_ids.filter((id) => id !== activityId)
      : [...form.activity_ids, activityId];
    setField("activity_ids", next);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/rules", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          lookahead_days: Number(form.lookahead_days),
          run_interval_minutes: Number(form.run_interval_minutes),
          max_price_pence: form.max_price_pence === "" ? null : Number(form.max_price_pence),
          aston_account_id: form.aston_account_id === "" ? null : Number(form.aston_account_id),
          duration_minutes: Number(form.duration_minutes),
          preferred_start_time: form.preferred_start_time || null,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="rule-form" onSubmit={submit}>
      <label>
        Rule name
        <input value={form.name} onChange={(event) => setField("name", event.target.value)} />
      </label>
      <label>
        Sport
        <select value={form.sport} onChange={(event) => setForm((current) => ({ ...current, sport: event.target.value, activity_ids: [] }))}>
          {sports.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <div className="button-group">
        {currentSport?.activities.map((activity) => (
          <button
            type="button"
            className={form.activity_ids.includes(activity.id) ? "selected" : "secondary"}
            key={activity.id}
            onClick={() => toggleActivity(activity.id)}
          >
            {activity.name}
          </button>
        ))}
      </div>
      <div className="button-group">
        {DAYS.map((day, index) => (
          <button
            type="button"
            className={form.days_of_week.includes(index) ? "selected" : "secondary"}
            key={day}
            onClick={() => toggleDay(index)}
          >
            {day}
          </button>
        ))}
      </div>
      <div className="form-row">
        <label>
          From
          <input type="time" value={form.start_time} onChange={(event) => setField("start_time", event.target.value)} />
        </label>
        <label>
          To
          <input type="time" value={form.end_time} onChange={(event) => setField("end_time", event.target.value)} />
        </label>
        <label>
          Lookahead days
          <input type="number" min="1" max="31" value={form.lookahead_days} onChange={(event) => setField("lookahead_days", event.target.value)} />
        </label>
        <label>
          Run every mins
          <input type="number" min="1" max="1440" value={form.run_interval_minutes} onChange={(event) => setField("run_interval_minutes", event.target.value)} />
        </label>
        <label>
          Booking length
          <select value={form.duration_minutes} onChange={(event) => setField("duration_minutes", event.target.value)}>
            <option value="60">1 hour</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Prefer start time
          <input type="time" value={form.preferred_start_time} onChange={(event) => setField("preferred_start_time", event.target.value)} />
        </label>
        <label>
          Aston account
          <select value={form.aston_account_id} onChange={(event) => setField("aston_account_id", event.target.value)}>
            <option value="">My default account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </select>
        </label>
      </div>
      <label>
        Max price in pence
        <input placeholder="Optional" value={form.max_price_pence} onChange={(event) => setField("max_price_pence", event.target.value)} />
      </label>
      <div className="checks">
        <label><input type="checkbox" checked={form.enabled} onChange={(event) => setField("enabled", event.target.checked)} /> Enabled</label>
        <label><input type="checkbox" checked={form.notify_on_success} onChange={(event) => setField("notify_on_success", event.target.checked)} /> Success alerts</label>
        <label><input type="checkbox" checked={form.notify_on_failure} onChange={(event) => setField("notify_on_failure", event.target.checked)} /> Failure alerts</label>
        <label><input type="checkbox" checked={form.allow_fallback} onChange={(event) => setField("allow_fallback", event.target.checked)} /> Allow a non-preferred start if unavailable</label>
      </div>
      {error && <p className="error">{error}</p>}
      <button>Create rule</button>
    </form>
  );
}

function Rules({ sports, accounts }) {
  const [rules, setRules] = useState([]);
  const [message, setMessage] = useState("");

  async function loadRules() {
    setRules(await api("/api/rules"));
  }

  async function toggle(rule) {
    await api(`/api/rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await loadRules();
  }

  async function run(rule) {
    setMessage("");
    const result = await api(`/api/rules/${rule.id}/run`, { method: "POST" });
    setMessage(`${rule.name} matched ${result.matched_slots} slot(s) and recorded ${result.booking_attempts.length} booking attempt(s).`);
  }

  async function remove(rule) {
    await api(`/api/rules/${rule.id}`, { method: "DELETE" });
    await loadRules();
  }

  useEffect(() => {
    loadRules();
  }, []);

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>Auto-booking Rules</h2>
          <p>Rules book matching slots immediately when they run.</p>
        </div>
      </div>
      {message && <p className="success">{message}</p>}
      <RuleForm sports={sports} accounts={accounts} onCreated={loadRules} />
      <div className="rule-list">
        {rules.map((rule) => (
          <article className="rule-card" key={rule.id}>
            <div>
              <strong>{rule.name}</strong>
              <span>{rule.sport} · {rule.start_time}-{rule.end_time} · {rule.duration_minutes / 60} hour{rule.duration_minutes === 60 ? "" : "s"}</span>
              {rule.preferred_start_time && <span>Preferred start: {rule.preferred_start_time}{rule.allow_fallback ? " (fallback allowed)" : " (strict)"}</span>}
              <span>{rule.days_of_week.map((day) => DAYS[day]).join(", ")}</span>
            </div>
            <div className="rule-actions">
              <button className="secondary" onClick={() => toggle(rule)}>{rule.enabled ? "Disable" : "Enable"}</button>
              <button className="secondary" onClick={() => run(rule)}>Run now</button>
              <button className="danger" onClick={() => remove(rule)}>Delete</button>
            </div>
          </article>
        ))}
        {rules.length === 0 && <p className="empty">No rules yet.</p>}
      </div>
    </section>
  );
}

function HistoryView() {
  const [history, setHistory] = useState({ booking_attempts: [], availability_checks: [] });

  async function loadHistory() {
    setHistory(await api("/api/history?limit=100"));
  }

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>History</h2>
          <p>Recent checks and booking attempts.</p>
        </div>
        <button className="secondary" onClick={loadHistory}><RefreshCw size={16} /> Refresh</button>
      </div>
      <h3>Bookings</h3>
      <div className="table">
        {history.booking_attempts.map((attempt) => (
          <div className="table-row" key={attempt.id}>
            <span>{formatDateTime(attempt.created_at)}</span>
            <span>{attempt.status}</span>
            <span>{attempt.sport}</span>
            <span>{formatDateTime(attempt.start_time_local)}</span>
            <span>{attempt.activity_name}</span>
          </div>
        ))}
      </div>
      <h3>Checks</h3>
      <div className="table">
        {history.availability_checks.map((check) => (
          <div className="table-row" key={check.id}>
            <span>{formatDateTime(check.created_at)}</span>
            <span>{check.status}</span>
            <span>{check.sport}</span>
            <span>{check.slot_count} slots</span>
            <span>{check.matched_count} matched</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState("dashboard");
  const [sports, setSports] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [me, setMe] = useState(null);

  async function loadSports() {
    setSports(await api("/api/sports"));
  }
  async function loadAccounts() { setAccounts(await api("/api/aston-accounts")); }

  useEffect(() => {
    if (authed) {
      Promise.all([loadSports(), api("/api/auth/me"), api("/api/aston-accounts")]).then(([, account, usableAccounts]) => { setMe(account); setAccounts(usableAccounts); }).catch(() => {
        localStorage.removeItem("bookerToken");
        setAuthed(false);
      });
    }
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <main className="app-shell">
      <aside>
        <h1>Booker</h1>
        <nav>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}><CalendarClock size={18} /> Dashboard</button>
          <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}><Zap size={18} /> Rules</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History size={18} /> History</button>
          <button className={tab === "holds" ? "active" : ""} onClick={() => setTab("holds")}><ClipboardList size={18} /> My holds</button>
          <button className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}><Users size={18} /> Accounts</button>
          {me?.role === "admin" && <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><Users size={18} /> Users</button>}
        </nav>
        <button
          className="logout"
          onClick={() => {
            localStorage.removeItem("bookerToken");
            setAuthed(false);
          }}
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      <div className="content">
        <header>
          <div>
            <p className="eyebrow">Sport Aston</p>
            <h1>Basketball Booker</h1>
            {me && <p className="eyebrow">Signed in as {me.username} ({me.role})</p>}
          </div>
          <ClipboardList size={30} />
        </header>
        {sports.length > 0 && tab === "dashboard" && <Dashboard sports={sports} />}
        {sports.length > 0 && tab === "rules" && <Rules sports={sports} accounts={accounts} />}
        {tab === "history" && <HistoryView />}
        {tab === "holds" && <HoldsView />}
        {tab === "accounts" && <AccountsView accounts={accounts} onChanged={loadAccounts} />}
        {me?.role === "admin" && tab === "users" && <UsersView accounts={accounts} />}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
