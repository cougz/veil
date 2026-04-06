const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }
  
  if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  entry.count++;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

export default {
  async email(message, env, ctx) {
    const alias = message.to.toLowerCase().trim();
    const now = Date.now();
    const mode = (env.MODE ?? 'catchall').toLowerCase();
    const forwardTo = env.FORWARD_TO;
    const rejectMessage = env.REJECT_MESSAGE ?? 'This address is no longer active';

    const rateLimitKey = message.from ?? 'unknown';
    if (isRateLimited(rateLimitKey)) {
      message.setReject('Rate limit exceeded');
      return;
    }

    const row = await env.DB
      .prepare('SELECT status, expires_at FROM aliases WHERE address = ?')
      .bind(alias)
      .first();

    if (row?.status === 'blocked') {
      message.setReject(rejectMessage);
      return;
    }

    if (row?.expires_at && row.expires_at < now) {
      message.setReject(rejectMessage);
      return;
    }

    if (!row) {
      if (mode === 'specific') {
        message.setReject(rejectMessage);
        return;
      }
      await env.DB
        .prepare(`
          INSERT INTO aliases (address, status, first_seen, last_seen, mail_count)
          VALUES (?, 'active', ?, ?, 1)
        `)
        .bind(alias, now, now)
        .run();
    } else {
      await env.DB
        .prepare(`
          UPDATE aliases
          SET last_seen = ?, mail_count = mail_count + 1
          WHERE address = ?
        `)
        .bind(now, alias)
        .run();
    }

    await message.forward(forwardTo);
  }
};
