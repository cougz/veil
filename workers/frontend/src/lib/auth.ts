import { createRemoteJWKSet, jwtVerify } from 'jose';

import { json } from './json';

export interface CFAccessPayload {
  email: string;
  sub:   string;
  aud:   string[];
  iss:   string;
  exp:   number;
  iat:   number;
  country?: string;
}

export async function verifyAccessToken(
  request: Request,
  env: { CF_ACCESS_TEAM_DOMAIN: string; CF_ACCESS_AUD: string }
): Promise<CFAccessPayload> {
  console.log('[AUTH] Starting token verification');
  console.log('[AUTH] CF_ACCESS_TEAM_DOMAIN set:', !!env.CF_ACCESS_TEAM_DOMAIN);
  console.log('[AUTH] CF_ACCESS_AUD set:', !!env.CF_ACCESS_AUD);
  console.log('[AUTH] CF_ACCESS_TEAM_DOMAIN value:', env.CF_ACCESS_TEAM_DOMAIN);
  console.log('[AUTH] CF_ACCESS_AUD value:', env.CF_ACCESS_AUD);
  
  let token = request.headers.get('Cf-Access-Jwt-Assertion');
  console.log('[AUTH] Token from header:', !!token);
  
  if (!token) {
    const cookie = request.headers.get('Cookie') ?? '';
    console.log('[AUTH] Cookie header present:', !!cookie);
    console.log('[AUTH] Cookie header length:', cookie.length);
    const match = cookie.match(/CF_Authorization=([^;]+)/);
    console.log('[AUTH] CF_Authorization cookie found:', !!match);
    if (match) {
      token = decodeURIComponent(match[1]);
      console.log('[AUTH] Token decoded from cookie, length:', token.length);
    }
  }
  
  if (!token) {
    console.log('[AUTH] ERROR: No token found in header or cookie');
    throw new Error('Missing CF access token');
  }

  console.log('[AUTH] Token present, attempting JWT verification');
  console.log('[AUTH] JWKS URL:', `${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.CF_ACCESS_TEAM_DOMAIN,
      audience: env.CF_ACCESS_AUD,
    });

    console.log('[AUTH] JWT verification successful');
    console.log('[AUTH] Payload email:', (payload as any).email);
    return payload as unknown as CFAccessPayload;
  } catch (error) {
    console.log('[AUTH] JWT verification failed:', error);
    throw error;
  }
}

export function getLogoutUrl(teamDomain: string): string {
  return `${teamDomain}/cdn-cgi/access/logout`;
}

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
  
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
