import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../lib/api';

export const GET: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
  const offset = (page - 1) * limit;

  const db = locals.runtime.env.DB;
  const { results } = await db
    .prepare('SELECT * FROM aliases ORDER BY last_seen DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all();

  return json({ aliases: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  const body = await request.json();
  const address = (body as any)?.address?.toLowerCase()?.trim();
  const expiresAt = (body as any)?.expires_at ? Number((body as any)?.expires_at) : null;
  const domain = locals.runtime.env.DOMAIN;

  if (!address) return json({ error: 'address is required' }, 400);
  if (!address.endsWith(`@${domain}`)) {
    return json({ error: `address must be @${domain}` }, 400);
  }

  const localPart = address.split('@')[0];
  if (!localPart || localPart.length === 0) {
    return json({ error: 'local part of address cannot be empty' }, 400);
  }
  if (/\s/.test(localPart)) {
    return json({ error: 'local part cannot contain whitespace' }, 400);
  }
  if (!/^[a-zA-Z0-9._%+\-]+$/.test(localPart)) {
    return json({ error: 'local part contains invalid characters' }, 400);
  }

  const now = Date.now();
  const db = locals.runtime.env.DB;

  try {
    await db
      .prepare(`
        INSERT INTO aliases (address, status, first_seen, last_seen, mail_count, expires_at)
        VALUES (?, 'active', ?, ?, 0, ?)
      `)
      .bind(address, now, now, expiresAt)
      .run();
    return json({ success: true, address }, 201);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) {
      return json({ error: 'Alias already exists' }, 409);
    }
    throw e;
  }
};
