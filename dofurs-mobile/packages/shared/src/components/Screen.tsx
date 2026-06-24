import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { dofursColors } from '../constants/colors';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = false }: ScreenProps) {
  if (scroll) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.base}>
        {children}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: dofursColors.surfaceWarm,
  },
  container: {
    flex: 1,
    backgroundColor: dofursColors.surfaceWarm,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
});
