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
      // Try programmatic construction from individual env vars (most reliable)
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        try {
          serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID || '',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || '',
            universe_domain: 'googleapis.com'
          };
          log.info('fcm_config', null, 'Loaded Firebase config from individual env vars');
        } catch (envErr) {
          log.error('fcm_env_error', null, `Failed to construct from env vars: ${envErr.message}`);
          throw envErr;
        }
      } else {
        // Try base64-encoded env var as fallback
        const envB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
        if (envB64) {
          try {
            log.info('fcm_config', null, `Base64 env var length: ${envB64.length}`);
            const decoded = Buffer.from(envB64, 'base64').toString('utf8');
            log.info('fcm_config', null, `Decoded JSON length: ${decoded.length}`);
            serviceAccount = JSON.parse(decoded);
            const keyLength = serviceAccount.private_key.length;
            const keyStart = serviceAccount.private_key.substring(0, 50);
            const keyEnd = serviceAccount.private_key.substring(Math.max(0, keyLength - 50));
            log.info('fcm_config', null, `Private key length: ${keyLength}`);
            log.info('fcm_config', null, `Loaded Firebase config from base64 env var. Key starts with: ${keyStart}... Key ends with: ...${keyEnd}`);
            log.info('fcm_config', null, `Full private key: ${serviceAccount.private_key}`);
          } catch (b64Err) {
            log.error('fcm_b64_error', null, b64Err.message);
            throw b64Err;
          }
        } else {
          const envJson = process.env.FIREBASE_SERVICE_ACCOUNT;
          if (!envJson) {
            throw new Error('FIREBASE_PROJECT_ID + FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL, or FIREBASE_SERVICE_ACCOUNT_B64, or FIREBASE_SERVICE_ACCOUNT, or file required');
          }
          log.info('fcm_config', null, `Using raw env var (length: ${envJson.length})`);
          serviceAccount = JSON.parse(envJson);
        }
      }
    }

    try {
      app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      log.info('fcm_config', null, 'Firebase Admin SDK initialized successfully');
    } catch (initErr) {
      log.error('fcm_init_error', null, `Firebase init failed: ${initErr.message}`);
      throw initErr;
    }
  }
  return app;
}

async function sendPushNotification({ token, title, body, data = {}, profileId = null }) {
  try {
    const messaging = getApp().messaging();
    const result = await messaging.send({ token, notification: { title, body }, data });
    log.info('fcm_sent', null, `Message sent: ${result}`);
    return { success: true, messageId: result };
  } catch (err) {
    log.error('fcm_error', null, `Token error: ${err.message}`);

    // Auto-cleanup: if token is invalid, delete it from database
    if (profileId && (err.message.includes('registration token is invalid') ||
                      err.message.includes('Invalid registration token') ||
                      err.message.includes('Third party auth error'))) {
      try {
        const { supabaseAdmin } = require('../db/supabaseAdmin');
        await supabaseAdmin.from('device_tokens').delete().eq('token', token);
        log.info('fcm_cleanup', null, `Deleted invalid token for profile ${profileId}`);
      } catch (cleanupErr) {
        log.error('fcm_cleanup_error', null, cleanupErr.message);
      }
    }

    return { success: false, error: err.message };
  }
}

module.exports = { sendPushNotification };
