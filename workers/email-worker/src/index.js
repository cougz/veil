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

async function getSetting(db, key, envFallback) {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first();
  return row?.value ?? envFallback ?? null;
}

function getRejectionMessage(error) {
  if (error.message?.includes('destination address not verified')) {
    return '550 5.7.1 Destination address not verified. Please verify the forwarding address in Cloudflare dashboard.';
  }
  return '451 4.0.0 Temporary delivery failure. Please try again later.';
}

async function writeLog(db, { level, event, alias, from, to, message, details }) {
  try {
    await db
      .prepare(
        'INSERT INTO logs (timestamp, level, event, alias, from_addr, to_addr, message, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        Date.now(),
        level,
        event,
        alias ?? null,
        from ?? null,
        to ?? null,
        message ?? null,
        details ? JSON.stringify(details) : null
      )
      .run();
  } catch (logErr) {
    console.error('Failed to write log', { logError: logErr.message, event, alias });
  }
}

export default {
  async email(message, env, ctx) {
    const alias = message.to.toLowerCase().trim();
    const from = message.from;
    let forwardTo = null;

    try {
      const now = Date.now();

      if (!env.DB) {
        console.error('DB not bound', { alias, from });
        message.setReject('Server misconfiguration: database not bound');
        return;
      }

      forwardTo = await getSetting(env.DB, 'forward_to', env.FORWARD_TO);
      const rejectMessage =
        (await getSetting(env.DB, 'reject_message', env.REJECT_MESSAGE)) ??
        'This address is no longer active';

      if (!forwardTo) {
        console.error('FORWARD_TO not set', { alias, from });
        await writeLog(env.DB, {
          level: 'error',
          event: 'config_error',
          alias,
          from,
          message: 'FORWARD_TO not configured',
        });
        message.setReject('Server misconfiguration: FORWARD_TO not set');
        return;
      }

      const rateLimitKey = from ?? 'unknown';
      if (isRateLimited(rateLimitKey)) {
        console.warn('Rate limited', { alias, from });
        await writeLog(env.DB, {
          level: 'warn',
          event: 'rate_limited',
          alias,
          from,
          message: 'Rate limit exceeded',
          details: { limit: RATE_LIMIT_MAX, window: RATE_LIMIT_WINDOW },
        });
        message.setReject('Rate limit exceeded');
        return;
      }

      const row = await env.DB
        .prepare('SELECT status, expires_at FROM aliases WHERE address = ?')
        .bind(alias)
        .first();

      if (row?.status === 'blocked') {
        console.info('Blocked', { alias, from });
        await writeLog(env.DB, {
          level: 'info',
          event: 'blocked',
          alias,
          from,
          to: forwardTo,
          message: rejectMessage,
        });
        message.setReject(rejectMessage);
        return;
      }

      if (row?.expires_at && row.expires_at < now) {
        console.info('Expired', { alias, from, expiredAt: row.expires_at });
        await writeLog(env.DB, {
          level: 'info',
          event: 'expired',
          alias,
          from,
          to: forwardTo,
          message: rejectMessage,
          details: { expiredAt: row.expires_at },
        });
        message.setReject(rejectMessage);
        return;
      }

      if (!row) {
        await env.DB
          .prepare(
            `INSERT INTO aliases (address, status, first_seen, last_seen, mail_count)
             VALUES (?, 'active', ?, ?, 1)`
          )
          .bind(alias, now, now)
          .run();
        console.info('Created alias', { alias, from });
      } else {
        await env.DB
          .prepare(
            `UPDATE aliases
             SET last_seen = ?, mail_count = mail_count + 1
             WHERE address = ?`
          )
          .bind(now, alias)
          .run();
        console.info('Updated alias', { alias, from });
      }

      await message.forward(forwardTo);
      console.info('Forwarded', { alias, from, to: forwardTo });
      await writeLog(env.DB, {
        level: 'info',
        event: 'forwarded',
        alias,
        from,
        to: forwardTo,
        message: 'Email forwarded successfully',
      });
    } catch (error) {
      console.error('Forwarding failed', {
        alias,
        from,
        to: forwardTo,
        error: error.message,
        stack: error.stack,
      });
      await writeLog(env.DB, {
        level: 'error',
        event: 'error',
        alias,
        from,
        to: forwardTo,
        message: error.message,
        details: { stack: error.stack },
      });
      message.setReject(getRejectionMessage(error));
    }
  },
};
