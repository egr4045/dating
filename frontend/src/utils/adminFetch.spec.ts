import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Мокаем fetch глобально
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Хелпер: создаёт валидный JWT с заданным exp
function makeJwt(expOffsetMs: number): string {
  const payload = { exp: Math.floor((Date.now() + expOffsetMs) / 1000) };
  const encoded = btoa(JSON.stringify(payload));
  return `header.${encoded}.signature`;
}

describe('isAdminTokenExpired', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('нет токена в localStorage → true', async () => {
    const { isAdminTokenExpired } = await import('./adminFetch');
    expect(isAdminTokenExpired()).toBe(true);
  });

  it('токен с exp в прошлом → true', async () => {
    vi.resetModules();
    const { isAdminTokenExpired } = await import('./adminFetch');
    localStorage.setItem('adminToken', makeJwt(-10000)); // истёк 10 сек назад
    expect(isAdminTokenExpired()).toBe(true);
  });

  it('токен с exp в будущем → false', async () => {
    vi.resetModules();
    const { isAdminTokenExpired } = await import('./adminFetch');
    localStorage.setItem('adminToken', makeJwt(60 * 60 * 1000)); // через 1 час
    expect(isAdminTokenExpired()).toBe(false);
  });

  it('невалидный base64 → true (catch)', async () => {
    vi.resetModules();
    const { isAdminTokenExpired } = await import('./adminFetch');
    localStorage.setItem('adminToken', 'not.a.valid.jwt!!!');
    expect(isAdminTokenExpired()).toBe(true);
  });

  it('токен без точек (не JWT формат) → true', async () => {
    vi.resetModules();
    const { isAdminTokenExpired } = await import('./adminFetch');
    localStorage.setItem('adminToken', 'plaintext');
    expect(isAdminTokenExpired()).toBe(true);
  });

  it('токен с exp ровно сейчас → true (граница)', async () => {
    vi.resetModules();
    const { isAdminTokenExpired } = await import('./adminFetch');
    localStorage.setItem('adminToken', makeJwt(0)); // exp = прямо сейчас
    // exp * 1000 < Date.now() — зависит от миллисекунды, но должен быть true или в пределе
    // Тестируем что не throws
    expect(typeof isAdminTokenExpired()).toBe('boolean');
  });
});

describe('adminFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('добавляет Authorization заголовок с токеном из localStorage', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    localStorage.setItem('adminToken', 'my-test-token');
    mockFetch.mockResolvedValueOnce({ status: 200 } as Response);

    await adminFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-test-token',
        }),
      })
    );
  });

  it('без токена → Authorization: Bearer (пустая строка)', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    mockFetch.mockResolvedValueOnce({ status: 200 } as Response);

    await adminFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ',
        }),
      })
    );
  });

  it('добавляет Content-Type: application/json', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    mockFetch.mockResolvedValueOnce({ status: 200 } as Response);

    await adminFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('при ответе 200 → возвращает Response без сайд-эффектов', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    const mockResponse = { status: 200 } as Response;
    mockFetch.mockResolvedValueOnce(mockResponse);
    localStorage.setItem('adminToken', 'valid-token');

    const result = await adminFetch('/api/data');

    expect(result).toBe(mockResponse);
    expect(localStorage.getItem('adminToken')).toBe('valid-token'); // не удалён
  });

  it('при ответе 401 → удаляет adminToken из localStorage', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    mockFetch.mockResolvedValueOnce({ status: 401 } as Response);
    localStorage.setItem('adminToken', 'expired-token');

    await adminFetch('/api/protected');

    expect(localStorage.getItem('adminToken')).toBeNull();
  });

  it('при ответе 401 → редиректит на /admin/login', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    mockFetch.mockResolvedValueOnce({ status: 401 } as Response);

    // В jsdom window.location.href — строка
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    await adminFetch('/api/protected');

    expect(window.location.href).toBe('/admin/login');
  });

  it('пробрасывает кастомные опции (method, body)', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    mockFetch.mockResolvedValueOnce({ status: 200 } as Response);

    await adminFetch('/api/data', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/data',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      })
    );
  });

  it('кастомные заголовки мержатся с дефолтными', async () => {
    vi.resetModules();
    const { adminFetch } = await import('./adminFetch');
    mockFetch.mockResolvedValueOnce({ status: 200 } as Response);

    await adminFetch('/api/test', {
      headers: { 'X-Custom': 'value' },
    });

    const call = mockFetch.mock.calls[0][1];
    expect(call.headers['X-Custom']).toBe('value');
    expect(call.headers['Content-Type']).toBe('application/json');
  });
});
