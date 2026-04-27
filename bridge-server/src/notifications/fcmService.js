const admin = require('firebase-admin');
const fs = require('fs');
const log = require('../observability/logger');

let app;

function getApp() {
  if (!app) {
    let serviceAccount;

    try {
      const filePath = '/app/bridge-server/firebase-service-account.json';
      const raw = fs.readFileSync(filePath, 'utf8');
      serviceAccount = JSON.parse(raw);
      log.info('fcm_config', null, 'Loaded Firebase config from file');
    } catch (err) {
      const envJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!envJson) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT env var or file /app/bridge-server/firebase-service-account.json required');
      }
      log.info('fcm_config', null, `Env var length: ${envJson.length}, first 100 chars: ${envJson.substring(0, 100)}`);
      try {
        serviceAccount = JSON.parse(envJson);
      } catch (parseErr) {
        log.error('fcm_parse_error', null, `Failed to parse JSON: ${parseErr.message}, trying to fix...`);
        // Try removing BOM or other invisible characters
        const cleaned = envJson.trim();
        serviceAccount = JSON.parse(cleaned);
      }
    }

    app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return app;
}

async function sendPushNotification({ token, title, body, data = {} }) {
  try {
    const messaging = getApp().messaging();
    const result = await messaging.send({ token, notification: { title, body }, data });
    log.info('fcm_sent', null, `Message sent: ${result}`);
    return { success: true, messageId: result };
  } catch (err) {
    log.error('fcm_error', null, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendPushNotification };
