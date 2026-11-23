import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

/** Court diagram mark: boundary, halfway line and centre circle. */
export function Mark({ size = 22 }) {
  return (
    <svg className="mark" width={size} height={size * 0.68} viewBox="0 0 44 30" aria-hidden="true">
      <rect x="1.5" y="1.5" width="41" height="27" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <line x1="22" y1="1.5" x2="22" y2="28.5" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="22" cy="15" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark />
      <span>Hall Pass</span>
    </span>
  );
}

export const SPORT_LABELS = { basketball: "Basketball", badminton: "Badminton" };

export function SportTag({ sport }) {
  if (!sport) return null;
  return (
    <span className="sport-tag" data-sport={sport}>
      <span className="sport-line" aria-hidden="true" />
      {SPORT_LABELS[sport] ?? sport}
    </span>
  );
}

const TONE_ICONS = { ok: CircleCheck, danger: CircleX, pay: TriangleAlert, warn: TriangleAlert };

export function Chip({ tone = "neutral", children, icon = true }) {
  const Icon = icon ? TONE_ICONS[tone] : null;
  return (
    <span className="chip" data-tone={tone}>
      {Icon && <Icon size={14} strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Inline feedback line. Errors are announced assertively. */
export function Notice({ tone = "ok", children, onDismiss }) {
  if (!children) return null;
  const Icon = TONE_ICONS[tone] ?? CircleCheck;
  return (
    <div className="notice" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
      {onDismiss && (
        <button type="button" className="text-button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Switch({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      {(label || description) && (
        <span className="switch-text">
          {label && <span>{label}</span>}
          {description && <small>{description}</small>}
        </span>
      )}
    </label>
  );
}

/** A row of mutually exclusive choices, built on native radios. */
export function Segmented({ label, value, options, onChange, name, sportTone = false }) {
  const fallback = useId();
  return (
    <fieldset className="segmented" data-tone={sportTone ? "sport" : undefined}>
      {label && <legend>{label}</legend>}
      <div className="segmented-options">
        {options.map((option) => (
          <label key={option.value} className="segment" data-sport={sportTone ? option.value : undefined}>
            <input type="radio" name={name ?? fallback} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Several independent on/off choices that read as one control. */
export function ToggleGroup({ label, values, options, onChange, hint }) {
  function toggle(value) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  return (
    <fieldset className="segmented">
      {label && <legend>{label}</legend>}
      <div className="segmented-options">
        {options.map((option) => (
          <label key={option.value} className="segment">
            <input type="checkbox" checked={values.includes(option.value)} onChange={() => toggle(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint && <small className="field-hint">{hint}</small>}
    </fieldset>
  );
}

export function EmptyState({ title, children, actions }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

export function SkeletonRows({ count = 3, height = "4.5rem" }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

/** A destructive button that asks for a second click instead of a modal. */
export function ConfirmButton({ onConfirm, children, confirmLabel = "Click again to confirm", className = "", ...props }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      {...props}
      className={`${className} ${armed ? "is-armed" : ""}`}
      onClick={() => {
        if (armed) {
          clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 4000);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

/** Loads data on mount and on demand; keeps the last good value while reloading. */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: "", loading: true });
  const run = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await loader();
      setState({ data, error: "", loading: false });
      return data;
    } catch (error) {
      setState((current) => ({ ...current, error: error.message, loading: false }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run };
}

export function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Re-render every minute so relative times ("2 minutes ago") stay honest. */
export function useNow(interval = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
