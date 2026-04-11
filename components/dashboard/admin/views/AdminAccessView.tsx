'use client';

import { Card } from '@/components/ui';
import { Button, Input } from '@/components/ui';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';

type AdminAccessViewProps = {
  promoteEmail: string;
  onPromoteEmailChange: (email: string) => void;
  onPromoteToRole: (role: 'admin' | 'staff' | 'provider') => void;
  isPending: boolean;
};

export default function AdminAccessView({
  promoteEmail,
  onPromoteEmailChange,
  onPromoteToRole,
  isPending,
}: AdminAccessViewProps) {
  return (
    <section className="space-y-6">
      <AdminSectionGuide
        title="How to Use Access Management"
        subtitle="Grant admin, staff, or provider roles to existing users"
        steps={[
          { title: 'Enter Email', description: 'Type the email address of the user you want to promote. They must already have an account.' },
          { title: 'Choose a Role', description: 'Admin = full access. Staff = same as admin. Provider = service professional access.' },
          { title: 'Click Promote', description: 'Click the appropriate button to grant the role. The change takes effect immediately.' },
        ]}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-section-title">Admin Access Management</h2>
        </div>
        <p className="text-muted">Promote existing users to admin or staff roles</p>
      </div>

      <Card>
        <div className="space-y-4">
          <Input
            type="email"
            label="Email Address"
            value={promoteEmail}
            onChange={(event) => onPromoteEmailChange(event.target.value)}
            placeholder="user@example.com"
          />

          <div className="flex gap-2 flex-wrap pt-2">
            <Button onClick={() => onPromoteToRole('admin')} disabled={isPending}>
              Promote to Admin
            </Button>
            <Button onClick={() => onPromoteToRole('staff')} disabled={isPending} variant="secondary">
              Promote to Staff
            </Button>
            <Button onClick={() => onPromoteToRole('provider')} disabled={isPending} variant="secondary">
              Promote to Provider
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
