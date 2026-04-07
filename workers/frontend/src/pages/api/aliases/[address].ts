import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../../lib/api';

export const PATCH: APIRoute = async ({ locals, request, params }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  const address = decodeURIComponent(params.address ?? '').toLowerCase();
  const body = await request.json();
  const status = (body as any)?.status;

  if (!['active', 'blocked'].includes(status)) {
    return json({ error: 'status must be "active" or "blocked"' }, 400);
  }

  const db = locals.runtime.env.DB;
  const result = await db
    .prepare('UPDATE aliases SET status = ? WHERE address = ?')
    .bind(status, address)
    .run();

  if (result.meta.changes === 0) return json({ error: 'Alias not found' }, 404);
  return json({ success: true, address, status });
};

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  const address = decodeURIComponent(params.address ?? '').toLowerCase();
  const db = locals.runtime.env.DB;
  const result = await db
    .prepare('DELETE FROM aliases WHERE address = ?')
    .bind(address)
    .run();

  if (result.meta.changes === 0) return json({ error: 'Alias not found' }, 404);
  return json({ success: true });
};
