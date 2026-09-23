// Firebase Cloud Messaging (web push notifications) + Phone Auth
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let messaging: ReturnType<typeof getMessaging> | null = null;

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

export async function initMessaging() {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  const app = getFirebaseApp();
  messaging = getMessaging(app);
  return messaging;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return await Notification.requestPermission();
}

export async function getFCMToken(): Promise<string | null> {
  if (!messaging) {
    await initMessaging();
  }
  if (!messaging) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
    });
    return token;
  } catch (err) {
    console.error("Failed to get FCM token:", err);
    return null;
  }
}

export function onMessageListener(callback: (payload: any) => void) {
  if (!messaging) return;
  onMessage(messaging, callback);
}

export { vapidKey };

// ── Phone Authentication ────────────────────────────────────────────────────

let authInstance: Auth | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getFirebaseApp());
  return authInstance;
}

/** Send an SMS verification code to `phone` (E.164). Renders an invisible reCAPTCHA on `elementId`. */
export async function sendPhoneCode(phone: string, elementId: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, elementId, { size: "invisible" });
  confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
}

/** Confirm the SMS code. Returns a Firebase ID token to send to our API. */
export async function confirmPhoneCode(code: string): Promise<string> {
  if (!confirmationResult) throw new Error("No verification in progress — request a new code");
  const cred = await confirmationResult.confirm(code);
  const idToken = await cred.user.getIdToken();
  return idToken;
}

export function resetPhoneAuth() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  confirmationResult = null;
}
