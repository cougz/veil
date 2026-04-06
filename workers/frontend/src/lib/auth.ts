import { json } from './json';

const COOKIE_NAME = 'veil_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function createSessionToken(secret: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${timestamp}:${secret}`;
  const hash = btoa(payload);
  return hash;
}

export function validateSessionToken(token: string, apiToken: string): boolean {
  if (!token) return false;
  try {
    const decoded = atob(token);
    const [timestamp, secret] = decoded.split(':');
    if (!timestamp || !secret) return false;
    if (secret !== apiToken) return false;
    const tokenTime = parseInt(timestamp, 36);
    const age = Date.now() - tokenTime;
    if (age > COOKIE_MAX_AGE * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export function getSessionFromCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export function isAuthenticated(request: Request, env: { API_TOKEN: string }): boolean {
  const sessionToken = getSessionFromCookie(request);
  if (!sessionToken) return false;
  return validateSessionToken(sessionToken, env.API_TOKEN);
}

export function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}

export function requireAuth(request: Request, env: { API_TOKEN: string }): boolean {
  return isAuthenticated(request, env);
}
