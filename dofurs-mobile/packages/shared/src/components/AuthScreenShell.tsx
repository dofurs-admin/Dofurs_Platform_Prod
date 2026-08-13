import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dofursColors } from '../constants/colors';
import { Screen } from './Screen';

type AuthScreenShellProps = PropsWithChildren<{
  badge: string;
  title: string;
  subtitle: string;
  highlights?: string[];
  scroll?: boolean;
  panelFill?: boolean;
}>;

export function AuthScreenShell({
  badge,
  title,
  subtitle,
  highlights = ['Verified experts', 'OTP-secured access', 'Transparent pricing'],
  scroll = true,
  panelFill = false,
  children,
}: AuthScreenShellProps) {
  return (
    <Screen scroll={scroll}>
      <View style={styles.heroShell}>
        <View style={styles.heroGlow} />
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
          <View style={styles.highlightsRow}>
            {highlights.map((item) => (
              <View key={item} style={styles.highlightChip}>
                <View style={styles.highlightDot} />
                <Text style={styles.highlightChipLabel}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.panel, panelFill && styles.panelFill]}>{children}</View>
    </Screen>
  );
}

export const authFormStyles = StyleSheet.create({
  sectionEyebrow: {
    color: '#91562b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  sectionSubtitle: {
    color: '#6d5948',
    fontSize: 14,
    lineHeight: 22,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    color: '#57412f',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfc1a5',
    backgroundColor: '#fffdfb',
    color: dofursColors.ink,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    shadowColor: '#a7744d',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  otpInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfc1a5',
    backgroundColor: '#fffdfb',
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 13,
  },
  errorText: {
    color: dofursColors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    color: '#7d6755',
    fontSize: 12,
  },
  primaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ca7d44',
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 13,
    shadowColor: '#b66828',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2c2a4',
    backgroundColor: '#fff9f3',
    paddingVertical: 9,
  },
  secondaryButtonLabel: {
    color: '#68462f',
    fontSize: 13,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  heroShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff6ed',
  },
  heroGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 999,
    top: -100,
    right: -70,
    backgroundColor: '#f8d9be',
    opacity: 0.55,
  },
  hero: {
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e6bd98',
    backgroundColor: '#fff1e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#95582c',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: dofursColors.ink,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  heroSubtitle: {
    color: '#5f4c3e',
    fontSize: 15,
    lineHeight: 23,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fff9f3',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: dofursColors.coral,
  },
  highlightChipLabel: {
    color: '#664f3d',
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    marginTop: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#e3c7ad',
    backgroundColor: '#fffaf5',
    padding: 22,
    gap: 13,
    shadowColor: '#b47a49',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  panelFill: {
    flex: 1,
  },
});
