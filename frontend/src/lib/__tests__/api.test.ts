import { api, getImageUrl, authFetch } from '../api';

jest.mock('../auth-storage', () => ({
  clearAuth: jest.fn(),
}));

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

const ok = (data: unknown = { data: 'test' }) => ({ ok: true, status: 200, json: async () => data });
const unauthorized = () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) });
const urlOf = (call: any[]) => String(call[0]);

describe('API Client (cookie session)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(ok());
  });

  it('never sends an Authorization header — the session travels in HttpOnly cookies', async () => {
    await api.get('/properties');
    const init = fetchMock.mock.calls[0][1];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(init.credentials).toBe('include');
    expect(api.getHeaders()).not.toHaveProperty('Authorization');
  });

  it('makes a GET request to the API path', async () => {
    await api.get('/properties');
    expect(urlOf(fetchMock.mock.calls[0])).toContain('/api/v1/properties');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'GET' }));
  });

  it('sends a JSON body on POST', async () => {
    await api.post('/sales', { amount: 5 });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ amount: 5 }));
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('throws the server message on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'Bad thing' }) });
    await expect(api.get('/x')).rejects.toThrow('Bad thing');
  });

  it('renews an expired session once and retries the request', async () => {
    fetchMock
      .mockResolvedValueOnce(unauthorized()) // original request
      .mockResolvedValueOnce(ok({})) // POST /auth/refresh
      .mockResolvedValueOnce(ok({ data: 'fresh' })); // retry
    await expect(api.get('/sales')).resolves.toEqual({ data: 'fresh' });
    expect(urlOf(fetchMock.mock.calls[1])).toContain('/api/v1/auth/refresh');
    expect(urlOf(fetchMock.mock.calls[2])).toContain('/api/v1/sales');
  });

  it('shares one refresh between concurrent requests', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) return ok({});
      const n = fetchMock.mock.calls.filter((c) => urlOf(c) === url).length;
      return n === 1 ? unauthorized() : ok();
    });
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    const refreshes = fetchMock.mock.calls.filter((c) => urlOf(c).includes('/auth/refresh'));
    expect(refreshes).toHaveLength(1);
  });

  it('does not try to refresh on auth endpoints (wrong password is a plain 401)', async () => {
    fetchMock.mockResolvedValueOnce(unauthorized());
    const res = await authFetch('/auth/2fa/login', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('getImageUrl', () => {
  it('should return empty string for empty path', () => {
    expect(getImageUrl('')).toBe('');
  });

  it('should return full URL as-is', () => {
    const url = 'https://example.com/image.jpg';
    expect(getImageUrl(url)).toBe(url);
  });

  it('should prepend API base URL for relative paths', () => {
    const result = getImageUrl('/uploads/gallery/image.jpg');
    expect(result).toContain('/uploads/gallery/image.jpg');
    expect(result).toMatch(/^https?:\/\//);
  });
});
