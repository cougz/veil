import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../../lib/api';

const VALID_LEVELS = ['info', 'warn', 'error'];
const VALID_EVENTS = ['forwarded', 'blocked', 'expired', 'rate_limited', 'config_error', 'error'];

export const GET: APIRoute = async ({ locals, request }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
  const offset = (page - 1) * limit;
  const level = url.searchParams.get('level');
  const event = url.searchParams.get('event');
  const search = url.searchParams.get('search')?.trim();

  const db = locals.runtime.env.DB;

  const conditions: string[] = [];
  const params: any[] = [];

  if (level && VALID_LEVELS.includes(level)) {
    conditions.push('level = ?');
    params.push(level);
  }

  if (event && VALID_EVENTS.includes(event)) {
    conditions.push('event = ?');
    params.push(event);
  }

  if (search) {
    conditions.push('(alias LIKE ? OR from_addr LIKE ? OR message LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM logs ${where}`)
    .bind(...params)
    .first();

  const { results } = await db
    .prepare(`SELECT * FROM logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all();

  return json({
    logs: results,
    pagination: {
      page,
      limit,
      total: (countResult as any)?.total ?? 0,
    },
  });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  if (!(await isAuthorized(request, locals.runtime.env))) return unauthorized();

  const url = new URL(request.url);
  const before = url.searchParams.get('before');

  const db = locals.runtime.env.DB;

  if (before) {
    const ts = parseInt(before, 10);
    if (isNaN(ts)) return json({ error: 'Invalid before timestamp' }, 400);
    await db.prepare('DELETE FROM logs WHERE timestamp < ?').bind(ts).run();
  } else {
    await db.prepare('DELETE FROM logs').run();
  }

  return json({ success: true });
};
