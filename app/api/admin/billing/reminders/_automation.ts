import type { SupabaseClient } from '@supabase/supabase-js';
import { acquireDistributedLock, releaseDistributedLock } from '@/lib/api/distributed-lock';

export type ReminderTemplate = 'due_soon' | 'overdue_7' | 'overdue_14';
export type ReminderChannel = 'email' | 'whatsapp';
export type RunBucket = 'due_soon' | 'overdue_7' | 'overdue_14' | 'overdue_30' | 'all';

type InvoiceRow = {
  id: string;
  created_at: string;
  issued_at: string | null;
  metadata: Record<string, unknown> | null;
};

export const ALLOWED_BUCKETS: RunBucket[] = ['due_soon', 'overdue_7', 'overdue_14', 'overdue_30', 'all'];
export const ALLOWED_CHANNELS: ReminderChannel[] = ['email', 'whatsapp'];

const TEMPLATE_MIN_DAYS: Record<ReminderTemplate, number> = {
  due_soon: 3,
  overdue_7: 7,
  overdue_14: 14,
};

const REMINDER_COOLDOWN_HOURS = 24;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getDaysSince(referenceIso: string) {
  const diffMs = Date.now() - new Date(referenceIso).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function toBucket(daysSinceIssued: number): Exclude<RunBucket, 'all'> | 'current' {
  if (daysSinceIssued >= 30) {
    return 'overdue_30';
  }

  if (daysSinceIssued >= 14) {
    return 'overdue_14';
  }

  if (daysSinceIssued >= 7) {
    return 'overdue_7';
  }

  if (daysSinceIssued >= 3) {
    return 'due_soon';
  }

  return 'current';
}

function bucketTemplate(bucket: RunBucket): ReminderTemplate {
  if (bucket === 'due_soon') {
    return 'due_soon';
  }

  if (bucket === 'overdue_7') {
    return 'overdue_7';
  }

  return 'overdue_14';
}

export async function runBillingReminderAutomation(input: {
  supabase: SupabaseClient;
  actorId: string;
  source: string;
  bucket: RunBucket;
  channel: ReminderChannel;
  enforceCadence: boolean;
  enforceCooldown: boolean;
  dryRun?: boolean;
}) {
  const { supabase, actorId, source, bucket, channel, enforceCadence, enforceCooldown, dryRun = false } = input;
  const lockKey = 'billing-reminders:automation';
  const lockHolder = `${source}:${actorId}`;
  let lockAcquired = false;

  if (!ALLOWED_BUCKETS.includes(bucket)) {
    throw new Error('bucket must be one of: due_soon, overdue_7, overdue_14, overdue_30, all.');
  }

  if (!ALLOWED_CHANNELS.includes(channel)) {
    throw new Error('channel must be one of: email, whatsapp.');
  }

  lockAcquired = await acquireDistributedLock(supabase, {
    lockKey,
    holder: lockHolder,
    ttlSeconds: 15 * 60,
  });

  if (!lockAcquired) {
    throw new Error('Reminder automation already running. Please retry after current run completes.');
  }

  try {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('id, created_at, issued_at, metadata')
      .eq('status', 'issued')
      .order('issued_at', { ascending: true, nullsFirst: false })
      .limit(1000)
      .returns<InvoiceRow[]>();

    if (error) {
      throw new Error(error.message);
    }

    const invoices = data ?? [];
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    let scanned = 0;
    let sent = 0;
    let skippedCadence = 0;
    let skippedCooldown = 0;
    let escalated = 0;

    for (const invoice of invoices) {
      const referenceIso = invoice.issued_at ?? invoice.created_at;
      const daysSinceIssued = getDaysSince(referenceIso);
      const currentBucket = toBucket(daysSinceIssued);

      if (bucket !== 'all' && currentBucket !== bucket) {
        continue;
      }

      if (currentBucket === 'current') {
        continue;
      }

      scanned += 1;

      const metadata = isRecord(invoice.metadata) ? invoice.metadata : {};
      const reminders = Array.isArray(metadata.reminders) ? metadata.reminders : [];

      const escalation = isRecord(metadata.escalation) ? metadata.escalation : {};
      let escalationChanged = false;

      if (daysSinceIssued >= 30) {
        const existingActive = escalation.active === true;
        if (!existingActive) {
          escalation.active = true;
          escalation.level = 'collections_watch';
          escalation.tagged_at = nowIso;
          escalation.tagged_by = actorId;
          escalation.reason = 'invoice_outstanding_30_plus_days';
          escalation.source = source;
          escalationChanged = true;
          escalated += 1;
        }
      }

      const template = bucketTemplate(bucket === 'all' ? (currentBucket === 'overdue_30' ? 'overdue_14' : currentBucket) : bucket);

      if (enforceCadence) {
        const minDays = TEMPLATE_MIN_DAYS[template];
        if (daysSinceIssued < minDays) {
          skippedCadence += 1;
          if (escalationChanged && !dryRun) {
            const { error: escalationUpdateError } = await supabase
              .from('billing_invoices')
              .update({ metadata: { ...metadata, escalation } })
              .eq('id', invoice.id);

            if (escalationUpdateError) {
              throw new Error(escalationUpdateError.message);
            }
          }
          continue;
        }
      }

      if (enforceCooldown) {
        const lastReminder = reminders.length > 0 ? reminders[reminders.length - 1] : null;
        const lastReminderAt =
          isRecord(lastReminder) && typeof lastReminder.sent_at === 'string' ? Date.parse(lastReminder.sent_at) : Number.NaN;

        if (Number.isFinite(lastReminderAt)) {
          const elapsedHours = (nowMs - lastReminderAt) / (60 * 60 * 1000);
          if (elapsedHours < REMINDER_COOLDOWN_HOURS) {
            skippedCooldown += 1;
            if (escalationChanged && !dryRun) {
              const { error: escalationUpdateError } = await supabase
                .from('billing_invoices')
                .update({ metadata: { ...metadata, escalation } })
                .eq('id', invoice.id);

              if (escalationUpdateError) {
                throw new Error(escalationUpdateError.message);
              }
            }
            continue;
          }
        }
      }

      reminders.push({
        template,
        channel,
        sent_at: nowIso,
        sent_by: actorId,
        source,
        auto: true,
        run_bucket: bucket,
      });

      if (dryRun) {
        sent += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('billing_invoices')
        .update({
          metadata: {
            ...metadata,
            reminders,
            ...(Object.keys(escalation).length > 0 ? { escalation } : {}),
          },
        })
        .eq('id', invoice.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      sent += 1;
    }

    return {
      success: true,
      run_at: nowIso,
      bucket,
      channel,
      enforceCadence,
      enforceCooldown,
      dry_run: dryRun,
      scanned,
      sent,
      skippedCadence,
      skippedCooldown,
      escalated,
    };
  } finally {
    if (lockAcquired) {
      await releaseDistributedLock(supabase, {
        lockKey,
        holder: lockHolder,
      }).catch(() => undefined);
    }
  }
}
