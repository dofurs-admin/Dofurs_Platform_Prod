import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  dofursColors,
  getProviderReviews,
  respondProviderReview,
} from '@dofurs/shared';

type ProviderReviewRow = {
  id: string;
  rating: number | null;
  reviewText: string | null;
  providerResponse: string | null;
  createdAt: string | null;
};

function toProviderReviewRow(value: Record<string, unknown>): ProviderReviewRow | null {
  const idValue = value.id;
  const id = typeof idValue === 'string' ? idValue : (typeof idValue === 'number' ? String(idValue) : null);

  if (!id) {
    return null;
  }

  return {
    id,
    rating: typeof value.rating === 'number' ? value.rating : null,
    reviewText: typeof value.review_text === 'string' ? value.review_text : null,
    providerResponse: typeof value.provider_response === 'string' ? value.provider_response : null,
    createdAt: typeof value.created_at === 'string' ? value.created_at : null,
  };
}

function renderStars(rating: number | null) {
  if (!rating || rating < 1) {
    return 'No rating';
  }

  const normalized = Math.min(5, Math.max(1, Math.round(rating)));
  return `${'★'.repeat(normalized)}${'☆'.repeat(5 - normalized)}`;
}

export default function ProviderReviewsScreen() {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ['provider', 'reviews', ratingFilter],
    queryFn: () => getProviderReviews({ page: 1, pageSize: 30, rating: ratingFilter ?? undefined }),
  });

  const reviews = useMemo(() => {
    const payload = reviewsQuery.data as Record<string, unknown> | undefined;
    const rows = Array.isArray(payload?.reviews)
      ? payload.reviews
      : (Array.isArray(payload?.items) ? payload.items : []);

    return rows
      .map((row) => toProviderReviewRow(row as Record<string, unknown>))
      .filter((row): row is ProviderReviewRow => Boolean(row));
  }, [reviewsQuery.data]);

  async function handleRespond(reviewId: string) {
    setError(null);
    const responseText = drafts[reviewId]?.trim() ?? '';

    if (responseText.length < 3) {
      setError('Response should be at least 3 characters.');
      return;
    }

    setSubmittingId(reviewId);

    try {
      await respondProviderReview(reviewId, responseText);
      setDrafts((previous) => ({ ...previous, [reviewId]: '' }));
      await reviewsQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to submit response (${err.status}).`);
      } else {
        setError('Unable to submit response right now.');
      }
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Reviews</Text>
      <Text style={styles.subtitle}>Read customer feedback and post professional replies.</Text>

      <View style={styles.filterRow}>
        {[null, 5, 4, 3, 2, 1].map((rating) => {
          const selected = ratingFilter === rating;
          return (
            <Pressable
              key={String(rating)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              onPress={() => setRatingFilter(rating)}
            >
              <Text style={[styles.filterChipLabel, selected && styles.filterChipLabelSelected]}>
                {rating == null ? 'All' : `${rating} star`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {reviewsQuery.isLoading ? <Text style={styles.meta}>Loading reviews...</Text> : null}

      {reviewsQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load reviews right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => reviewsQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {reviews.map((review) => (
        <View key={review.id} style={styles.card}>
          <Text style={styles.cardRating}>{renderStars(review.rating)}</Text>
          <Text style={styles.cardBody}>{review.reviewText ?? 'No written feedback provided.'}</Text>
          <Text style={styles.meta}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : 'Recent'}</Text>

          {review.providerResponse ? (
            <View style={styles.responseBox}>
              <Text style={styles.responseLabel}>Your response</Text>
              <Text style={styles.responseText}>{review.providerResponse}</Text>
            </View>
          ) : null}

          <TextInput
            multiline
            numberOfLines={3}
            style={styles.input}
            placeholder="Write response"
            placeholderTextColor="#9b8f87"
            value={drafts[review.id] ?? ''}
            onChangeText={(value) => setDrafts((previous) => ({ ...previous, [review.id]: value }))}
          />

          <Pressable
            style={[styles.button, submittingId === review.id && styles.buttonDisabled]}
            onPress={() => handleRespond(review.id)}
            disabled={submittingId === review.id}
          >
            <Text style={styles.buttonLabel}>{submittingId === review.id ? 'Posting...' : 'Post response'}</Text>
          </Pressable>
        </View>
      ))}

      {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length === 0 ? (
        <Text style={styles.meta}>No reviews found for this filter.</Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: '#4f4b47',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipSelected: {
    borderColor: dofursColors.coral,
    backgroundColor: '#fff2e7',
  },
  filterChipLabel: {
    color: '#5d5853',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipLabelSelected: {
    color: dofursColors.ink,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 6,
  },
  cardRating: {
    color: '#b86a2d',
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    color: '#4f4b47',
    fontSize: 13,
    lineHeight: 19,
  },
  meta: {
    color: '#7d736c',
    fontSize: 12,
  },
  input: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  responseBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    padding: 8,
    gap: 3,
  },
  responseLabel: {
    color: '#6d635c',
    fontSize: 12,
    fontWeight: '700',
  },
  responseText: {
    color: dofursColors.ink,
    fontSize: 13,
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
