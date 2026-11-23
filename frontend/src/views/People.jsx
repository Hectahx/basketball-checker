import React, { useState } from "react";
import { Copy, Link } from "lucide-react";
import { api } from "../lib/api.js";
import { formatDay, formatDateTime } from "../lib/format.js";
import { Chip, Notice, PageHeader, SkeletonRows, Switch, useLoad } from "../lib/ui.jsx";

export default function People({ me, accounts }) {
  const users = useLoad(() => api("/api/users"));
  const [message, setMessage] = useState(null);
  const [inviteShared, setInviteShared] = useState(true);
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "user", shared_access: true });
  const shared = accounts.find((account) => account.credential_mode === "environment");
  const mainAdminId = (users.data ?? []).filter((user) => user.role === "admin").sort((a, b) => a.id - b.id)[0]?.id;

  async function act(task, text) {
    setMessage(null);
    try {
      await task();
      if (text) setMessage({ tone: "ok", text });
      await users.reload();
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    }
  }

  async function createInvite(event) {
    event.preventDefault();
    setCopied(false);
    try {
      setInvite(await api("/api/invites", { method: "POST", body: { shared_access: inviteShared } }));
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite.invite_url);
      setCopied(true);
    } catch {
      setMessage({ tone: "danger", text: "Couldn't copy automatically. Select the link and copy it." });
    }
  }

  async function createUser(event) {
    event.preventDefault();
    await act(() => api("/api/users", { method: "POST", body: form }), `Created ${form.username}. Send them their temporary password.`);
    setForm({ username: "", password: "", role: "user", shared_access: true });
  }

  return (
    <>
      <PageHeader title="People" description="Who can sign in, and who can book with the shared Aston account." />
      <Notice tone={message?.tone} onDismiss={() => setMessage(null)}>
        {message?.text}
      </Notice>

      <div className="settings-grid">
        <section className="region" aria-labelledby="invite-heading">
          <h2 id="invite-heading">Invite someone</h2>
          <form className="stacked-form" onSubmit={createInvite}>
            <p className="muted">A single-use link that expires after 7 days. They pick their own username and password.</p>
            <Switch checked={inviteShared} onChange={setInviteShared} label="Let them use the shared Aston account" description="They can still add their own account instead, or as well." />
            <div>
              <button type="submit" className="button primary">
                <Link size={16} aria-hidden="true" /> Create invite link
              </button>
            </div>
            {invite && (
              <div className="invite-result">
                <label className="field">
                  <span>Send this link · expires {formatDay(invite.expires_at)}</span>
                  <input readOnly value={invite.invite_url} onFocus={(event) => event.target.select()} />
                </label>
                <button type="button" className="button secondary" onClick={copyInvite}>
                  <Copy size={16} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </form>
        </section>

        <section className="region" aria-labelledby="create-heading">
          <h2 id="create-heading">Create an account directly</h2>
          <form className="stacked-form" onSubmit={createUser}>
            <label className="field">
              <span>Username</span>
              <input required minLength={3} pattern="[A-Za-z0-9_.\-]+" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label className="field">
              <span>Temporary password (8+ characters)</span>
              <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="user">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <Switch checked={form.shared_access} onChange={(value) => setForm({ ...form, shared_access: value })} label="Shared Aston access" />
            <div>
              <button type="submit" className="button secondary">
                Create account
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="region" aria-labelledby="members-heading">
        <h2 id="members-heading">Members</h2>
        {users.loading && !users.data ? (
          <SkeletonRows count={2} height="3rem" />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Shared account</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((user) => {
                  const isMain = user.id === mainAdminId;
                  const isMe = user.id === me?.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.username}</strong>
                        {isMe && <span className="muted"> (you)</span>}
                      </td>
                      <td>{user.role === "admin" ? (isMain ? "Main admin" : "Admin") : "Member"}</td>
                      <td>
                        <Switch
                          checked={user.shared_access}
                          disabled={!shared}
                          onChange={(value) =>
                            act(
                              () => api(`/api/aston-accounts/${shared.id}/members/${user.id}`, { method: value ? "POST" : "DELETE" }),
                              `${value ? "Gave" : "Removed"} shared Aston access ${value ? "to" : "from"} ${user.username}.`,
                            )
                          }
                          label={<span className="visually-hidden">Shared Aston access for {user.username}</span>}
                        />
                      </td>
                      <td>{user.enabled ? <Chip tone="ok">Active</Chip> : <Chip tone="neutral" icon={false}>Disabled</Chip>}</td>
                      <td className="muted" title={formatDateTime(user.created_at)}>
                        {formatDay(user.created_at)}
                      </td>
                      <td>
                        <div className="row-actions">
                          {!isMain && (
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => act(() => api(`/api/users/${user.id}`, { method: "PATCH", body: { role: user.role === "admin" ? "user" : "admin" } }), `${user.username} is now ${user.role === "admin" ? "a member" : "an admin"}.`)}
                            >
                              {user.role === "admin" ? "Make member" : "Make admin"}
                            </button>
                          )}
                          {!isMe && (
                            <button
                              type="button"
                              className={`button ${user.enabled ? "danger-quiet" : "secondary"}`}
                              onClick={() => act(() => api(`/api/users/${user.id}`, { method: "PATCH", body: { enabled: !user.enabled } }), `${user.username} ${user.enabled ? "can no longer sign in" : "can sign in again"}.`)}
                            >
                              {user.enabled ? "Disable" : "Enable"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
