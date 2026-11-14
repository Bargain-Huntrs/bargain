// Haptic feedback — expo-haptics, lazy-required so an OTA landing on a
// binary built before the module was added degrades to silent no-ops
// instead of crashing on import (same rule as services/biometrics.ts).

type HapticsModule = typeof import('expo-haptics');
let mod: HapticsModule | null | undefined;

function haptics(): HapticsModule | null {
  if (mod === undefined) {
    try {
      mod = require('expo-haptics') as HapticsModule;
    } catch {
      mod = null; // native module not linked in this binary
    }
  }
  return mod ?? null;
}

/** Light tick — selection changes, card taps, chip toggles. */
export async function hapticTap(): Promise<void> {
  try {
    await haptics()?.selectionAsync();
  } catch {
    /* no-op */
  }
}

/** Success pulse — a tracked item saved, a preference persisted. */
export async function hapticOk(): Promise<void> {
  const m = haptics();
  if (!m) return;
  try {
    await m.notificationAsync(m.NotificationFeedbackType.Success);
  } catch {
    /* no-op */
  }
}

/** Warning buzz — destructive or failed actions. */
export async function hapticWarn(): Promise<void> {
  const m = haptics();
  if (!m) return;
  try {
    await m.notificationAsync(m.NotificationFeedbackType.Warning);
  } catch {
    /* no-op */
  }
}
