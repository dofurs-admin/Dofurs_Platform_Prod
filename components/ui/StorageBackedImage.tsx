'use client';

import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { apiRequest } from '@/lib/api/client';

type BucketName = 'user-photos' | 'pet-photos' | 'service-images';

type StorageBackedImageProps = {
  value: string;
  alt: string;
  bucket: BucketName;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  onError?: ComponentProps<typeof Image>['onError'];
};

const resolvedUrlCache = new Map<string, string>();
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';

function isDirectHttpOrStorageUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith('/storage/v1/');
}

function isPublicStorageObjectUrl(value: string) {
  return value.includes('/storage/v1/object/public/');
}

function isAlreadySignedStorageObjectUrl(value: string) {
  return value.includes('/storage/v1/object/sign/') || value.includes('token=');
}

function isRootRelativeUrl(value: string) {
  return value.startsWith('/');
}

function isLikelyStorageObjectPath(value: string) {
  return value.includes('/') && !isDirectHttpOrStorageUrl(value) && !isRootRelativeUrl(value);
}

function getInitialResolvedUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (isLikelyStorageObjectPath(trimmed)) {
    // Raw object paths (e.g. "<uid>/<file>.jpg") must be signed first.
    return '';
  }

  return absolutizeStorageUrl(trimmed);
}

function toBucketName(bucket: string): BucketName | null {
  if (bucket === 'user-photos' || bucket === 'pet-photos' || bucket === 'service-images') {
    return bucket;
  }

  return null;
}

function extractStorageTarget(urlValue: string): { bucket: BucketName; path: string } | null {
  try {
    const base = urlValue.startsWith('http') ? undefined : 'http://localhost';
    const parsed = new URL(urlValue, base);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const storageMarker = segments.findIndex((segment, index) => segment === 'storage' && segments[index + 1] === 'v1' && segments[index + 2] === 'object');

    if (storageMarker === -1) {
      return null;
    }

    const objectSegments = segments.slice(storageMarker + 3);
    const first = objectSegments[0];

    if (!first) {
      return null;
    }

    const modeOffsets: Record<string, number> = {
      sign: 1,
      public: 1,
      authenticated: 1,
      render: 2,
    };

    const offset = modeOffsets[first] ?? 0;
    const bucketCandidate = objectSegments[offset];
    const pathParts = objectSegments.slice(offset + 1);

    if (!bucketCandidate || pathParts.length === 0) {
      return null;
    }

    const bucket = toBucketName(bucketCandidate);
    if (!bucket) {
      return null;
    }

    const path = decodeURIComponent(pathParts.join('/'));

    if (path) {
      return { bucket, path };
    }

    return null;
  } catch (err) { console.error(err);
    return null;
  }
}

function normalizePath(value: string, bucket: BucketName) {
  const normalized = value.trim().replace(/^\/+/, '');
  if (normalized.startsWith(`${bucket}/`)) {
    return normalized.slice(bucket.length + 1);
  }
  return normalized;
}

function absolutizeStorageUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/storage/v1/') && supabaseOrigin) {
    return `${supabaseOrigin}${trimmed}`;
  }

  return trimmed;
}

function getSafeFallbackUrl(raw: string) {
  // Raw storage object paths like "<uid>/<file>.png" are invalid browser URLs.
  if (isLikelyStorageObjectPath(raw)) {
    return '';
  }

  return absolutizeStorageUrl(raw);
}

export default function StorageBackedImage({
  value,
  alt,
  bucket,
  className,
  sizes,
  fill,
  width,
  height,
  priority,
  onError,
}: StorageBackedImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState(getInitialResolvedUrl(value));
  const [hasRetriedWithRawValue, setHasRetriedWithRawValue] = useState(false);
  const rawValue = useMemo(() => value.trim(), [value]);

  const cacheKey = useMemo(() => `${bucket}::${value}`, [bucket, value]);

  useEffect(() => {
    setHasRetriedWithRawValue(false);
  }, [value]);

  useEffect(() => {
    let active = true;

    async function resolveUrl() {
      const raw = value.trim();

      if (!raw) {
        if (active) {
          setResolvedUrl('');
        }
        return;
      }

      const cached = resolvedUrlCache.get(cacheKey);
      if (cached) {
        if (active) {
          setResolvedUrl(cached);
        }
        return;
      }

      const isHttpLike = /^https?:\/\//i.test(raw);
      const isStoragePath = raw.startsWith('/storage/v1/object/');

      if (isHttpLike || isStoragePath) {
        if (isPublicStorageObjectUrl(raw) || isAlreadySignedStorageObjectUrl(raw)) {
          const directStorageUrl = absolutizeStorageUrl(raw);
          if (active) {
            setResolvedUrl(directStorageUrl);
          }
          resolvedUrlCache.set(cacheKey, directStorageUrl);
          return;
        }

        const signedTarget = extractStorageTarget(raw);

        if (!signedTarget) {
          const fallbackUrl = getSafeFallbackUrl(raw);
          if (active) {
            setResolvedUrl(fallbackUrl);
          }
          resolvedUrlCache.set(cacheKey, fallbackUrl);
          return;
        }

        try {
          const payload = await apiRequest<{ signedUrl: string }>('/api/storage/signed-read-url', {
            method: 'POST',
            body: JSON.stringify({
              bucket: signedTarget.bucket,
              path: signedTarget.path,
              expiresIn: 3600,
            }),
          });

          const signedUrl = absolutizeStorageUrl(payload.signedUrl);
          if (active) {
            setResolvedUrl(signedUrl);
          }

          resolvedUrlCache.set(cacheKey, signedUrl);
          return;
        } catch (err) { console.error(err);
          const fallbackUrl = getSafeFallbackUrl(raw);
          if (active) {
            setResolvedUrl(fallbackUrl);
          }
          resolvedUrlCache.set(cacheKey, fallbackUrl);
          return;
        }
      }

      const path = normalizePath(raw, bucket);

      try {
        const payload = await apiRequest<{ signedUrl: string }>('/api/storage/signed-read-url', {
          method: 'POST',
          body: JSON.stringify({
            bucket,
            path,
            expiresIn: 3600,
          }),
        });

        const signedUrl = absolutizeStorageUrl(payload.signedUrl);
        if (active) {
          setResolvedUrl(signedUrl);
        }

        resolvedUrlCache.set(cacheKey, signedUrl);
      } catch (err) { console.error(err);
        const fallbackUrl = getSafeFallbackUrl(raw);
        if (active) {
          setResolvedUrl(fallbackUrl);
        }
        resolvedUrlCache.set(cacheKey, fallbackUrl);
      }
    }

    void resolveUrl();

    return () => {
      active = false;
    };
  }, [bucket, cacheKey, value]);

  if (!resolvedUrl) {
    return null;
  }

  const fallbackRawUrl = isLikelyStorageObjectPath(rawValue) ? '' : absolutizeStorageUrl(rawValue);

  return (
    <Image
      src={resolvedUrl}
      alt={alt}
      className={className}
      sizes={sizes}
      fill={fill}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      onError={(event) => {
        if (!hasRetriedWithRawValue && fallbackRawUrl && fallbackRawUrl !== resolvedUrl) {
          setHasRetriedWithRawValue(true);
          setResolvedUrl(fallbackRawUrl);
          return;
        }

        onError?.(event);
      }}
    />
  );
}
