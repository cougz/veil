import type { APIRoute } from 'astro';
import { isAuthorized, unauthorized, json } from '../../lib/api';

export const GET: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  const db = locals.runtime.env.DB;
  const { results } = await db
    .prepare('SELECT * FROM aliases ORDER BY last_seen DESC')
    .all();

  return json({ aliases: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request, locals.runtime.env)) return unauthorized();

  const body = await request.json();
  const address = (body as any)?.address?.toLowerCase()?.trim();
  const domain = locals.runtime.env.DOMAIN;

  if (!address) return json({ error: 'address is required' }, 400);
  if (!address.endsWith(`@${domain}`)) {
    return json({ error: `address must be @${domain}` }, 400);
  }

  const now = Date.now();
  const db = locals.runtime.env.DB;

  try {
    await db
      .prepare(`
        INSERT INTO aliases (address, status, first_seen, last_seen, mail_count)
        VALUES (?, 'active', ?, ?, 0)
      `)
      .bind(address, now, now)
      .run();
    return json({ success: true, address }, 201);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) {
      return json({ error: 'Alias already exists' }, 409);
    }
    throw e;
  }
};
