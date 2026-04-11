'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, Button, Input } from '@/components/ui';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';

type AuditEntry = {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}

const PAGE_SIZE = 50;

export default function AdminAuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (entityTypeFilter.trim()) params.set('entityType', entityTypeFilter.trim());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
      }
    });
  }, [page, actionFilter, entityTypeFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section className="space-y-6">
      <AdminSectionGuide
        title="How to Use Audit Log"
        subtitle="Track every admin and staff action for compliance"
        steps={[
          { title: 'Browse Actions', description: 'All admin and staff actions are logged here with timestamps, showing who did what and when.' },
          { title: 'Filter by Action', description: 'Type an action name (e.g., "provider.approved") to see only that type of event.' },
          { title: 'Filter by Entity', description: 'Type an entity type (e.g., "booking", "user") to focus on changes to that category.' },
          { title: 'Review Details', description: 'Each entry shows the action performed, the entity affected, and the admin who made the change.' },
        ]}
      />

      <div className="space-y-2">
        <h2 className="text-section-title">Admin Audit Log</h2>
        <p className="text-muted">Track all admin and staff actions for compliance and traceability.</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              type="search"
              label="Filter by action"
              placeholder="e.g. provider.approved"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            />
            <Input
              type="search"
              label="Filter by entity type"
              placeholder="e.g. provider, user, booking"
              value={entityTypeFilter}
              onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
            />
          </div>

          <p className="text-xs text-neutral-500">{total} entries found</p>

          {isLoading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No audit entries found.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="border-b border-neutral-200/60 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{entry.action}</p>
                      <p className="text-xs text-neutral-600">
                        {entry.entity_type} <span className="text-neutral-400">#{entry.entity_id}</span>
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Admin: <span className="font-mono text-xs">{entry.admin_user_id}</span>
                      </p>
                      {entry.ip_address ? (
                        <p className="text-xs text-neutral-400">IP: {entry.ip_address}</p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-neutral-500">{formatDateTime(entry.created_at)}</p>
                      {entry.new_value ? (
                        <p className="text-xs text-neutral-400 mt-1 font-mono">
                          {JSON.stringify(entry.new_value).slice(0, 60)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-neutral-500">Page {page} of {totalPages}</span>
              <Button size="sm" variant="secondary" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
