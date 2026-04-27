const admin = require('firebase-admin');
const log = require('../observability/logger');

let app;

function getApp() {
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      : process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccount = JSON.parse(raw);
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
