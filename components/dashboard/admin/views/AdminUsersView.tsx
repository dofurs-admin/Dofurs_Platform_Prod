'use client';

import { Card, Input, Button } from '@/components/ui';
import { cn } from '@/lib/design-system';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import { exportToCsv } from '@/lib/utils/export';

type AdminUserSearchPet = {
  id: string;
  name: string;
  breed: string | null;
  age: number | null;
  gender: string | null;
  color: string | null;
  size_category: string | null;
  energy_level: string | null;
  created_at: string;
};

type AdminUserSearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  photo_url: string | null;
  created_at: string;
  role: string | null;
  profile_type: 'admin' | 'staff' | 'provider' | 'customer';
  pets: AdminUserSearchPet[];
};

function getUserProfileBadge(profileType: AdminUserSearchResult['profile_type']) {
  switch (profileType) {
    case 'admin':
      return { label: 'Admin', className: 'border-violet-200 bg-violet-50 text-violet-700' };
    case 'staff':
      return { label: 'Staff', className: 'border-blue-200 bg-blue-50 text-blue-700' };
    case 'provider':
      return { label: 'Provider', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    default:
      return { label: 'Customer', className: 'border-neutral-200 bg-neutral-100 text-neutral-700' };
  }
}

type AdminUsersViewProps = {
  userSearchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  searchDebounced: string;
  searchResults: AdminUserSearchResult[];
  onAddUser: () => void;
};

export default function AdminUsersView({
  userSearchQuery,
  onSearchChange,
  isLoading,
  searchDebounced,
  searchResults,
  onAddUser,
}: AdminUsersViewProps) {
  return (
    <section className="space-y-6">
      <AdminSectionGuide
        title="How to Use User Directory"
        subtitle="Search, view, and manage customer accounts"
        steps={[
          { title: 'Search Users', description: 'Type a name, email, or phone number to find any registered user on the platform.' },
          { title: 'View Profile', description: 'Click on a user to see their full profile, including pets, addresses, and booking history.' },
          { title: 'Check Roles', description: 'See each user\'s role (Customer, Provider, Admin, Staff) shown as a badge next to their name.' },
          { title: 'Add New User', description: 'Use the "Add New User" button to manually create an account for a customer.' },
          { title: 'Export Data', description: 'Download the search results as a CSV file for offline review or reporting.' },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-section-title">User Directory</h2>
          <p className="text-muted">Search users and inspect account profile with their pet information.</p>
        </div>
        <div className="flex gap-2">
          {searchResults.length > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
              onClick={() => exportToCsv('users-export', ['ID', 'Name', 'Email', 'Phone', 'Role', 'Address', 'Joined'], searchResults.map((u) => [u.id, u.name ?? '', u.email ?? '', u.phone ?? '', u.profile_type, u.address ?? '', new Date(u.created_at).toLocaleDateString()]))}
            >
              Export CSV
            </button>
          ) : null}
          <Button type="button" onClick={onAddUser} className="sm:w-auto">
            Add New User
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <Input
            type="search"
            label="Search Users"
            placeholder="Name, email, or phone"
            value={userSearchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          {isLoading ? (
            <p className="text-sm text-neutral-500">Loading users…</p>
          ) : !searchDebounced ? (
            <p className="text-sm text-neutral-500">Type a name, email, or phone number to search users.</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-neutral-500">No users found.</p>
          ) : (
            <div className="space-y-4">
              {searchResults.map((user) => {
                const profileBadge = getUserProfileBadge(user.profile_type);
                return (
                  <div key={user.id} className="rounded-xl bg-neutral-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-neutral-900">{user.name ?? 'Unnamed user'}</p>
                        <p className="text-xs text-neutral-500">User ID: {user.id}</p>
                        <p className="text-sm text-neutral-600">{user.email ?? 'No email available'}</p>
                        <p className="text-sm text-neutral-600">{user.phone ?? 'No phone available'}</p>
                        <p className="text-sm text-neutral-600">{user.address ?? 'No address available'}</p>
                        <p className="text-xs text-neutral-500">
                          {user.gender ?? '—'} • {user.age != null ? `${user.age} yrs` : 'Age unknown'} • Joined {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.profile_type === 'customer' ? (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
                            Pets: {user.pets.length}
                          </span>
                        ) : (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-500">
                            Pets: N/A
                          </span>
                        )}
                        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', profileBadge.className)}>
                          {profileBadge.label}
                        </span>
                      </div>
                    </div>

                    {user.profile_type === 'customer' ? (
                      <div className="mt-4 rounded-lg bg-neutral-50/80 p-3">
                        <p className="text-sm font-semibold text-neutral-900">Pet Information</p>
                        {user.pets.length === 0 ? (
                          <p className="mt-2 text-sm text-neutral-500">No pets added yet.</p>
                        ) : (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {user.pets.map((pet) => (
                              <div key={pet.id} className="rounded-lg bg-white/80 p-3">
                                <p className="text-sm font-semibold text-neutral-900">{pet.name}</p>
                                <p className="text-xs text-neutral-600">
                                  {pet.breed ?? 'Breed not set'} • {pet.gender ?? 'Gender not set'} • {pet.age != null ? `${pet.age} yr${pet.age !== 1 ? 's' : ''}` : 'Age unknown'}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {pet.size_category ?? 'Size n/a'} • {pet.energy_level ?? 'Energy n/a'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
