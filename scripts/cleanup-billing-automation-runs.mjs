import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const retainDays = Number(process.env.BILLING_AUTOMATION_RETENTION_DAYS ?? '90');

if (!url || !serviceRole) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

if (!Number.isFinite(retainDays) || retainDays < 1) {
  throw new Error('BILLING_AUTOMATION_RETENTION_DAYS must be a positive integer');
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cutoff = new Date(Date.now() - Math.floor(retainDays) * 24 * 60 * 60 * 1000).toISOString();

const countQuery = await supabase
  .from('billing_automation_runs')
  .select('id', { count: 'exact', head: true })
  .lt('created_at', cutoff);

if (countQuery.error) {
  throw new Error(countQuery.error.message);
}

const deleteQuery = await supabase
  .from('billing_automation_runs')
  .delete()
  .lt('created_at', cutoff);

if (deleteQuery.error) {
  throw new Error(deleteQuery.error.message);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      deleted_rows: countQuery.count ?? 0,
      retain_days: Math.floor(retainDays),
      cutoff_before: cutoff,
      ran_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
