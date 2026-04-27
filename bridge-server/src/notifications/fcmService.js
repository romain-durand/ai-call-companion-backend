const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const log = require('../observability/logger');

let app;

function getApp() {
  if (!app) {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const raw = fs.readFileSync(filePath, 'utf8');
      serviceAccount = JSON.parse(raw);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT env var required');
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
