'use client';

import { compressImageBeforeUpload } from './image-compression';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

type BucketName = 'user-photos' | 'pet-photos' | 'service-images';

function formatUploadError(raw: unknown) {
  const fallback = 'Image upload failed. Please try again.';

  if (!(raw instanceof Error)) {
    return fallback;
  }

  const message = raw.message?.trim() || fallback;
  const lower = message.toLowerCase();

  if (lower.includes('auth') || lower.includes('jwt') || lower.includes('token')) {
    return 'Your login session expired. Please sign in again and retry upload.';
  }

  if (lower.includes('mime') || lower.includes('file type') || lower.includes('format')) {
    return 'Unsupported image format. Please upload JPG, PNG, or WEBP.';
  }

  if (lower.includes('size') || lower.includes('too large')) {
    return 'Image is too large. Please choose a smaller image and retry.';
  }

  return message;
}

export async function uploadCompressedImage(file: File, bucket: BucketName) {
  try {
    if (!file) {
      throw new Error('No file selected for upload.');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type.');
    }

    if (file.size <= 0) {
      throw new Error('Selected file is empty.');
    }

    const compressed = await compressImageBeforeUpload(file, bucket);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const requestHeaders = new Headers({
      'Content-Type': 'application/json',
    });

    if (session?.access_token) {
      requestHeaders.set('Authorization', `Bearer ${session.access_token}`);
    }

    const signedUploadResponse = await fetch('/api/storage/signed-upload-url', {
      method: 'POST',
      credentials: 'include',
      headers: requestHeaders,
      body: JSON.stringify({ bucket, fileName: compressed.name }),
    });

    if (!signedUploadResponse.ok) {
      const errorPayload = (await signedUploadResponse.json().catch(() => null)) as
        | { error?: string; details?: string; message?: string }
        | null;

      const serverMessage = errorPayload?.error || errorPayload?.details || errorPayload?.message;
      throw new Error(serverMessage || 'Failed to get signed upload URL.');
    }

    const signedData = (await signedUploadResponse.json()) as {
      path: string;
      token: string;
    };

    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(signedData.path, signedData.token, compressed);

    if (error) {
      throw new Error(error.message || 'Upload failed while writing file to storage.');
    }

    const readResponse = await fetch('/api/storage/signed-read-url', {
      method: 'POST',
      credentials: 'include',
      headers: requestHeaders,
      body: JSON.stringify({ bucket, path: signedData.path, expiresIn: 3600 }),
    });

    if (!readResponse.ok) {
      throw new Error('Upload succeeded, but preview URL generation failed.');
    }

    const readData = (await readResponse.json()) as { signedUrl: string };

    return {
      path: signedData.path,
      signedUrl: readData.signedUrl,
    };
  } catch (error) {
    throw new Error(formatUploadError(error));
  }
}
