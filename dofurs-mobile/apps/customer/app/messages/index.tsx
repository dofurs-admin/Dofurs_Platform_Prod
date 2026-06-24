import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getMessages } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const messagesQuery = useQuery({
    queryKey: ['customer', 'messages'],
    queryFn: () => getMessages({ limit: 30, offset: 0 }),
  });

  const messages = messagesQuery.data?.messages ?? [];

  return (
    <Screen scroll>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Conversation updates from Dofurs support and providers.</Text>

      {messagesQuery.isLoading ? <Text style={styles.meta}>Loading messages...</Text> : null}

      {messagesQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load messages right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => messagesQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {messages.map((message, index) => {
        const row = message as Record<string, unknown>;
        const title = typeof row.title === 'string' ? row.title : (typeof row.subject === 'string' ? row.subject : 'Message');
        const body = typeof row.body === 'string' ? row.body : (typeof row.message === 'string' ? row.message : 'No preview available');
        const createdAt = typeof row.created_at === 'string' ? row.created_at : '';

        return (
          <View key={`${createdAt}-${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Text style={styles.meta}>{createdAt ? new Date(createdAt).toLocaleString() : 'Recent'}</Text>
          </View>
        );
      })}

      {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 ? (
        <Text style={styles.meta}>No messages yet.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: '#4f4b47',
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: '#5d5853',
    fontSize: 13,
    lineHeight: 20,
  },
  meta: {
    color: '#7d736c',
    fontSize: 12,
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1b5a8',
    backgroundColor: '#fff2ef',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#a6483b',
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});
