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
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  deleteMe,
  fetchNiches,
  updateMe,
  updateNiches,
  type Niche,
} from '../../services/api';
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
  errText: { color: colors.danger, fontSize: 13, marginTop: 10 },
  dangerSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  deleteLink: { color: colors.muted, fontSize: 12, marginTop: 18, textDecorationLine: 'underline' },
  savedText: { color: colors.success, fontSize: 13, marginBottom: 12, fontWeight: '600' },
  footer: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: 32 },
});
