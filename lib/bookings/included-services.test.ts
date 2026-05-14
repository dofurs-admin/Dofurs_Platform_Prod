import { describe, expect, it } from 'vitest';
import {
  extractBundledPetIdsFromNotes,
  extractIncludedServicesFromNotes,
  extractProviderServiceIdsFromNotes,
  countServiceUnitsForBooking,
  resolveIncludedServicesForBooking,
} from './included-services';

describe('extractProviderServiceIdsFromNotes', () => {
  it('extracts service ids from numbered bundle lines', () => {
    const note = [
      'Bundled services (2)',
      '1. Pet 12 | Service 09925f69-b83b-4116-9a7c-7a3bd632187e | Start 09:00',
      '2. Pet 12 | 9e901ef9-f4d7-4f6f-9022-d4ccab34beb7 | Start 09:58',
    ].join('\n');

    expect(extractProviderServiceIdsFromNotes(note)).toEqual([
      '09925f69-b83b-4116-9a7c-7a3bd632187e',
      '9e901ef9-f4d7-4f6f-9022-d4ccab34beb7',
    ]);
  });
});

describe('extractBundledPetIdsFromNotes', () => {
  it('extracts bundled pet ids from numbered bundle lines', () => {
    const note = [
      'Bundled services (3)',
      '1. Pet 81 | Doorstep Pet Grooming (Basic Package)',
      '2. Pet 14 | Summer Bonanza (Offer Package)',
      '3. Pet 81 | Add-on Nail Clipping',
    ].join('\n');

    expect(extractBundledPetIdsFromNotes(note)).toEqual([81, 14, 81]);
  });

  it('returns empty array when bundle lines are missing', () => {
    expect(extractBundledPetIdsFromNotes('No bundled metadata')).toEqual([]);
  });
});

describe('extractIncludedServicesFromNotes', () => {
  it('preserves repeated bundled service lines', () => {
    const note = [
      'Bundled services (2)',
      '1. Pet 81 | Doorstep Pet Grooming (Basic Package)',
      '2. Pet 81 | Doorstep Pet Grooming (Basic Package)',
    ].join('\n');

    expect(extractIncludedServicesFromNotes(note)).toEqual([
      'Doorstep Pet Grooming (Basic Package)',
      'Doorstep Pet Grooming (Basic Package)',
    ]);
  });

  it('resolves service ids to service names when mapping is provided', () => {
    const note = [
      'Bundled services (2)',
      '1. Pet 81 | Service 09925f69-b83b-4116-9a7c-7a3bd632187e',
      '2. Pet 81 | Service 9e901ef9-f4d7-4f6f-9022-d4ccab34beb7',
    ].join('\n');

    const names = new Map<string, string>([
      ['09925f69-b83b-4116-9a7c-7a3bd632187e', 'Doorstep Pet Grooming (Basic Package)'],
      ['9e901ef9-f4d7-4f6f-9022-d4ccab34beb7', 'Summer Bonanza (Offer Package)'],
    ]);

    expect(
      extractIncludedServicesFromNotes(note, {
        serviceNameByProviderServiceId: names,
      }),
    ).toEqual([
      'Doorstep Pet Grooming (Basic Package)',
      'Summer Bonanza (Offer Package)',
    ]);
  });
});

describe('resolveIncludedServicesForBooking', () => {
  it('prefers explicit included_services when present', () => {
    const booking = {
      included_services: [
        'Summer Bonanza (Offer Package)',
        '  Doorstep Pet Grooming (Basic Package)  ',
        '',
      ],
      service_type: 'Doorstep Pet Grooming (Basic Package)',
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Doorstep Pet Grooming (Basic Package)',
        '2. Pet 81 | Doorstep Pet Grooming (Basic Package)',
      ].join('\n'),
      internal_notes: null,
      provider_service_id: '09925f69-b83b-4116-9a7c-7a3bd632187e',
      admin_price_reference: 1798,
      price_at_booking: 1798,
    };

    expect(resolveIncludedServicesForBooking(booking)).toEqual([
      'Summer Bonanza (Offer Package)',
      'Doorstep Pet Grooming (Basic Package)',
    ]);
  });

  it('prefers provider notes when available', () => {
    const booking = {
      service_type: 'Doorstep Pet Grooming (Basic Package)',
      provider_notes: [
        'Bundled services (2)',
        '1. Pet 81 | Doorstep Pet Grooming (Basic Package)',
        '2. Pet 81 | Summer Bonanza (Offer Package)',
      ].join('\n'),
      internal_notes: null,
      provider_service_id: '09925f69-b83b-4116-9a7c-7a3bd632187e',
      admin_price_reference: 1798,
      price_at_booking: 1798,
    };

    expect(resolveIncludedServicesForBooking(booking)).toEqual([
      'Doorstep Pet Grooming (Basic Package)',
      'Summer Bonanza (Offer Package)',
    ]);
  });

  it('infers repeated primary service count when notes are missing and price ratio is exact', () => {
    const booking = {
      service_type: 'Doorstep Pet Grooming (Basic Package)',
      provider_notes: null,
      internal_notes: null,
      provider_service_id: '09925f69-b83b-4116-9a7c-7a3bd632187e',
      admin_price_reference: 1798,
      price_at_booking: 1798,
    };

    const basePriceByServiceId = new Map<string, number>([
      ['09925f69-b83b-4116-9a7c-7a3bd632187e', 899],
    ]);

    expect(
      resolveIncludedServicesForBooking(booking, {
        serviceBasePriceByProviderServiceId: basePriceByServiceId,
      }),
    ).toEqual([
      'Doorstep Pet Grooming (Basic Package)',
      'Doorstep Pet Grooming (Basic Package)',
    ]);
  });

  it('falls back to one primary service when ratio cannot be inferred', () => {
    const booking = {
      service_type: 'Doorstep Pet Grooming (Basic Package)',
      provider_notes: null,
      internal_notes: null,
      provider_service_id: '09925f69-b83b-4116-9a7c-7a3bd632187e',
      admin_price_reference: 950,
      price_at_booking: 950,
    };

    const basePriceByServiceId = new Map<string, number>([
      ['09925f69-b83b-4116-9a7c-7a3bd632187e', 899],
    ]);

    expect(
      resolveIncludedServicesForBooking(booking, {
        serviceBasePriceByProviderServiceId: basePriceByServiceId,
      }),
    ).toEqual(['Doorstep Pet Grooming (Basic Package)']);
  });
});

describe('countServiceUnitsForBooking', () => {
  it('counts each bundled service line represented by one booking row', () => {
    expect(
      countServiceUnitsForBooking({
        service_type: 'Doorstep Pet Grooming (Basic Package)',
        provider_notes: [
          'Bundled services (3)',
          '1. Pet 81 | Doorstep Pet Grooming (Basic Package)',
          '2. Pet 82 | Summer Bonanza (Offer Package)',
          '3. Pet 83 | Vet Consultation',
        ].join('\n'),
      }),
    ).toBe(3);
  });
});
