/**
 * Auth storage utilities.
 *
 * The session itself lives in HttpOnly cookies set by the backend — tokens are
 * never stored where JavaScript can read them. Only the (non-secret) profile of
 * the signed-in user is kept here, for rendering and role-based routing.
 *
 * In PWA standalone mode (iOS/Android home screen), uses localStorage
 * so the profile persists across app launches.
 * In regular browser, uses sessionStorage for tab isolation.
 */

import { isInstalledApp } from './pwa';

/** Where older versions stored the access token — purged on load and on login. */
const LEGACY_TOKEN_KEY = 'token';
const USER_KEY = 'user';

function purgeLegacyToken(): void {
  try {
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {}
}

if (typeof window !== 'undefined') purgeLegacyToken();

// Installed app (fullscreen / standalone): keep the profile across launches
const isPwaStandalone = isInstalledApp;

function getStorage(): Storage {
  return isPwaStandalone() ? localStorage : sessionStorage;
}

/**
 * True when a user has signed in on this device. The server is the real judge:
 * if the session cookie has gone, the next API call renews it or redirects to login.
 */
export function hasSession(): boolean {
  return getUser() !== null;
}

export function getUser(): { id: string; firstName: string; lastName: string; email: string; role: string; avatar?: string; companyId?: string; isSuperAdmin?: boolean; referralCode?: string; branchId?: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = getStorage();
    let stored = storage.getItem(USER_KEY);
    // Fallback to other storage
    if (!stored) {
      stored = isPwaStandalone() ? sessionStorage.getItem(USER_KEY) : localStorage.getItem(USER_KEY);
    }
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/** Remember the signed-in user's profile. The session cookie was set by the login response. */
export function setAuth(user: Record<string, any>): void {
  purgeLegacyToken();
  const storage = getStorage();
  storage.setItem(USER_KEY, JSON.stringify(user));
  // In PWA mode, also write to sessionStorage so within-session reads work
  if (isPwaStandalone()) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function updateUser(updates: Record<string, any>): void {
  try {
    const storage = getStorage();
    let stored = storage.getItem(USER_KEY);
    if (!stored) {
      stored = isPwaStandalone() ? sessionStorage.getItem(USER_KEY) : localStorage.getItem(USER_KEY);
    }
    if (stored) {
      const user = JSON.parse(stored);
      const updated = { ...user, ...updates };
      const json = JSON.stringify(updated);
      storage.setItem(USER_KEY, json);
      if (isPwaStandalone()) {
        sessionStorage.setItem(USER_KEY, json);
      }
      window.dispatchEvent(new CustomEvent('user-updated'));
    }
  } catch {}
}

export function clearAuth(): void {
  // Clear from both storages to ensure complete logout
  purgeLegacyToken();
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_KEY);
}
