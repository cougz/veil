export function isAuthorized(request: Request, env: any): boolean {
  const token = env.API_TOKEN;
  const header = request.headers.get('Authorization') ?? '';
  return header === `Bearer ${token}`;
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
