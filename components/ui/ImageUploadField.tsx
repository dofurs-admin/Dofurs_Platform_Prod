'use client';

import { useState, useRef } from 'react';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import StorageBackedImage from './StorageBackedImage';

type BucketName = 'user-photos' | 'pet-photos' | 'service-images';

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  bucket?: BucketName;
  placeholder?: string;
  disabled?: boolean;
  showPreview?: boolean;
};

export default function ImageUploadField({
  label,
  value,
  onChange,
  bucket = 'service-images',
  placeholder = 'Upload image or enter URL',
  disabled = false,
  showPreview = true,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { path } = await uploadCompressedImage(file, bucket);
      onChange(path);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-neutral-700">{label}</label>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          className="flex-1 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
          id={`file-${label.replace(/\s+/g, '-')}`}
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="rounded-xl border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink hover:bg-[#fff7f0] disabled:opacity-50"
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {uploadError && (
        <p className="text-xs text-red-600">{uploadError}</p>
      )}

      {showPreview && value && !uploadError && (
        <div className="relative h-24 w-32 overflow-hidden rounded-lg border border-[#f2dfcf]">
          <StorageBackedImage
            value={value}
            alt="Preview"
            bucket={bucket}
            fill
            className="object-cover"
          />
        </div>
      )}
    </div>
  );
}
