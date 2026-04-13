import { z } from 'zod';

const noHtmlChars = (val: string) => !/<|>|&lt;|&gt;|javascript:/i.test(val);

export const customerProviderReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z
    .string()
    .trim()
    .max(3000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Review text must not contain HTML or script characters' })
    .optional(),
});

export const customerServiceFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  notes: z
    .string()
    .trim()
    .max(4000)
    .refine((v) => !v || noHtmlChars(v), { message: 'Notes must not contain HTML or script characters' })
    .optional(),
});
