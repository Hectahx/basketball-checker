import React, { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { api } from "../lib/api.js";
import { Chip, Notice, PageHeader, useLoad } from "../lib/ui.jsx";

export default function Account({ me, accounts, onAccountsChanged, onSignOut }) {
  const [form, setForm] = useState({ label: "My Aston account", username: "", password: "" });
  const [accountMessage, setAccountMessage] = useState(null);
  const [webhook, setWebhook] = useState("");
  const [webhookMessage, setWebhookMessage] = useState(null);
  const prefs = useLoad(() => api("/api/notification-preferences"));
  const [saving, setSaving] = useState("");

  async function addAccount(event) {
    event.preventDefault();
    setSaving("account");
    setAccountMessage(null);
    try {
      await api("/api/aston-accounts", { method: "POST", body: form });
      setForm({ label: "My Aston account", username: "", password: "" });
      setAccountMessage({ tone: "ok", text: "Private Aston account added. Choose it per rule, or when booking." });
      await onAccountsChanged();
    } catch (error) {
      setAccountMessage({ tone: "danger", text: error.message });
    } finally {
      setSaving("");
    }
  }

  async function saveWebhook(event, value) {
    event?.preventDefault();
    setSaving("webhook");
    setWebhookMessage(null);
    try {
      await api("/api/notification-preferences", { method: "PUT", body: { discord_webhook_url: value || null } });
      setWebhook("");
      setWebhookMessage({ tone: "ok", text: value ? "Discord alerts are on." : "Discord alerts removed." });
      await prefs.reload();
    } catch (error) {
      setWebhookMessage({ tone: "danger", text: error.message });
    } finally {
      setSaving("");
    }
  }

  const hasWebhook = prefs.data?.discord_webhook_url === "configured";

  return (
    <>
      <PageHeader title="Account" description={me ? `Signed in as ${me.username}${me.role === "admin" ? " (admin)" : ""}.` : null}>
        <button type="button" className="button secondary" onClick={onSignOut}>
          <LogOut size={16} aria-hidden="true" /> Sign out
        </button>
      </PageHeader>

      <div className="settings-grid">
        <section className="region" aria-labelledby="aston-heading">
          <h2 id="aston-heading">Sport Aston accounts</h2>
          <p className="muted">Bookings are made with one of these. Passwords are encrypted before they're stored.</p>
          <ul className="plain-list">
            {accounts.map((account) => (
              <li key={account.id}>
                <KeyRound size={16} aria-hidden="true" />
                <span>{account.label}</span>
                <Chip tone="neutral" icon={false}>
                  {account.credential_mode === "environment" ? "Shared" : "Private"}
                </Chip>
              </li>
            ))}
            {accounts.length === 0 && <li className="muted">No account yet. Add your own below, or ask the admin for shared access.</li>}
          </ul>

          <form className="stacked-form" onSubmit={addAccount}>
            <h3>Add a private account</h3>
            <label className="field">
              <span>Label (only you see it)</span>
              <input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
            </label>
            <label className="field">
              <span>Sport Aston email or username</span>
              <input required autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label className="field">
              <span>Sport Aston password</span>
              <input required type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            <Notice tone={accountMessage?.tone}>{accountMessage?.text}</Notice>
            <div>
              <button type="submit" className="button primary" disabled={saving === "account"}>
                {saving === "account" ? "Adding…" : "Add account"}
              </button>
            </div>
          </form>
        </section>

        <section className="region" aria-labelledby="alerts-heading">
          <h2 id="alerts-heading">Discord alerts</h2>
          <p className="muted">
            Your own alerts for bookings and failures. {hasWebhook ? <Chip tone="ok">Webhook saved</Chip> : <Chip tone="neutral" icon={false}>Not set up</Chip>}
          </p>
          <form className="stacked-form" onSubmit={(event) => saveWebhook(event, webhook)}>
            <label className="field">
              <span>{hasWebhook ? "Replace webhook URL" : "Webhook URL"}</span>
              <input type="password" placeholder="https://discord.com/api/webhooks/…" value={webhook} onChange={(event) => setWebhook(event.target.value)} />
              <small className="field-hint">In Discord: channel settings → Integrations → Webhooks → Copy URL. It's never shown again after saving.</small>
            </label>
            <Notice tone={webhookMessage?.tone}>{webhookMessage?.text}</Notice>
            <div className="button-row">
              <button type="submit" className="button primary" disabled={!webhook || saving === "webhook"}>
                Save webhook
              </button>
              {hasWebhook && (
                <button type="button" className="button secondary" onClick={() => saveWebhook(null, "")}>
                  Remove
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
