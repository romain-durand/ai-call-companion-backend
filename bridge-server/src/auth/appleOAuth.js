const { supabaseAdmin } = require('../db/supabaseAdmin');
const log = require('../observability/logger');

/**
 * POST /auth/apple/signin/token
 * Body: { identity_token: string }
 * Reçoit l'identityToken du SDK natif iOS et crée une session Supabase
 */
async function handleAppleSignInToken(req, res) {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', async () => {
    try {
      const { identity_token } = JSON.parse(body);

      if (!identity_token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'identity_token is required' }));
      }

      const { data: { session, user }, error } = await supabaseAdmin.auth.signInWithIdToken({
        provider: 'apple',
        token: identity_token,
      });

      if (error || !session) {
        log.error('apple_signin_error', null, error?.message || 'Failed to create session');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: error?.message || 'Authentication failed' }));
      }

      log.info('apple_signin_success', null, `User ${user.id} authenticated via Apple`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        session: session.access_token,
        refresh: session.refresh_token,
        user: user.id,
      }));
    } catch (err) {
      log.error('apple_signin_error', null, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

module.exports = { handleAppleSignInToken };
