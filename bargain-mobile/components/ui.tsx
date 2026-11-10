// Shared native UI kit — one file, many surfaces. Every screen composes
// these primitives; nothing here is screen-specific.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// ---- layout ---------------------------------------------------------------

export function Screen({
  children,
  edges = ['top'],
  style,
}: {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/**
 * The brand mark — the site's logo.svg: emerald tile carrying a dark
 * "B ⚡ H" lockup (BargainHuntrs). Composed as text + flash icon so it
 * renders at any size without an image asset.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.22 },
      ]}
    >
      <View style={styles.markRow}>
        <Text style={[styles.markText, { fontSize: size * 0.34 }]}>B</Text>
        <Ionicons
          name="flash"
          size={size * 0.3}
          color={colors.brandInk}
          style={{ marginHorizontal: -size * 0.015 }}
        />
        <Text style={[styles.markText, { fontSize: size * 0.34 }]}>H</Text>
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// ---- controls -------------------------------------------------------------

type BtnTone = 'primary' | 'ghost' | 'danger';

export function Btn({
  title,
  onPress,
  tone = 'primary',
  loading = false,
  disabled = false,
  small = false,
}: {
  title: string;
  onPress: () => void;
  tone?: BtnTone;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        tone === 'primary' && styles.btnPrimary,
        tone === 'ghost' && styles.btnGhost,
        tone === 'danger' && styles.btnDanger,
        (pressed || off) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={tone === 'primary' ? colors.brandInk : tone === 'ghost' ? colors.brandLight : colors.danger}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            small && styles.btnTextSmall,
            tone === 'primary' && { color: colors.brandInk },
            tone === 'ghost' && { color: colors.brandLight },
            tone === 'danger' && { color: colors.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Labeled input — always sets light text + muted placeholder on the dark
 *  surface (the portfolio hard rule: unstyled TextInput renders black text). */
export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[styles.field, props.style]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ---- display --------------------------------------------------------------

type ChipTone = 'brand' | 'success' | 'warning' | 'danger' | 'muted';

export function Chip({
  label,
  tone = 'muted',
  onPress,
  active = false,
}: {
  label: string;
  tone?: ChipTone;
  onPress?: () => void;
  active?: boolean;
}) {
  const map = {
    brand: { bg: colors.brandTint, fg: colors.brandLight },
    success: { bg: colors.successTint, fg: colors.success },
    warning: { bg: colors.warningTint, fg: colors.warning },
    danger: { bg: colors.dangerTint, fg: colors.danger },
    muted: { bg: colors.cardSoft, fg: colors.muted },
  }[tone];
  const body = (
    <View
      style={[
        styles.chip,
        { backgroundColor: map.bg },
        onPress && styles.chipPress,
        onPress && active && { backgroundColor: colors.brandTint, borderColor: 'rgba(52,211,153,0.5)' },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: map.fg },
          onPress && active && { color: colors.brandLight },
        ]}
      >
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      {body}
    </Pressable>
  );
}

export function Empty({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <BrandMark size={52} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
      {action ? <View style={{ marginTop: 18 }}>{action}</View> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---- styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mark: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRow: { flexDirection: 'row', alignItems: 'center' },
  markText: { color: colors.brandInk, fontWeight: '900', includeFontPadding: false },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 22,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10 },
  btnPrimary: { backgroundColor: colors.brand },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  btnText: { color: colors.brandInk, fontSize: 15, fontWeight: '800' },
  btnTextSmall: { fontSize: 13 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  field: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  fieldHint: { color: colors.faint, fontSize: 11, marginTop: 5 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  chipPress: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 28 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 },
});
