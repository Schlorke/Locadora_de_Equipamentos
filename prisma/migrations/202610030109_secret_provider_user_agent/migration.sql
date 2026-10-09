-- Isolated commit: PostgreSQL requires a new enum value to commit before use.
ALTER TYPE "SecretPurpose" ADD VALUE IF NOT EXISTS 'PROVIDER_USER_AGENT';
