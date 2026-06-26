const TOKEN_KEY = "botforge_admin_token";

export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function saveAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Drop-in replacement for fetch() on admin-only API routes.
 * Automatically attaches the X-Admin-Token header so every protected
 * endpoint receives the server-issued token without callers having to
 * remember to add it manually.
 */
export function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      "X-Admin-Token": token,
    },
  });
}
