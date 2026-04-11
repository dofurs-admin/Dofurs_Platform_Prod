'use client';

import FormField from '@/components/dashboard/FormField';
import type { PassportDraft } from './types';
import { normalizePhoneInput } from './utils';

type Props = {
  emergencyInfo: PassportDraft['emergencyInfo'];
  onEmergencyFieldChange: <K extends keyof PassportDraft['emergencyInfo']>(
    key: K,
    value: PassportDraft['emergencyInfo'][K],
    capitalize?: boolean,
  ) => void;
  onEmergencyPhoneChange: (key: 'emergencyContactPhone' | 'preferredVetPhone', value: string) => void;
  onEmergencyPhoneBlur: (key: 'emergencyContactPhone' | 'preferredVetPhone', value: string) => void;
  getFieldError: (path: string) => string | null;
};

export default function EmergencyStep({
  emergencyInfo,
  onEmergencyFieldChange,
  onEmergencyPhoneChange,
  onEmergencyPhoneBlur,
  getFieldError,
}: Props) {
  return (
    <>
      <FormField
        label="Emergency contact name"
        value={emergencyInfo.emergencyContactName}
        onChange={(event) => onEmergencyFieldChange('emergencyContactName', event.target.value, true)}
      />
      <FormField
        label="Emergency contact phone"
        value={emergencyInfo.emergencyContactPhone}
        onChange={(event) => onEmergencyPhoneChange('emergencyContactPhone', event.target.value)}
        onBlur={(event) => onEmergencyPhoneBlur('emergencyContactPhone', normalizePhoneInput(event.target.value))}
        error={getFieldError('emergencyInfo.emergencyContactPhone') ?? undefined}
      />
      <FormField
        label="Preferred vet clinic"
        value={emergencyInfo.preferredVetClinic}
        onChange={(event) => onEmergencyFieldChange('preferredVetClinic', event.target.value, true)}
      />
      <FormField
        label="Preferred vet phone"
        value={emergencyInfo.preferredVetPhone}
        onChange={(event) => onEmergencyPhoneChange('preferredVetPhone', event.target.value)}
        onBlur={(event) => onEmergencyPhoneBlur('preferredVetPhone', normalizePhoneInput(event.target.value))}
        error={getFieldError('emergencyInfo.preferredVetPhone') ?? undefined}
      />
    </>
  );
}
