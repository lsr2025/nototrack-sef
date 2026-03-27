-- ============================================================
-- NotoTrack: Step 1 – Schema Migration
-- Run this FIRST in the Supabase SQL editor before importing data.
-- All statements are idempotent (safe to run multiple times).
-- ============================================================

-- ── 1. Add missing columns to public.assessments ─────────────

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS municipality     TEXT,
  ADD COLUMN IF NOT EXISTS ward_no          TEXT,
  ADD COLUMN IF NOT EXISTS fieldworker_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,

  -- Registration
  ADD COLUMN IF NOT EXISTS cipc_number      TEXT,
  ADD COLUMN IF NOT EXISTS bank_name        TEXT,
  ADD COLUMN IF NOT EXISTS has_coa          BOOLEAN,
  ADD COLUMN IF NOT EXISTS coa_number       TEXT,

  -- Infrastructure
  ADD COLUMN IF NOT EXISTS years_operating  TEXT,
  ADD COLUMN IF NOT EXISTS structure_type   TEXT,
  ADD COLUMN IF NOT EXISTS store_size       TEXT,
  ADD COLUMN IF NOT EXISTS storage          TEXT[],
  ADD COLUMN IF NOT EXISTS products         TEXT[],

  -- General Hygiene
  ADD COLUMN IF NOT EXISTS cleanliness_ok   BOOLEAN,
  ADD COLUMN IF NOT EXISTS waste_ok         BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_dust          BOOLEAN,
  ADD COLUMN IF NOT EXISTS handwashing      BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_animals       BOOLEAN,
  ADD COLUMN IF NOT EXISTS hygiene_other    TEXT,

  -- Food Safety
  ADD COLUMN IF NOT EXISTS food_on_floor           BOOLEAN,
  ADD COLUMN IF NOT EXISTS expired_food            BOOLEAN,
  ADD COLUMN IF NOT EXISTS food_labelled           BOOLEAN,
  ADD COLUMN IF NOT EXISTS food_nonfood_separated  BOOLEAN,
  ADD COLUMN IF NOT EXISTS food_safety_other       TEXT,

  -- General & Safety
  ADD COLUMN IF NOT EXISTS lighting_ok         BOOLEAN,
  ADD COLUMN IF NOT EXISTS floors_ok           BOOLEAN,
  ADD COLUMN IF NOT EXISTS cleaning_materials  BOOLEAN,
  ADD COLUMN IF NOT EXISTS safety_signage      BOOLEAN,
  ADD COLUMN IF NOT EXISTS disability_accessible BOOLEAN,
  ADD COLUMN IF NOT EXISTS not_sleeping_space  BOOLEAN,
  ADD COLUMN IF NOT EXISTS yms_observations    TEXT,

  -- Business Development
  ADD COLUMN IF NOT EXISTS payment_methods   TEXT[],
  ADD COLUMN IF NOT EXISTS has_pos           BOOLEAN,
  ADD COLUMN IF NOT EXISTS ordering_methods  TEXT[],
  ADD COLUMN IF NOT EXISTS makes_deliveries  BOOLEAN,
  ADD COLUMN IF NOT EXISTS click_collect     BOOLEAN,
  ADD COLUMN IF NOT EXISTS collection_point  TEXT[],
  ADD COLUMN IF NOT EXISTS space_security    BOOLEAN,
  ADD COLUMN IF NOT EXISTS monthly_turnover  TEXT,
  ADD COLUMN IF NOT EXISTS num_employees     INTEGER,
  ADD COLUMN IF NOT EXISTS support_needed    TEXT[],

  -- NEF Eligibility (Section E)
  ADD COLUMN IF NOT EXISTS sa_citizen          BOOLEAN,
  ADD COLUMN IF NOT EXISTS registered_cipc_nef BOOLEAN,
  ADD COLUMN IF NOT EXISTS willing_bank        BOOLEAN,
  ADD COLUMN IF NOT EXISTS willing_sars        BOOLEAN,
  ADD COLUMN IF NOT EXISTS valid_coa_nef       BOOLEAN,
  ADD COLUMN IF NOT EXISTS fixed_structure     BOOLEAN,
  ADD COLUMN IF NOT EXISTS in_operation_6m     BOOLEAN,
  ADD COLUMN IF NOT EXISTS hygiene_compliant   BOOLEAN,
  ADD COLUMN IF NOT EXISTS willing_training    BOOLEAN,
  ADD COLUMN IF NOT EXISTS growth_potential    BOOLEAN,
  ADD COLUMN IF NOT EXISTS nef_score           INTEGER,

  -- Documents & Signatures
  ADD COLUMN IF NOT EXISTS additional_notes    TEXT,
  ADD COLUMN IF NOT EXISTS photo_front_url     TEXT,
  ADD COLUMN IF NOT EXISTS photo_interior_url  TEXT,
  ADD COLUMN IF NOT EXISTS photo_id_url        TEXT,
  ADD COLUMN IF NOT EXISTS doc_coa_url         TEXT,
  ADD COLUMN IF NOT EXISTS doc_bank_url        TEXT,
  ADD COLUMN IF NOT EXISTS doc_other_url       TEXT,
  ADD COLUMN IF NOT EXISTS agent_signature     TEXT,
  ADD COLUMN IF NOT EXISTS owner_signature     TEXT,
  ADD COLUMN IF NOT EXISTS declaration_agreed  BOOLEAN DEFAULT FALSE;

-- ── 2. Make agent_id nullable (imported records have no auth user) ──

ALTER TABLE public.assessments
  ALTER COLUMN agent_id DROP NOT NULL;

-- Also allow agent_id to be NULL (drop FK constraint if it blocks NULLs)
-- The FK still works for non-null values; NULL simply means "imported record"

-- ── 3. Create the MS Forms system import user ──────────────────
-- This user is assigned as the agent for all imported records.
-- It has no auth account and cannot log in.

INSERT INTO public.users (
  id, email, employee_id, full_name, role, role_tier, workstream, municipality, locality
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'msforms-import@nototrack.co.za',
  'YMS-IMPORT-000',
  'MS Forms Import',
  'System',
  1,
  'A',
  'Enterprise iLembe',
  'Import'
)
ON CONFLICT DO NOTHING;

-- ── 4. Add submitted_at index for dashboard performance ─────────

CREATE INDEX IF NOT EXISTS idx_assessments_submitted_at
  ON public.assessments (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessments_municipality
  ON public.assessments (municipality);

-- ── Done ─────────────────────────────────────────────────────────
-- Now run scripts/step2_import_data.sql
-- ============================================================
