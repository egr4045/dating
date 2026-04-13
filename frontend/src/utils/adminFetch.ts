export function isAdminTokenExpired(): boolean {
  const token = localStorage.getItem('adminToken');
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('adminToken');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  }
  return res;
}
