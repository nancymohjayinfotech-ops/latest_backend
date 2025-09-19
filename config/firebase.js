const admin = require('firebase-admin');
require('dotenv').config({path: './.env'});
const path = require('path');
let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    // Local development: JSON file in root
    if (process.env.NODE_ENV === 'development') {
      const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('Firebase initialized with local JSON file');
    }
    // Production: Base64 env variable
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8')
      );
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('Firebase initialized with Base64 env variable');
    } else {
      console.warn('Firebase not initialized: missing credentials');
      return null;
    }

    return firebaseApp;
  } catch (err) {
    console.error('Error initializing Firebase:', err);
    throw err;
  }
};

const getFirebaseApp = () => {
  if (!firebaseApp) return initializeFirebase();
  return firebaseApp;
};

const getMessaging = () => {
  const app = getFirebaseApp();
  return admin.messaging(app);
};

const isFirebaseInitialized = () => !!firebaseApp;

module.exports = {
  initializeFirebase,
  getFirebaseApp,
  getMessaging,
  isFirebaseInitialized
};
