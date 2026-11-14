// Biometric unlock (Face ID / Touch ID / fingerprint) — device-level opt-in
// that gates entry on cold start AFTER a stored session restores. The module
// is lazy-required so an OTA landing on a binary without it degrades to
// "feature unavailable" instead of crashing. The flag lives in AsyncStorage —
// it is a preference, not a credential.

import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bargain.biometric.v1';

type LA = typeof import('expo-local-authentication');
let laMod: LA | null | undefined;

function la(): LA | null {
  if (laMod === undefined) {
    try {
      laMod = require('expo-local-authentication') as LA;
    } catch {
      laMod = null; // native module not linked in this binary
    }
  }
  return laMod ?? null;
}

/** True when the device has biometric hardware AND enrolled credentials. */
export async function biometricAvailable(): Promise<boolean> {
  const m = la();
  if (!m) return false;
  try {
    const [hw, enrolled] = await Promise.all([m.hasHardwareAsync(), m.isEnrolledAsync()]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

/** User-facing label for the enrolled type — "Face ID" / "Touch ID" / generic. */
export async function biometricLabel(): Promise<string> {
  const m = la();
  if (!m) return 'Biometrics';
  try {
    const types = await m.supportedAuthenticationTypesAsync();
    if (types.includes(m.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
    }
    if (types.includes(m.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
  } catch {
    /* fall through to generic */
  }
  return 'Biometrics';
}

export const getBioEnabled = () =>
  AsyncStorage.getItem(KEY)
    .then((v) => v === '1')
    .catch(() => false);

export const setBioEnabled = (on: boolean) =>
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});

/**
 * One system prompt. Returns true on success — and also when the module is
 * absent (never lock a user out because a native dep didn't link).
 */
export async function promptUnlock(): Promise<boolean> {
  const m = la();
  if (!m) return true;
  try {
    const r = await m.authenticateAsync({
      promptMessage: 'Unlock BargainHuntrs',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

/** Post-login opt-in offer — once, only when hardware + enrolment exist. */
export async function offerBioOptIn(): Promise<void> {
  if (await getBioEnabled()) return;
  if (!(await biometricAvailable())) return;
  const label = await biometricLabel();
  Alert.alert(
    `Enable ${label}?`,
    `Unlock BargainHuntrs with ${label} next time you open the app signed in.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: `Enable ${label}`, onPress: () => setBioEnabled(true) },
    ],
  );
}
