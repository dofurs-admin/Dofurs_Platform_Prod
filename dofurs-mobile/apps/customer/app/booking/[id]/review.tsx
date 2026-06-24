import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, Screen, dofursColors, getBookingReview, postBookingReview } from '@dofurs/shared';

export default function PlaceholderScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = Number(params.id ?? NaN);
  const [rating, setRating] = useState('5');
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reviewQuery = useQuery({
    queryKey: ['customer', 'booking', bookingId, 'review'],
    queryFn: () => getBookingReview(bookingId),
    enabled: Number.isFinite(bookingId) && bookingId > 0,
  });

  useEffect(() => {
    const existing = reviewQuery.data?.review as Record<string, unknown> | null | undefined;
    if (!existing) {
      return;
    }

    if (typeof existing.rating === 'number') {
      setRating(String(existing.rating));
    }

    if (typeof existing.review_text === 'string') {
      setReviewText(existing.review_text);
    }
  }, [reviewQuery.data?.review]);

  async function handleSubmitReview() {
    setError(null);

    const parsedRating = Number.parseInt(rating, 10);
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      setError('Rating must be between 1 and 5.');
      return;
    }

    setSaving(true);

    try {
      await postBookingReview(bookingId, {
        rating: parsedRating,
        reviewText: reviewText.trim() || undefined,
      });
      await reviewQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to submit review (${err.status}).`);
      } else {
        setError('Unable to submit review right now.');
      }
    } finally {
      setSaving(false);
    }
  }

  const hasExistingReview = Boolean(reviewQuery.data?.review);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Rate your booking</Text>
        <Text style={styles.subtitle}>Share your experience to help improve future services.</Text>

        {reviewQuery.isLoading ? <Text style={styles.meta}>Loading review status...</Text> : null}

        {reviewQuery.data?.canReview === false ? (
          <Text style={styles.meta}>You can submit a review only after the booking is completed.</Text>
        ) : null}

        <TextInput
          keyboardType="number-pad"
          placeholder="Rating (1-5)"
          placeholderTextColor="#9b8f87"
          style={styles.input}
          value={rating}
          onChangeText={setRating}
          editable={!hasExistingReview}
        />

        <TextInput
          multiline
          numberOfLines={4}
          placeholder="Write your review"
          placeholderTextColor="#9b8f87"
          style={styles.textArea}
          value={reviewText}
          onChangeText={setReviewText}
          editable={!hasExistingReview}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (saving || hasExistingReview || reviewQuery.data?.canReview === false) && styles.buttonDisabled]}
          onPress={handleSubmitReview}
          disabled={saving || hasExistingReview || reviewQuery.data?.canReview === false}
        >
          <Text style={styles.buttonLabel}>
            {hasExistingReview ? 'Review already submitted' : saving ? 'Submitting...' : 'Submit review'}
          </Text>
        </Pressable>
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
    fontSize: 21,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    color: dofursColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
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
  meta: {
    color: '#7d736c',
    fontSize: 12,
  },
  error: {
    color: dofursColors.error,
    fontSize: 12,
  },
  button: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
