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
  let token = request.headers.get('Cf-Access-Jwt-Assertion');
  
  if (!token) {
    const cookie = request.headers.get('Cookie') ?? '';
    const match = cookie.match(/CF_Authorization=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }
  
  if (!token) {
    throw new Error('Missing CF access token');
  }

  const JWKS = createRemoteJWKSet(
    new URL(`${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
  );

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: env.CF_ACCESS_TEAM_DOMAIN,
    audience: env.CF_ACCESS_AUD,
  });

  return payload as unknown as CFAccessPayload;
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
