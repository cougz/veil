import { json } from './json';

const COOKIE_NAME = 'veil_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

async function hmac(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createSessionToken(secret: string): Promise<string> {
  const timestamp = Date.now().toString(36);
  const signature = await hmac(secret, timestamp);
  return `${timestamp}.${signature}`;
}

export async function validateSessionToken(token: string, apiToken: string): Promise<boolean> {
  if (!token) return false;
  try {
    const [timestamp, signature] = token.split('.');
    if (!timestamp || !signature) return false;
    
    const expectedSignature = await hmac(apiToken, timestamp);
    if (signature !== expectedSignature) return false;
    
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

export async function isAuthenticated(request: Request, env: { API_TOKEN: string }): Promise<boolean> {
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

export async function requireAuth(request: Request, env: { API_TOKEN: string }): Promise<boolean> {
  return isAuthenticated(request, env);
}
