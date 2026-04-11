-- Migration: Allow custom provider types
-- Purpose: Convert provider_type from enum to text to support unlimited custom provider types
-- Created: 2026-03-05

begin;

-- Step 1: Add a temporary text column to hold the new values
ALTER TABLE public.providers
ADD COLUMN provider_type_text text;

-- Step 2: Copy existing enum values to the text column (they're compatible)
UPDATE public.providers
SET provider_type_text = provider_type::text
WHERE provider_type IS NOT NULL;

-- Step 3: Drop the old enum column constraint
ALTER TABLE public.providers
DROP COLUMN provider_type;

-- Step 4: Rename the text column to the original name
ALTER TABLE public.providers
RENAME COLUMN provider_type_text TO provider_type;

-- Step 5: Set NOT NULL constraint
ALTER TABLE public.providers
ALTER COLUMN provider_type SET NOT NULL;

-- Step 6: Set default value
ALTER TABLE public.providers
ALTER COLUMN provider_type SET DEFAULT 'groomer';

-- Step 7: Add a check constraint to ensure non-empty values
ALTER TABLE public.providers
ADD CONSTRAINT provider_type_not_empty CHECK (trim(provider_type) != '');

-- Step 8: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_providers_provider_type ON public.providers(provider_type);

commit;
