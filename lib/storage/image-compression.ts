'use client';

import imageCompression from 'browser-image-compression';

export type ImageCompressionTarget = 'user-photos' | 'pet-photos' | 'service-images';

const compressionConfig: Record<
  ImageCompressionTarget,
  {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    initialQuality: number;
  }
> = {
  'user-photos': {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 720,
    initialQuality: 0.68,
  },
  'pet-photos': {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 960,
    initialQuality: 0.72,
  },
  'service-images': {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    initialQuality: 0.75,
  },
};

export async function compressImageBeforeUpload(file: File, target: ImageCompressionTarget) {
  const config = compressionConfig[target];

  return imageCompression(file, {
    maxSizeMB: config.maxSizeMB,
    maxWidthOrHeight: config.maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: config.initialQuality,
  });
}
