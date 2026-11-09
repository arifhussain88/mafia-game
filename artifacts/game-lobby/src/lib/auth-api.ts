export type AuthUser = { id: string; name: string };

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** POST to an auth endpoint; throws AuthError with the server's message on failure. */
export async function postAuth<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("Can't reach the server. Check your connection and try again.", 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON (proxy error page etc.)
  }
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Something went wrong. Try again.";
    throw new AuthError(message, res.status);
  }
  return data as T;
}

const HAS_ACCOUNT_KEY = "mafia-has-account";

export function saveSession(token: string, user: AuthUser) {
  try {
    localStorage.setItem("mafia-token", token);
    localStorage.setItem("mafia-user", JSON.stringify(user));
    localStorage.setItem(HAS_ACCOUNT_KEY, "1");
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem("mafia-token");
    localStorage.removeItem("mafia-user");
  } catch {}
}

/** Returning players land on "Log in"; first-timers on "Create account". */
export function hasHadAccount(): boolean {
  try { return localStorage.getItem(HAS_ACCOUNT_KEY) === "1"; } catch { return false; }
}
