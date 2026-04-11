'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import Button from '@/components/ui/Button';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

type Profile = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  address: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  photo_url: string | null;
};

export default function UserSettingsClient({ initialProfile }: { initialProfile: Profile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [phoneDigits, setPhoneDigits] = useState(extractIndianPhoneDigits(initialProfile.phone ?? ''));
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function updateProfile() {
    const normalizedName = (profile.name ?? '').trim();
    const normalizedPhone = toIndianE164(phoneDigits);
    const normalizedAddress = (profile.address ?? '').trim();
    const normalizedAge = profile.age;
    const normalizedGender = profile.gender;

    if (!normalizedName || normalizedName.length < 2) {
      showToast('Name must be at least 2 characters.', 'error');
      return;
    }

    if (!normalizedAddress || normalizedAddress.length < 5) {
      showToast('Address must be at least 5 characters.', 'error');
      return;
    }

    if (!isValidIndianE164(normalizedPhone)) {
      showToast('Enter a valid 10-digit Indian phone number.', 'error');
      return;
    }

    if (!Number.isInteger(normalizedAge) || (normalizedAge as number) < 13 || (normalizedAge as number) > 120) {
      showToast('Age must be a whole number between 13 and 120.', 'error');
      return;
    }

    if (!normalizedGender) {
      showToast('Please select gender.', 'error');
      return;
    }

    setProfile((current) => ({
      ...current,
      name: normalizedName,
      phone: normalizedPhone,
      address: normalizedAddress,
    }));

    startTransition(async () => {
      let uploadedPhotoPath: string | null | undefined = profile.photo_url;

      if (profilePhotoFile) {
        try {
          const upload = await uploadCompressedImage(profilePhotoFile, 'user-photos');
          uploadedPhotoPath = upload.path;
          setProfilePhotoPreview(upload.signedUrl);
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Profile photo upload failed.', 'error');
          return;
        }
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: normalizedName,
          phone: normalizedPhone,
          address: normalizedAddress,
          age: normalizedAge,
          gender: normalizedGender,
          photoUrl: uploadedPhotoPath ?? null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        showToast(payload.error || 'Profile update failed.', 'error');
        return;
      }

      setProfile((current) => ({
        ...current,
        photo_url: uploadedPhotoPath ?? null,
      }));
      setProfilePhotoFile(null);
      showToast('Profile updated.', 'success');
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">User Settings</h1>
              <Link
                href="/dashboard"
            className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-4 py-2 text-xs font-semibold text-ink"
          >
            Back to Dashboard
          </Link>
        </div>
        <p className="mt-2 text-sm text-[#6b6b6b]">Manage your profile details and contact information.</p>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h2 className="text-lg font-semibold text-ink">Profile Settings</h2>
        <div className="mt-4 flex items-center gap-3">
          {profilePhotoPreview || profile.photo_url ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full">
              {profilePhotoPreview ? (
                <Image
                  src={profilePhotoPreview}
                  alt="Profile"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : profile.photo_url ? (
                <StorageBackedImage
                  value={profile.photo_url}
                  bucket="user-photos"
                  alt="Profile"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff2e7] text-sm font-semibold text-ink">
              {(profile.name ?? 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <label className="cursor-pointer rounded-full border border-[#e8ccb3] bg-white px-3 py-2 text-xs text-ink">
            {profilePhotoFile ? `Selected: ${profilePhotoFile.name}` : 'Upload Profile Photo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setProfilePhotoFile(file);

                if (!file) {
                  setProfilePhotoPreview(null);
                  return;
                }

                const objectUrl = URL.createObjectURL(file);
                setProfilePhotoPreview(objectUrl);
              }}
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={profile.name ?? ''}
            onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
            placeholder="Your name"
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
          />
          <input
            value={profile.email ?? ''}
            readOnly
            disabled
            placeholder="Email"
            className="rounded-xl border border-[#e8ccb3] bg-[#f8f8f8] px-4 py-2.5 text-sm text-[#7a7a7a]"
          />
          <div className="flex overflow-hidden rounded-xl border border-[#e8ccb3] focus-within:border-[#d89a68]">
            <span className="inline-flex items-center bg-[#fffaf6] px-3 text-sm font-semibold text-ink">+91</span>
            <input
              value={phoneDigits}
              onChange={(event) => setPhoneDigits(extractIndianPhoneDigits(event.target.value))}
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              className="w-full px-4 py-2.5 text-sm outline-none"
            />
          </div>
          <input
            value={profile.address ?? ''}
            onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
            placeholder="Address"
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm sm:col-span-2"
          />
          <input
            type="number"
            min={13}
            max={120}
            value={profile.age ?? ''}
            onChange={(event) =>
              setProfile((current) => ({
                ...current,
                age: event.target.value ? Number(event.target.value) : null,
              }))
            }
            placeholder="Age"
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
          />
          <select
            value={profile.gender ?? ''}
            onChange={(event) =>
              setProfile((current) => ({
                ...current,
                gender: (event.target.value || null) as 'male' | 'female' | 'other' | null,
              }))
            }
            className="rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Button type="button" size="sm" onClick={updateProfile} disabled={isPending} className="mt-4">
          {isPending ? 'Saving...' : 'Save Profile'}
        </Button>
      </section>
    </div>
  );
}
