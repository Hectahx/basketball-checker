import React, { useState } from "react";
import { api, setToken } from "../lib/api.js";
import { Notice, Switch, Wordmark } from "../lib/ui.jsx";

export default function Login({ onSignedIn }) {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useShared, setUseShared] = useState(true);
  const [astonUsername, setAstonUsername] = useState("");
  const [astonPassword, setAstonPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = inviteToken
        ? await api("/api/invites/accept", {
            method: "POST",
            body: {
              token: inviteToken,
              username,
              password,
              use_shared_account: useShared,
              aston_username: astonUsername || null,
              aston_password: astonPassword || null,
            },
          })
        : await api("/api/auth/login", { method: "POST", body: { username, password } });
      setToken(result.token);
      if (inviteToken) window.history.replaceState(null, "", window.location.pathname);
      onSignedIn();
    } catch (err) {
      setError(err.status === 401 ? "That username and password don't match." : err.message);
    } finally {
      setBusy(false);
    }
  }

  const needsPrivate = inviteToken && !useShared;

  return (
    <main className="login-shell">
      <form className="login-court" onSubmit={submit}>
        <Wordmark />
        <div>
          <h1>{inviteToken ? "Join Hall Pass" : "Sign in"}</h1>
          <p className="muted">{inviteToken ? "Pick a username and password for this app. Your Sport Aston login is separate." : "Court time at Sport Aston, booked for you."}</p>
        </div>
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required minLength={inviteToken ? 3 : undefined} />
        </label>
        <label className="field">
          <span>Password{inviteToken ? " (8+ characters)" : ""}</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={inviteToken ? "new-password" : "current-password"} required minLength={inviteToken ? 8 : undefined} />
        </label>
        {inviteToken && (
          <fieldset className="invite-accounts">
            <legend>Which Sport Aston account should book for you?</legend>
            <Switch checked={useShared} onChange={setUseShared} label="The shared account" description="Only if your invite includes it." />
            <label className="field">
              <span>Your own Sport Aston email{needsPrivate ? "" : " (optional)"}</span>
              <input value={astonUsername} onChange={(event) => setAstonUsername(event.target.value)} autoComplete="off" required={needsPrivate} />
            </label>
            <label className="field">
              <span>Your own Sport Aston password{needsPrivate ? "" : " (optional)"}</span>
              <input type="password" value={astonPassword} onChange={(event) => setAstonPassword(event.target.value)} autoComplete="new-password" required={needsPrivate} />
            </label>
          </fieldset>
        )}
        <Notice tone="danger">{error}</Notice>
        <button type="submit" className="button primary wide" disabled={busy || !username || !password}>
          {busy ? (inviteToken ? "Creating account…" : "Signing in…") : inviteToken ? "Create account" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
