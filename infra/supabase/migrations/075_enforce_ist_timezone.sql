-- Ensure platform timestamps resolve in Indian Standard Time (IST).
-- This keeps NOW()/CURRENT_TIMESTAMP and timestamptz rendering aligned to Asia/Kolkata.

ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['postgres', 'authenticator', 'authenticated', 'anon', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('ALTER ROLE %I SET timezone TO ''Asia/Kolkata''', role_name);
    END IF;
  END LOOP;
END;
$$;
