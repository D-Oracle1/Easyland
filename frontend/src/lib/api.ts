import { clearAuth } from './auth-storage';

function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  // Also clear the HttpOnly session cookies server-side (fire and forget)
  void endServerSession();
  clearAuth();
  window.location.href = '/auth/login';
}

/** Ask the backend to clear the HttpOnly auth cookies and revoke the refresh token. */
async function endServerSession() {
  try {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(_tenantId ? { 'X-Company-ID': _tenantId } : {}) },
      keepalive: true,
    });
  } catch {
    /* offline — local data is still cleared */
  }
}

/** Full logout: end the server session, then clear local auth data. */
export async function logout() {
  await endServerSession();
  clearAuth();
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

// -- Tenant bridge --
// Stores the resolved company ID for cross-origin deployments where the backend
// cannot read the tenant's custom domain from the Host header.
// NEXT_PUBLIC_COMPANY_ID can be set per-deployment (e.g. Vercel project env vars)
// so tenant deployments on *.vercel.app URLs still send the correct X-Company-ID.
let _tenantId: string | null = process.env.NEXT_PUBLIC_COMPANY_ID || null;
export function setTenantId(id: string | null) { _tenantId = id; }
export function getTenantId(): string | null { return _tenantId; }

/** Resolve a backend-relative image path (e.g. /uploads/properties/x.jpg) to a full URL */
export function getImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// In the browser, route all API calls through the Next.js rewrite proxy
// (/api/:path* → backend) to avoid CORS preflight entirely.
// In SSR/SSG contexts and local dev, use the absolute backend URL directly.
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && !API_BASE_URL.includes('localhost')) {
    return '/api/v1';
  }
  return `${API_BASE_URL}/api/v1`;
}

/**
 * Build a full API URL that goes through the Next.js proxy in the browser
 * (avoids CORS) and directly to the backend in SSR/dev.
 * path should start with '/', e.g. '/auth/register'
 */
export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

// -- Session --
// The browser session lives only in HttpOnly cookies: a short-lived access
// cookie plus a refresh cookie scoped to /api/v1/auth. JS never sees a token.
// When a request comes back 401 we renew the session once and retry.

let refreshing: Promise<boolean> | null = null;

/** Renew the access cookie using the refresh cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(_tenantId ? { 'X-Company-ID': _tenantId } : {}) },
      body: '{}',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // Requests that failed while this was in flight share its result;
        // anything later starts a fresh attempt.
        refreshing = null;
      });
  }
  return refreshing;
}

function withSessionHeaders(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (_tenantId && !headers.has('X-Company-ID')) headers.set('X-Company-ID', _tenantId);
  return { ...init, headers, credentials: 'include' };
}

/**
 * fetch() for authenticated API calls. `input` is an API path ('/sales') or a
 * full URL. Sends the session cookie, renews an expired session once, and
 * sends the user to the login page if the session is really over.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = /^https?:\/\//.test(input) || input.startsWith('/api/') ? input : apiUrl(input);
  let response = await fetch(url, withSessionHeaders(init));
  // Auth endpoints report wrong passwords etc. with 401 — never refresh for those
  if (response.status === 401 && !/\/auth\//.test(url)) {
    if (await refreshSession()) {
      response = await fetch(url, withSessionHeaders(init));
    }
    if (response.status === 401) handleUnauthorized();
  }
  return response;
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: fallback }));
    throw new Error(error.message || fallback);
  }
  return response.json();
}

function jsonRequest(method: string, data?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  };
}

export const api = {
  get baseUrl() { return getApiBaseUrl(); },

  /** Headers for a JSON request. Auth travels in the HttpOnly cookie, not here. */
  getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(_tenantId ? { 'X-Company-ID': _tenantId } : {}),
    };
  },

  async get<T = any>(endpoint: string): Promise<T> {
    return parse<T>(await authFetch(endpoint, { method: 'GET' }), 'Request failed');
  },

  async post<T = any>(endpoint: string, data?: unknown): Promise<T> {
    return parse<T>(await authFetch(endpoint, jsonRequest('POST', data || undefined)), 'Request failed');
  },

  async put<T = any>(endpoint: string, data?: unknown): Promise<T> {
    return parse<T>(await authFetch(endpoint, jsonRequest('PUT', data || undefined)), 'Request failed');
  },

  async patch<T = any>(endpoint: string, data?: unknown): Promise<T> {
    return parse<T>(await authFetch(endpoint, jsonRequest('PATCH', data || undefined)), 'Request failed');
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    return parse<T>(await authFetch(endpoint, { method: 'DELETE' }), 'Request failed');
  },

  async postForm<T = any>(endpoint: string, formData: FormData): Promise<T> {
    return parse<T>(await authFetch(endpoint, { method: 'POST', body: formData }), 'Request failed');
  },

  async uploadFiles(endpoint: string, files: File[], fieldName = 'files'): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append(fieldName, file);
    });
    const result: any = await parse(await authFetch(endpoint, { method: 'POST', body: formData }), 'Upload failed');
    // Unwrap TransformInterceptor { success, data: { urls }, timestamp }
    const inner = result?.data || result;
    return inner?.urls || inner;
  },
};
