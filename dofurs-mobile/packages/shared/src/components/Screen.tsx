import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dofursColors } from '../constants/colors';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ children, scroll = false, refreshing = false, onRefresh }: ScreenProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.surface} edges={['top', 'right', 'left']}>
        <View style={[styles.glowOrb, styles.glowOrbTop, styles.ignorePointer]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom, styles.ignorePointer]} />
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={dofursColors.coral}
                  colors={[dofursColors.coral]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top', 'right', 'left']}>
      <View style={[styles.glowOrb, styles.glowOrbTop, styles.ignorePointer]} />
      <View style={[styles.glowOrb, styles.glowOrbBottom, styles.ignorePointer]} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.container}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: '#fff9f2',
  },
  scrollView: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 16,
  },
  glowOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    opacity: 0.36,
  },
  glowOrbTop: {
    top: -130,
    left: -90,
    backgroundColor: '#f6d8ba',
  },
  glowOrbBottom: {
    bottom: -150,
    right: -90,
    backgroundColor: '#efddcb',
  },
  ignorePointer: {
    pointerEvents: 'none',
  },
});
