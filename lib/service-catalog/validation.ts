import { z } from 'zod';

export const calculatePriceSchema = z
  .object({
    bookingType: z.literal('service').optional(),
    serviceId: z.string().uuid(),
    providerId: z.union([z.string().min(1), z.number().int().positive()]),
    addOns: z
      .array(
        z.object({
          id: z.string().uuid(),
          quantity: z.number().int().positive().max(20),
        }),
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.bookingType && value.bookingType !== 'service') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Only service bookings are supported', path: ['bookingType'] });
    }
  });
