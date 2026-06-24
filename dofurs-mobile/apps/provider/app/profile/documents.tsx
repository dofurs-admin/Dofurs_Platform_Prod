import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  Screen,
  createProviderDocument,
  dofursColors,
  getProviderDocuments,
} from '@dofurs/shared';

export default function PlaceholderScreen() {
  const router = useRouter();
  const documentsQuery = useQuery({
    queryKey: ['provider', 'documents'],
    queryFn: getProviderDocuments,
  });

  const [documentType, setDocumentType] = useState('license');
  const [documentUrl, setDocumentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);

    if (documentType.trim().length < 2) {
      setError('Document type is required.');
      return;
    }

    if (!/^https?:\/\//i.test(documentUrl.trim())) {
      setError('Document URL must start with http:// or https://');
      return;
    }

    setSubmitting(true);

    try {
      await createProviderDocument({
        document_type: documentType.trim(),
        document_url: documentUrl.trim(),
      });

      setDocumentUrl('');
      await documentsQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details as { error?: string } | null;
        setError(detail?.error ?? `Unable to save document (${err.status}).`);
      } else {
        setError('Unable to save document right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const documents = documentsQuery.data?.documents ?? [];

  return (
    <Screen scroll>
      <Text style={styles.title}>Documents</Text>
      <Text style={styles.subtitle}>Register compliance and verification document links.</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={documentType}
          onChangeText={setDocumentType}
          placeholder="Document type"
          placeholderTextColor="#9b8f87"
        />

        <TextInput
          style={styles.input}
          value={documentUrl}
          onChangeText={setDocumentUrl}
          placeholder="Document URL"
          placeholderTextColor="#9b8f87"
        />

        <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleCreate} disabled={submitting}>
          <Text style={styles.primaryButtonLabel}>{submitting ? 'Saving...' : 'Add document'}</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {documentsQuery.isLoading ? <Text style={styles.meta}>Loading documents...</Text> : null}

      {documents.map((document, index) => {
        const row = document as Record<string, unknown>;
        const id = typeof row.id === 'string' ? row.id : `doc-${index}`;
        const type = typeof row.document_type === 'string' ? row.document_type : 'Document';
        const status = typeof row.verification_status === 'string' ? row.verification_status : 'pending';
        const url = typeof row.document_url === 'string' ? row.document_url : '';
        const createdAt = typeof row.created_at === 'string' ? row.created_at : '';

        return (
          <View key={id} style={styles.docCard}>
            <Text style={styles.docTitle}>{type}</Text>
            <Text style={styles.meta}>Status: {status}</Text>
            <Text style={styles.meta} numberOfLines={2}>{url || 'No URL'}</Text>
            <Text style={styles.meta}>{createdAt ? new Date(createdAt).toLocaleString() : 'Recent'}</Text>
          </View>
        );
      })}

      {!documentsQuery.isLoading && documents.length === 0 ? <Text style={styles.meta}>No documents uploaded yet.</Text> : null}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonLabel}>Back</Text>
      </Pressable>
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
    color: '#5d5853',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 8,
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
  primaryButton: {
    borderRadius: 10,
    backgroundColor: dofursColors.coral,
    alignItems: 'center',
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  docCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 10,
    gap: 4,
  },
  docTitle: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  error: {
    color: dofursColors.error,
    fontSize: 13,
  },
});
