import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { dofursColors } from '../constants/colors';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = false }: ScreenProps) {
  if (scroll) {
    return (
      <View style={styles.surface}>
        <View style={[styles.glowOrb, styles.glowOrbTop, styles.ignorePointer]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom, styles.ignorePointer]} />
        <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.scrollView}>
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.surface}>
      <View style={[styles.glowOrb, styles.glowOrbTop, styles.ignorePointer]} />
      <View style={[styles.glowOrb, styles.glowOrbBottom, styles.ignorePointer]} />
      <View style={styles.container}>{children}</View>
    </View>
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
