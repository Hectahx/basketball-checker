const API_BASE =
  import.meta.env.VITE_API_BASE ??
  `${window.location.protocol}//${window.location.hostname}:8000`;

const TOKEN_KEY = "bookerToken";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Thrown for any non-2xx response, carrying the HTTP status. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};

export function handleUnauthorized(callback) {
  onUnauthorized = callback;
}

export async function api(path, { body, ...options } = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the Hall Pass server. Check it's running, then try again.", 0);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(describeError(payload.detail, response.status), response.status);
  }
  if (response.status === 204) return null;
  return response.json();
}

function describeError(detail, status) {
  if (typeof detail === "string") return detail;
  // FastAPI validation errors arrive as a list of {loc, msg}.
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => `${item.loc?.at(-1) ?? "Field"}: ${item.msg}`).join(". ");
  }
  return `Request failed (${status})`;
}
