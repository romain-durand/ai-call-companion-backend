const admin = require('firebase-admin');
const log = require('../observability/logger');

let app;

function getApp() {
  if (!app) {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var required');
    }
    const serviceAccount = JSON.parse(rawJson);
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
