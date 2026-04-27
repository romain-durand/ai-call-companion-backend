const { supabaseAdmin } = require('../db/supabaseAdmin');
const { upsertDeviceToken, getTokensForProfile } = require('../db/deviceTokensRepo');
const { sendPushNotification } = require('./fcmService');
const log = require('../observability/logger');

async function handleRegisterDevice(req, res) {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', async () => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
      if (authErr || !user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }

      const { token, platform } = JSON.parse(body);
      if (!token || !platform) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'token and platform are required' }));
      }

      await upsertDeviceToken(user.id, token, platform);
      log.info('device_token_registered', null, `Token registered for user ${user.id} (${platform})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      log.error('register_device_error', null, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function handleNotifyTest(req, res) {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', async () => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const debugSecret = process.env.DEBUG_SECRET;
      const expected = `Bearer ${debugSecret}`;

      if (!debugSecret || authHeader !== expected) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }

      const { profile_id, title, body: msgBody } = JSON.parse(body);
      if (!profile_id || !title || !msgBody) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'profile_id, title, and body are required' }));
      }

      const tokens = await getTokensForProfile(profile_id);

      if (tokens.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'No device tokens found for this profile' }));
      }

      const results = await Promise.all(
        tokens.map(({ token }) => sendPushNotification({ token, title, body: msgBody, profileId: profile_id }))
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));
    } catch (err) {
      log.error('notify_test_error', null, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

module.exports = { handleRegisterDevice, handleNotifyTest };
