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
      // Try base64-encoded env var first (more reliable with Coolify)
      const envB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
      if (envB64) {
        try {
          const decoded = Buffer.from(envB64, 'base64').toString('utf8');
          serviceAccount = JSON.parse(decoded);
          log.info('fcm_config', null, 'Loaded Firebase config from base64 env var');
        } catch (b64Err) {
          log.error('fcm_b64_error', null, b64Err.message);
          throw b64Err;
        }
      } else {
        const envJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!envJson) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_B64, FIREBASE_SERVICE_ACCOUNT, or file required');
        }
        log.info('fcm_config', null, `Using raw env var (length: ${envJson.length})`);
        serviceAccount = JSON.parse(envJson);
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
