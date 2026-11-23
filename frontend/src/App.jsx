import React, { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus, History as HistoryIcon, LogOut, Repeat, UserRound, Users } from "lucide-react";
import { api, clearToken, getToken, handleUnauthorized } from "./lib/api.js";
import { Notice, SkeletonRows, Wordmark } from "./lib/ui.jsx";
import Account from "./views/Account.jsx";
import Book from "./views/Book.jsx";
import History from "./views/History.jsx";
import Login from "./views/Login.jsx";
import Overview from "./views/Overview.jsx";
import People from "./views/People.jsx";
import Rules from "./views/Rules.jsx";

const NAV = [
  { id: "overview", label: "Court time", short: "Home", icon: CalendarCheck },
  { id: "book", label: "Book", short: "Book", icon: CalendarPlus },
  { id: "rules", label: "Rules", short: "Rules", icon: Repeat },
  { id: "history", label: "History", short: "History", icon: HistoryIcon },
  { id: "account", label: "Account", short: "Account", icon: UserRound },
  { id: "people", label: "People", short: "People", icon: Users, admin: true },
];

function currentTab() {
  const id = window.location.hash.replace(/^#\/?/, "");
  return NAV.some((item) => item.id === id) ? id : "overview";
}

export default function App() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken()) && !new URLSearchParams(window.location.search).get("invite"));
  const [tab, setTab] = useState(currentTab);
  const [session, setSession] = useState({ me: null, sports: [], accounts: [], error: "" });

  const signOut = useCallback(() => {
    clearToken();
    setSession({ me: null, sports: [], accounts: [], error: "" });
    setSignedIn(false);
  }, []);

  useEffect(() => handleUnauthorized(signOut), [signOut]);

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const [me, sports, accounts] = await Promise.all([api("/api/auth/me"), api("/api/sports"), api("/api/aston-accounts")]);
      setSession({ me, sports, accounts, error: "" });
    } catch (error) {
      setSession((current) => ({ ...current, error: error.message }));
    }
  }, []);

  useEffect(() => {
    if (signedIn) loadSession();
  }, [signedIn, loadSession]);

  async function reloadAccounts() {
    const accounts = await api("/api/aston-accounts");
    setSession((current) => ({ ...current, accounts }));
  }

  function navigate(id) {
    window.location.hash = `/${id}`;
    setTab(id);
    window.scrollTo({ top: 0 });
  }

  if (!signedIn) return <Login onSignedIn={() => setSignedIn(true)} />;

  const { me, sports, accounts } = session;
  const nav = NAV.filter((item) => !item.admin || me?.role === "admin");
  const ready = me && sports.length;
  const active = tab === "people" && me && me.role !== "admin" ? "overview" : tab;

  return (
    <div className="app-shell">
      <nav className="rail" aria-label="Main">
        <Wordmark />
        <ul>
          {nav.map(({ id, label, short, icon: Icon }) => (
            <li key={id}>
              <a href={`#/${id}`} aria-current={active === id ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate(id); }}>
                <Icon size={19} aria-hidden="true" />
                <span className="nav-label">{label}</span>
                <span className="nav-short">{short}</span>
              </a>
            </li>
          ))}
        </ul>
        {me && (
          <div className="rail-footer">
            <span className="avatar" aria-hidden="true">{me.username.slice(0, 1).toUpperCase()}</span>
            <span className="rail-user">
              <strong>{me.username}</strong>
              <small>{me.role === "admin" ? "Admin" : "Member"}</small>
            </span>
            <button type="button" className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </nav>

      <header className="mobile-top">
        <Wordmark />
        {me && <span className="avatar" aria-label={`Signed in as ${me.username}`}>{me.username.slice(0, 1).toUpperCase()}</span>}
      </header>

      <main className="court" id="main">
        {session.error && (
          <Notice tone="danger">
            {session.error}{" "}
            <button type="button" className="text-button" onClick={loadSession}>
              Try again
            </button>
          </Notice>
        )}
        {!ready ? (
          !session.error && <SkeletonRows count={4} height="4rem" />
        ) : active === "overview" ? (
          <Overview me={me} onNavigate={navigate} />
        ) : active === "book" ? (
          <Book sports={sports} accounts={accounts} me={me} />
        ) : active === "rules" ? (
          <Rules sports={sports} accounts={accounts} me={me} />
        ) : active === "history" ? (
          <History me={me} />
        ) : active === "account" ? (
          <Account me={me} accounts={accounts} onAccountsChanged={reloadAccounts} onSignOut={signOut} />
        ) : (
          <People me={me} accounts={accounts} />
        )}
      </main>
    </div>
  );
}
