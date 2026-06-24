import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, dofursColors } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const params = useLocalSearchParams<{ id?: string }>();

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Pet passport</Text>
        <Text style={styles.body}>
          Detailed vaccination and passport records for pet #{params.id ?? 'unknown'} are not yet enabled in this mobile build.
        </Text>
        <Text style={styles.meta}>Use the web dashboard for full passport history until the next mobile phase.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 14,
    gap: 8,
  },
  title: {
    color: dofursColors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    color: '#5d5853',
    fontSize: 14,
    lineHeight: 21,
  },
  meta: {
    color: '#7d736c',
    fontSize: 12,
  },
});
