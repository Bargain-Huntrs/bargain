// Profile — account card, name + nickname edit (PUT /api/v1/auth/me), niche
// alert preferences (GET/PUT /api/v1/auth/me/niches — the same subscriptions
// that drive the site's deal digests), sign-out.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import {
  deleteMe,
  fetchNiches,
  updateMe,
  updateNiches,
  type Niche,
} from '../../services/api';
import {
  biometricAvailable,
  biometricLabel,
  getBioEnabled,
  promptUnlock,
  setBioEnabled,
} from '../../services/biometrics';
import {
  fetchNotificationPrefs,
  registerDevicePush,
  sendTestPush,
  unregisterDevicePush,
} from '../../services/push';
import { hapticOk, hapticWarn } from '../../services/haptics';
import { useAuth } from '../../contexts/AuthContext';
import { Btn, Chip, Divider, Empty, Field, Screen, SectionTitle } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function Profile() {
  const router = useRouter();
  const { status, user, freshToken, signOut, reloadUser } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const [niches, setNiches] = useState<Niche[]>([]);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [nicheBusy, setNicheBusy] = useState(false);
  const [nicheErr, setNicheErr] = useState('');

  // Biometric unlock preference — only offered on devices with enrolled
  // biometrics (and binaries that actually link the native module).
  const [bioLabel, setBioLabel] = useState('');
  const [bioOn, setBioOn] = useState(false);

  // Push deal alerts — state comes from the server-side pref on the user row.
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setNickname(user.nickname || '');
    setSubscribed(user.subscribedNiches || []);
  }, [user]);

  const loadNiches = useCallback(async () => {
    if (status !== 'authed') return;
    try {
      const t = await freshToken();
      if (!t) return;
      const res = await fetchNiches(t);
      setNiches(res.available_niches || []);
      setSubscribed(res.subscribed_niches || []);
    } catch {
      /* niches section is optional — leave it empty on failure */
    }
  }, [status, freshToken]);

  useEffect(() => {
    loadNiches();
  }, [loadNiches]);

  // Load biometric capability + server-side push pref once authed.
  useEffect(() => {
    if (status !== 'authed') return;
    (async () => {
      if (!(await biometricAvailable())) return;
      const [label, on] = await Promise.all([biometricLabel(), getBioEnabled()]);
      setBioLabel(label);
      setBioOn(on);
    })();
    (async () => {
      try {
        const t = await freshToken();
        if (!t) return;
        const prefs = await fetchNotificationPrefs(t);
        setPushOn(Boolean(prefs.push_notifications));
      } catch {
        /* prefs unreadable — hide the push row entirely */
      }
    })();
  }, [status, freshToken]);

  const toggleBio = async (on: boolean) => {
    if (on) {
      if (!(await promptUnlock())) return; // verify once before arming the gate
      await setBioEnabled(true);
      setBioOn(true);
      hapticOk();
    } else {
      await setBioEnabled(false);
      setBioOn(false);
    }
  };

  const togglePush = async (on: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMsg('');
    try {
      const t = await freshToken();
      if (!t) throw new Error('Session expired — sign in again.');
      if (on) {
        await registerDevicePush(t);
        setPushOn(true);
        hapticOk();
        setPushMsg('Deal alerts are on.');
      } else {
        await unregisterDevicePush(t);
        setPushOn(false);
        hapticWarn();
        setPushMsg('Deal alerts are off.');
      }
    } catch (e: any) {
      setPushMsg(e?.message || 'Could not update push alerts.');
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMsg('');
    try {
      const t = await freshToken();
      if (!t) throw new Error('Session expired — sign in again.');
      await sendTestPush(t);
      setPushMsg('Test push sent — check your notification shade.');
    } catch (e: any) {
      setPushMsg(e?.message || 'Test push failed.');
    } finally {
      setPushBusy(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaveErr('');
    setSaved(false);
    setSaving(true);
    try {
      const t = await freshToken();
      if (!t) throw new Error('Session expired — sign in again.');
      await updateMe(t, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        nickname: nickname.trim() ? nickname.trim() : null,
      });
      await reloadUser();
      setSaved(true);
    } catch (e: any) {
      setSaveErr(e?.message || 'Save failed — try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleNiche = async (key: string) => {
    if (nicheBusy) return;
    const next = subscribed.includes(key)
      ? subscribed.filter((k) => k !== key)
      : [...subscribed, key];
    setSubscribed(next);
    setNicheErr('');
    setNicheBusy(true);
    try {
      const t = await freshToken();
      if (!t) throw new Error('Session expired — sign in again.');
      await updateNiches(t, next);
    } catch (e: any) {
      setSubscribed(subscribed); // revert
      setNicheErr(e?.message || 'Could not update niches.');
    } finally {
      setNicheBusy(false);
    }
  };

  const doSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  /**
   * In-app account deletion (Play/Apple requirement — the web twin lives at
   * bargainhuntrs.com/delete-account). Native confirm first; the call then
   * tombstones the account server-side and every session dies with it, so
   * a 2xx always means clear-local + back to login.
   */
  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your BargainHuntrs account. Your sign-in, profile, watchlist, saved deals, alerts, and preferences are removed, any subscription is cancelled, and all notifications stop. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => void performDelete(),
        },
      ],
    );
  };

  const performDelete = async () => {
    if (delBusy) return;
    setDelErr('');
    setDelBusy(true);
    try {
      const t = await freshToken();
      if (!t) throw new Error('Session expired — sign in again.');
      await deleteMe(t);
      await signOut();
      Alert.alert('Account deleted', 'Your account and personal data have been removed.');
      router.replace('/login');
    } catch (e: any) {
      setDelErr(
        `${e?.message || 'Delete failed — try again.'} You can also delete at bargainhuntrs.com/delete-account.`,
      );
    } finally {
      setDelBusy(false);
    }
  };

  if (status !== 'authed' || !user) {
    return (
      <Screen>
        <View style={styles.center}>
          <Empty
            title="Your BargainHuntrs profile"
            sub="Sign in to manage your account, deal-alert niches, and watchlist."
            action={<Btn title="Sign in / Create account" small onPress={() => router.push('/login')} />}
          />
          <Pressable
            onPress={() => Linking.openURL('https://bargainhuntrs.com/delete-account').catch(() => {})}
            hitSlop={6}
          >
            <Text style={styles.deleteLink}>Delete an account? bargainhuntrs.com/delete-account</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const display =
    user.nickname || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Hunter';
  const initial = display.trim().charAt(0).toUpperCase();
  const tier = (user.subscriptionTier || 'free').toLowerCase();

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.name}>{display}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.heroChips}>
              <Chip label={tier === 'free' ? 'Free plan' : `${tier} plan`} tone="brand" />
              <Chip
                label={user.emailVerified ? 'Email verified' : 'Email unverified'}
                tone={user.emailVerified ? 'success' : 'warning'}
              />
              {user.phoneVerified ? <Chip label="Phone verified" tone="success" /> : null}
            </View>
          </View>

          {/* ---- deal-alert niches ---- */}
          <SectionTitle>Deal-alert niches</SectionTitle>
          <Text style={styles.nicheSub}>
            Pick the categories you hunt — drives your deal feed filters and email digests.
            Empty means everything.
          </Text>
          {niches.length > 0 ? (
            <View style={styles.nicheWrap}>
              {niches.map((n) => {
                const on = subscribed.includes(n.key);
                return (
                  <Chip
                    key={n.key}
                    label={`${n.emoji ? n.emoji + ' ' : ''}${n.name}`}
                    onPress={() => toggleNiche(n.key)}
                    active={on}
                  />
                );
              })}
            </View>
          ) : (
            <ActivityIndicator color={colors.brandLight} style={{ marginVertical: 8 }} />
          )}
          {nicheErr ? <Text style={styles.errText}>{nicheErr}</Text> : null}

          {/* ---- security & device alerts ---- */}
          {bioLabel || pushOn !== null ? <SectionTitle>Security & alerts</SectionTitle> : null}
          {bioLabel ? (
            <View style={styles.setRow}>
              <Ionicons name="finger-print-outline" size={22} color={colors.brandLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.setRowTitle}>{bioLabel} unlock</Text>
                <Text style={styles.setRowSub}>
                  Require {bioLabel} when you open BargainHuntrs signed in.
                </Text>
              </View>
              <Switch
                value={bioOn}
                onValueChange={toggleBio}
                trackColor={{ false: colors.cardSoft, true: colors.brand }}
                thumbColor="#fff"
              />
            </View>
          ) : null}
          {pushOn !== null ? (
            <>
              <View style={styles.setRow}>
                <Ionicons name="notifications-outline" size={22} color={colors.brandLight} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.setRowTitle}>Push deal alerts</Text>
                  <Text style={styles.setRowSub}>
                    New deals for your niches, pushed to this device.
                  </Text>
                </View>
                {pushBusy ? (
                  <ActivityIndicator color={colors.brandLight} size="small" />
                ) : (
                  <Switch
                    value={pushOn}
                    onValueChange={togglePush}
                    trackColor={{ false: colors.cardSoft, true: colors.brand }}
                    thumbColor="#fff"
                  />
                )}
              </View>
              {pushOn ? (
                <Pressable onPress={testPush} hitSlop={8} style={styles.testPush}>
                  <Text style={styles.testPushText}>Send a test push</Text>
                </Pressable>
              ) : null}
              {pushMsg ? <Text style={styles.pushMsg}>{pushMsg}</Text> : null}
            </>
          ) : null}

          {/* ---- edit profile ---- */}
          <SectionTitle>Profile</SectionTitle>
          <Field label="First name" value={firstName} onChangeText={setFirstName} maxLength={100} />
          <Field label="Last name" value={lastName} onChangeText={setLastName} maxLength={100} />
          <Field
            label="Nickname (public)"
            value={nickname}
            onChangeText={setNickname}
            placeholder="Shown on the community feed"
            maxLength={60}
            autoCapitalize="none"
          />
          {saveErr ? <Text style={styles.errText}>{saveErr}</Text> : null}
          {saved ? <Text style={styles.savedText}>Saved.</Text> : null}
          <Btn title="Save profile" onPress={save} loading={saving} />

          <Divider />

          <Btn title="Sign out" tone="ghost" onPress={doSignOut} />

          {/* ---- danger zone ---- */}
          <SectionTitle>Danger zone</SectionTitle>
          <Text style={styles.dangerSub}>
            Permanently delete your account and personal data — sign-in, profile, watchlist,
            saved deals, and alerts. Cannot be undone.
          </Text>
          {delErr ? <Text style={styles.errText}>{delErr}</Text> : null}
          <Btn title="Delete account" tone="danger" onPress={confirmDelete} loading={delBusy} />

          <Text style={styles.footer}>
            BargainHuntrs {Constants.expoConfig?.version || ''} · Powered by SI
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.brandInk, fontSize: 30, fontWeight: '800' },
  name: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 },
  email: { color: colors.muted, fontSize: 13, marginTop: 4 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
  nicheSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  nicheWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  setRowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  setRowSub: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 3 },
  testPush: { alignSelf: 'flex-start', marginBottom: 6, marginLeft: 4 },
  testPushText: { color: colors.brandLight, fontSize: 13, fontWeight: '700' },
  pushMsg: { color: colors.muted, fontSize: 12, marginBottom: 10, marginLeft: 4 },
  errText: { color: colors.danger, fontSize: 13, marginTop: 10 },
  dangerSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  deleteLink: { color: colors.muted, fontSize: 12, marginTop: 18, textDecorationLine: 'underline' },
  savedText: { color: colors.success, fontSize: 13, marginBottom: 12, fontWeight: '600' },
  footer: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: 32 },
});
