import { verifyAccessToken } from './auth';
import { json } from './json';

export async function isAuthorized(
  request: Request,
  env: { CF_ACCESS_TEAM_DOMAIN: string; CF_ACCESS_AUD: string }
): Promise<boolean> {
  try {
    await verifyAccessToken(request, env);
    return true;
  } catch {
    return false;
  }
}

export function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}

export { json };
