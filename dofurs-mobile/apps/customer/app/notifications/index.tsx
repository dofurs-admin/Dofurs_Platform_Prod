import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getNotifications, markAllNotificationsRead } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const notificationsQuery = useQuery({
    queryKey: ['customer', 'notifications'],
    queryFn: () => getNotifications({ limit: 30, offset: 0 }),
  });

  const notifications = notificationsQuery.data?.notifications ?? [];

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    await notificationsQuery.refetch();
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Important booking and account updates.</Text>

      <Pressable style={styles.markAllButton} onPress={handleMarkAllRead}>
        <Text style={styles.markAllButtonLabel}>Mark all as read</Text>
      </Pressable>

      {notificationsQuery.isLoading ? <Text style={styles.meta}>Loading notifications...</Text> : null}

      {notificationsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load notifications right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => notificationsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {notifications.map((notification, index) => {
        const row = notification as Record<string, unknown>;
        const title = typeof row.title === 'string' ? row.title : 'Notification';
        const body = typeof row.body === 'string' ? row.body : (typeof row.message === 'string' ? row.message : 'No details available');
        const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
        const isRead = Boolean(row.read_at || row.is_read);

        return (
          <View key={`${createdAt}-${index}`} style={[styles.card, isRead && styles.readCard]}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Text style={styles.meta}>{createdAt ? new Date(createdAt).toLocaleString() : 'Recent'}</Text>
          </View>
        );
      })}

      {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 ? (
        <Text style={styles.meta}>No notifications yet.</Text>
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
  markAllButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markAllButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 6,
  },
  readCard: {
    opacity: 0.7,
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
