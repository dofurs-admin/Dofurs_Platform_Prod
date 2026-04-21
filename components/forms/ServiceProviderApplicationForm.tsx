'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Sparkles, Star, UserRound, Users } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { extractIndianPhoneDigits, isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';

type PartnerCategory = 'individual' | 'business';

type FormState = {
  partner_category: PartnerCategory;
  full_name: string;
  business_name: string;
  email: string;
  phone_number: string;
  city: string;
  state: string;
  provider_type: string;
  years_of_experience: string;
  team_size: string;
  service_modes: string[];
  service_areas: string;
  portfolio_url: string;
  motivation: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const SERVICE_MODES = [
  { id: 'home_visit', label: 'Home Visit' },
  { id: 'clinic_visit', label: 'Clinic/Centre' },
  { id: 'teleconsult', label: 'Teleconsult' },
  { id: 'emergency', label: 'Emergency Support' },
] as const;

const INITIAL_STATE: FormState = {
  partner_category: 'individual',
  full_name: '',
  business_name: '',
  email: '',
  phone_number: '',
  city: '',
  state: '',
  provider_type: '',
  years_of_experience: '',
  team_size: '',
  service_modes: [],
  service_areas: '',
  portfolio_url: '',
  motivation: '',
};

function sanitizePhoneNumber(value: string) {
  return extractIndianPhoneDigits(value);
}

export default function ServiceProviderApplicationForm() {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isBusiness = form.partner_category === 'business';

  const isFormReady = useMemo(() => {
    const base = Boolean(
      form.full_name.trim() &&
        form.email.trim() &&
        form.phone_number.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.years_of_experience.trim() &&
        form.service_areas.trim() &&
        form.service_modes.length > 0,
    );
    if (isBusiness) {
      return base && Boolean(form.business_name.trim() && form.provider_type.trim());
    }
    return base && Boolean(form.provider_type.trim());
  }, [form, isBusiness]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function isFieldRequired(field: keyof FormState): boolean {
    if (field === 'business_name') {
      return isBusiness;
    }

    return [
      'full_name',
      'email',
      'phone_number',
      'city',
      'state',
      'provider_type',
      'years_of_experience',
      'service_modes',
      'service_areas',
    ].includes(field);
  }

  function fieldError(field: keyof FormState): string | undefined {
    if (errors[field]) {
      return errors[field];
    }

    if (!hasAttemptedSubmit) {
      return undefined;
    }

    const val = form[field];
    if (Array.isArray(val)) {
      return isFieldRequired(field) && val.length === 0 ? 'Required' : undefined;
    }

    if (typeof val === 'string' && !val.trim() && isFieldRequired(field)) {
      return 'Required';
    }

    return undefined;
  }

  function validateForm(currentForm: FormState): FormErrors {
    const nextErrors: FormErrors = {};
    const isBusinessCategory = currentForm.partner_category === 'business';

    if (!currentForm.full_name.trim()) {
      nextErrors.full_name = 'Full name is required';
    } else if (!/^[a-zA-Z\s.]+$/.test(currentForm.full_name.trim())) {
      nextErrors.full_name = 'Name can only contain letters, spaces, and periods';
    }

    if (!currentForm.email.trim()) {
      nextErrors.email = 'Email is required';
    }

    if (!currentForm.phone_number.trim()) {
      nextErrors.phone_number = 'Phone number is required';
    } else if (!isValidIndianE164(toIndianE164(currentForm.phone_number))) {
      nextErrors.phone_number = 'Enter a valid Indian phone number';
    }

    if (!currentForm.city.trim()) {
      nextErrors.city = 'City is required';
    } else if (currentForm.city.trim().length < 2) {
      nextErrors.city = 'City must be at least 2 characters';
    }

    if (!currentForm.state.trim()) {
      nextErrors.state = 'State is required';
    } else if (currentForm.state.trim().length < 2) {
      nextErrors.state = 'State must be at least 2 characters';
    }

    if (!currentForm.provider_type.trim()) {
      nextErrors.provider_type = 'Provider type is required';
    } else if (currentForm.provider_type.trim().length < 2) {
      nextErrors.provider_type = 'Provider type must be at least 2 characters';
    }

    if (!currentForm.years_of_experience.trim()) {
      nextErrors.years_of_experience = 'Years of experience is required';
    } else {
      const yearsOfExperience = Number(currentForm.years_of_experience);
      if (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 60) {
        nextErrors.years_of_experience = 'Years of experience must be between 0 and 60';
      }
    }

    if (isBusinessCategory) {
      if (!currentForm.business_name.trim()) {
        nextErrors.business_name = 'Business / clinic name is required';
      } else if (currentForm.business_name.trim().length < 2) {
        nextErrors.business_name = 'Business / clinic name must be at least 2 characters';
      }

      if (currentForm.team_size.trim()) {
        const teamSize = Number(currentForm.team_size);
        if (!Number.isFinite(teamSize) || !Number.isInteger(teamSize) || teamSize < 1 || teamSize > 500) {
          nextErrors.team_size = 'Team size must be an integer between 1 and 500';
        }
      }
    }

    if (currentForm.service_modes.length === 0) {
      nextErrors.service_modes = 'Select at least one service mode';
    }

    if (!currentForm.service_areas.trim()) {
      nextErrors.service_areas = 'Service areas are required';
    } else if (currentForm.service_areas.trim().length < 6) {
      nextErrors.service_areas = 'Service areas must be at least 6 characters';
    }

    if (currentForm.portfolio_url.trim()) {
      try {
        // Validate optional portfolio URL client-side to match API expectations.
        new URL(currentForm.portfolio_url.trim());
      } catch {
        nextErrors.portfolio_url = 'Enter a valid URL (for example, https://example.com)';
      }
    }

    if (currentForm.motivation.trim().length > 1200) {
      nextErrors.motivation = 'Motivation must be 1200 characters or less';
    }

    return nextErrors;
  }

  function toggleServiceMode(mode: (typeof SERVICE_MODES)[number]['id'], checked: boolean) {
    setForm((current) => {
      const nextModes = new Set(current.service_modes);
      if (checked) {
        nextModes.add(mode);
      } else {
        nextModes.delete(mode);
      }

      return {
        ...current,
        service_modes: Array.from(nextModes),
      };
    });
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setErrors({});

    const clientErrors = validateForm(form);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      showToast('Please fix the highlighted fields before submitting.', 'error');
      return;
    }

    const yearsOfExperience = Number(form.years_of_experience);

    const normalizedPhone = toIndianE164(form.phone_number);

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/provider-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone_number: normalizedPhone,
          city: form.city,
          state: form.state,
          provider_type: isBusiness ? form.provider_type : form.provider_type,
          years_of_experience: yearsOfExperience,
          service_modes: form.service_modes,
          service_areas: form.service_areas,
          portfolio_url: form.portfolio_url,
          motivation: form.motivation,
          partner_category: form.partner_category,
          business_name: isBusiness ? form.business_name : '',
          team_size: isBusiness && form.team_size ? Number(form.team_size) : null,
          website: '',
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        details?: {
          fieldErrors?: Record<string, string[] | undefined>;
          formErrors?: string[];
        };
      } | null;

      if (!response.ok) {
        const fieldErrors = payload?.details?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === 'object') {
          const mappedErrors: FormErrors = {};

          for (const [key, messages] of Object.entries(fieldErrors)) {
            if (!messages || messages.length === 0) {
              continue;
            }

            if (key in form) {
              mappedErrors[key as keyof FormState] = messages[0];
            }
          }

          if (Object.keys(mappedErrors).length > 0) {
            setErrors(mappedErrors);
          }
        }

        throw new Error(payload?.error ?? 'Unable to submit application. Please try again.');
      }

      setIsSubmitted(true);
      setForm(INITIAL_STATE);
      setErrors({});
      showToast('Application submitted successfully. Our team will review it shortly.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to submit application.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-8 shadow-xl shadow-emerald-100/50">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/35 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-lime-200/30 blur-2xl" aria-hidden="true" />

        <div className="relative flex items-start gap-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
            <BadgeCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-emerald-900">Application received</h3>
            <p className="max-w-2xl text-sm text-emerald-800/90">
              Thanks for applying to become a Dofurs Service Provider. Your application is now in our admin operations
              queue under <span className="font-semibold">Service Provider Applications</span> and will be reviewed by
              the onboarding team.
            </p>
            <Button
              variant="secondary"
              onClick={() => setIsSubmitted(false)}
              className="mt-2 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
            >
              Submit Another Application
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submitApplication} className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 rounded-3xl border border-neutral-200/70 bg-white/90 p-6 shadow-lg shadow-neutral-200/50 backdrop-blur md:p-7">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Partner Application
            </p>
            <h3 className="text-2xl font-semibold text-neutral-950">Tell us about {isBusiness ? 'your business' : 'your practice'}</h3>
            <p className="text-sm text-neutral-600">
              We review every {isBusiness ? 'business' : 'profile'} for quality, reliability, and service excellence before activation.
            </p>
          </div>

          {/* Partner category toggle */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">I am applying as</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => updateField('partner_category', 'individual')}
                className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2.5 text-left text-sm font-medium transition-all sm:gap-2.5 sm:px-4 sm:py-3 ${
                  !isBusiness
                    ? 'border-coral bg-coral text-white shadow-md'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-coral/30'
                }`}
              >
                <UserRound className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold">Individual</span>
                  <span className={`block text-[11px] sm:text-xs ${!isBusiness ? 'text-white/80' : 'text-neutral-500'}`}>Freelancer / Solo</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateField('partner_category', 'business')}
                className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2.5 text-left text-sm font-medium transition-all sm:gap-2.5 sm:px-4 sm:py-3 ${
                  isBusiness
                    ? 'border-coral bg-coral text-white shadow-md'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-coral/30'
                }`}
              >
                <Building2 className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold">Business</span>
                  <span className={`block text-[11px] sm:text-xs ${isBusiness ? 'text-white/80' : 'text-neutral-500'}`}>Clinic / Center / Salon</span>
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isBusiness && (
              <div className="sm:col-span-2">
                <Input
                  label="Business / Clinic Name"
                  value={form.business_name}
                  onChange={(event) => updateField('business_name', event.target.value)}
                  placeholder="Pawsome Grooming Studio"
                  required
                  error={fieldError('business_name')}
                />
              </div>
            )}
            <Input
              label={isBusiness ? 'Contact Person Name' : 'Full Name'}
              value={form.full_name}
              onChange={(event) => updateField('full_name', event.target.value)}
              placeholder={isBusiness ? 'Rahul Sharma' : 'Dr. Ananya Rao'}
              required
              error={fieldError('full_name')}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder={isBusiness ? 'info@yourbusiness.com' : 'you@clinic.com'}
              required
              error={fieldError('email')}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Phone Number<span className="ml-1 text-red-500">*</span>
              </label>
              <div className="flex overflow-hidden rounded-xl border border-neutral-200 focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-900/10">
                <span className="inline-flex items-center bg-neutral-50 px-3 text-sm font-semibold text-neutral-700">+91</span>
                <input
                  value={form.phone_number}
                  onChange={(event) => updateField('phone_number', sanitizePhoneNumber(event.target.value))}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  required
                  className="w-full bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
                />
              </div>
              {fieldError('phone_number') ? <p className="text-xs text-red-600">{fieldError('phone_number')}</p> : null}
            </div>
            <Input
              label={isBusiness ? 'Business Type' : 'Provider Type'}
              value={form.provider_type}
              onChange={(event) => updateField('provider_type', event.target.value)}
              placeholder={isBusiness ? 'Grooming Center / Vet Clinic / Boarding' : 'Veterinarian / Groomer / Trainer'}
              required
              error={fieldError('provider_type')}
            />
            <Input
              label="City"
              value={form.city}
              onChange={(event) => updateField('city', event.target.value)}
              placeholder="Bengaluru"
              required
              error={fieldError('city')}
            />
            <Input
              label="State"
              value={form.state}
              onChange={(event) => updateField('state', event.target.value)}
              placeholder="Karnataka"
              required
              error={fieldError('state')}
            />
            <Input
              label={isBusiness ? 'Years in Operation' : 'Years of Experience'}
              type="number"
              min={0}
              max={60}
              value={form.years_of_experience}
              onChange={(event) => updateField('years_of_experience', event.target.value)}
              placeholder="5"
              required
              error={fieldError('years_of_experience')}
            />
            {isBusiness ? (
              <Input
                label="Team Size (Optional)"
                type="number"
                min={1}
                max={500}
                value={form.team_size}
                onChange={(event) => updateField('team_size', event.target.value)}
                placeholder="Number of staff"
                error={fieldError('team_size')}
              />
            ) : (
              <Input
                label="Portfolio / Website (Optional)"
                value={form.portfolio_url}
                onChange={(event) => updateField('portfolio_url', event.target.value)}
                placeholder="https://yourwebsite.com"
                error={fieldError('portfolio_url')}
              />
            )}
          </div>

          {isBusiness && (
            <Input
              label="Portfolio / Website (Optional)"
              value={form.portfolio_url}
              onChange={(event) => updateField('portfolio_url', event.target.value)}
              placeholder="https://yourbusiness.com"
              error={fieldError('portfolio_url')}
            />
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">
              Service Modes <span className="ml-1 text-red-500">*</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICE_MODES.map((mode) => (
                <label
                  key={mode.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-sm text-neutral-700"
                >
                  <input
                    type="checkbox"
                    checked={form.service_modes.includes(mode.id)}
                    onChange={(event) => toggleServiceMode(mode.id, event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  {mode.label}
                </label>
              ))}
            </div>
            {hasAttemptedSubmit && form.service_modes.length === 0 && (
              <p className="text-xs text-red-600">{fieldError('service_modes') ?? 'Select at least one service mode'}</p>
            )}
            {errors.service_modes && form.service_modes.length > 0 ? <p className="text-xs text-red-600">{errors.service_modes}</p> : null}
          </div>

          <Textarea
            label="Areas You Serve"
            value={form.service_areas}
            onChange={(event) => updateField('service_areas', event.target.value)}
            placeholder="Mention localities, pincodes, and your preferred service radius."
            rows={3}
            required
            error={fieldError('service_areas')}
          />

          <Textarea
            label={isBusiness ? 'Why do you want to list your business on Dofurs?' : 'Why do you want to partner with Dofurs?'}
            value={form.motivation}
            onChange={(event) => updateField('motivation', event.target.value)}
            placeholder={isBusiness
              ? 'Tell us about your business, the services you offer, and what makes your center stand out.'
              : 'Share your quality standards, customer commitment, and what makes your service special.'
            }
            rows={4}
            error={fieldError('motivation')}
          />

          <input type="text" name="website" value="" readOnly tabIndex={-1} autoComplete="off" className="hidden" />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting || !isFormReady}>
              {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
              {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /> : null}
            </Button>
            {!isFormReady ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Complete required fields to continue.
              </span>
            ) : null}
          </div>
        </div>

        <aside className="relative space-y-4 overflow-hidden rounded-3xl border border-[#3b2d22] bg-[linear-gradient(135deg,#17120e_0%,#22170f_52%,#15110d_100%)] p-6 text-neutral-100 shadow-2xl shadow-neutral-900/20 md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(228,153,90,0.24),transparent_38%),radial-gradient(circle_at_86%_86%,rgba(122,163,99,0.18),transparent_36%)]" aria-hidden="true" />
          <div className="relative z-10 space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-100/90">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Premium Partner Program
            </p>
            <h3 className="text-2xl font-semibold">Build with demand, not uncertainty</h3>
            <p className="text-sm text-neutral-300">
              Dofurs helps premium providers scale with curated demand, operational tooling, and trust-first branding.
            </p>
          </div>

          <div className="relative z-10 space-y-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Verified Lead Pipeline</p>
              <p className="mt-1 text-xs text-neutral-300">Receive high-intent pet parent requests in your service geography.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Operational Advantage</p>
              <p className="mt-1 text-xs text-neutral-300">Calendar, service visibility, and profile moderation in one admin-ready platform.</p>
            </div>
            {isBusiness && (
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Multi-Staff Management
                </p>
                <p className="mt-1 text-xs text-neutral-300">Add your team, manage individual schedules, and track bookings across all your professionals.</p>
              </div>
            )}
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Growth + Trust Signal</p>
              <p className="mt-1 text-xs text-neutral-300">Position your {isBusiness ? 'center' : 'business'} with a premium, reliability-driven pet care brand.</p>
            </div>
          </div>

          <div className="relative z-10 rounded-2xl border border-emerald-200/25 bg-emerald-500/10 p-4 text-xs text-emerald-100">
            <p className="flex items-center gap-2 font-semibold text-emerald-50">
              <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
              Fast-track review protocol
            </p>
            <p className="mt-2 leading-relaxed text-emerald-100/90">
              Applications with complete profile details, clear service coverage, and portfolio proof are reviewed first.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
