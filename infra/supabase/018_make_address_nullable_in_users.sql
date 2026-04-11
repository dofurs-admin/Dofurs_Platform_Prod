-- Migration: Ensure address is required in users table
-- Purpose: All users must have an address (core user data)
-- Status: Verify constraint exists; if not, add it
-- Created: 2026-03-05

BEGIN;

-- Check and ensure address column is NOT NULL
ALTER TABLE public.users
ALTER COLUMN address SET NOT NULL;

-- Add constraint name if not already named
-- This ensures data integrity across all user types
-- Note: If this fails, address column may already have the constraint

COMMIT;
