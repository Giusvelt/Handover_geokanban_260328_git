-- Add company_name and phone_number to user_profiles
ALTER TABLE "public"."user_profiles"
ADD COLUMN IF NOT EXISTS "company_name" text,
ADD COLUMN IF NOT EXISTS "phone_number" text;
