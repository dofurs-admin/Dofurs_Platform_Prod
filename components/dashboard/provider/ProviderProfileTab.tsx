'use client';

import { Card, Badge, Button } from '@/components/ui';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import type { ProviderDashboard } from '@/lib/provider-management/types';
import { EMPTY_VALUE } from './providerTypes';
import type { ProfileFormState, DetailsFormState } from './providerTypes';

type Props = {
  dashboard: ProviderDashboard;
  profileForm: ProfileFormState;
  detailsForm: DetailsFormState;
  onEditBio: () => void;
  onEditDetails: () => void;
  onManageDocuments: () => void;
};

export default function ProviderProfileTab({
  dashboard,
  profileForm,
  detailsForm,
  onEditBio,
  onEditDetails,
  onManageDocuments,
}: Props) {
  return (
    <>
      {/* Profile Information */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Profile Information</h2>
          <p className="text-muted">
            Only bio can be edited here. Other profile fields are managed by admin.
          </p>
        </div>

        <Card>
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">Profile Photo</p>
                <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                  {profileForm.profile_photo_url ? (
                    <StorageBackedImage
                      value={profileForm.profile_photo_url}
                      bucket="user-photos"
                      alt="Provider profile photo"
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-neutral-500">
                      No photo
                    </div>
                  )}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={onEditBio}>
                Edit Bio
              </Button>
            </div>

            <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Bio</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                {profileForm.bio.trim() || EMPTY_VALUE}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Years of Experience
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {profileForm.years_of_experience || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Phone Number
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {profileForm.phone_number || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Email
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {profileForm.email || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Service Radius
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {profileForm.service_radius_km ? `${profileForm.service_radius_km} km` : EMPTY_VALUE}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Professional & Clinic Details */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Professional &amp; Clinic Details</h2>
          <p className="text-muted">Keep your professional and clinic information up to date.</p>
        </div>

        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button size="sm" variant="secondary" onClick={onEditDetails}>
                Edit Details
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  License Number
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {detailsForm.license_number || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Specialization
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {detailsForm.specialization || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Clinic Registration
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {detailsForm.registration_number || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">City</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {detailsForm.city || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">State</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {detailsForm.state || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Number of Doctors
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {detailsForm.number_of_doctors || EMPTY_VALUE}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 bg-white p-4 sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={detailsForm.teleconsult_enabled ? 'success' : 'warning'}>
                    Teleconsult: {detailsForm.teleconsult_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Badge variant={detailsForm.hospitalization_available ? 'success' : 'warning'}>
                    Hospitalization:{' '}
                    {detailsForm.hospitalization_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Documents */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-section-title">Documents</h2>
            <p className="text-muted">Upload and manage your verification documents.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onManageDocuments}>
            Manage Documents
          </Button>
        </div>

        <Card>
          {dashboard.documents.length === 0 ? (
            <p className="text-body text-neutral-500 text-center py-6">No documents uploaded</p>
          ) : (
            <div className="space-y-3">
              {dashboard.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="mb-3">
                    <p className="font-semibold text-neutral-900">
                      {doc.document_type ?? 'Document'}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 break-all">
                      {doc.document_url ?? EMPTY_VALUE}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-neutral-200/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <Badge
                      variant={
                        doc.verification_status === 'approved'
                          ? 'success'
                          : doc.verification_status === 'rejected'
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {`Verification: ${doc.verification_status}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
