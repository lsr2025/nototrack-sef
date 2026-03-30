-- ============================================================
-- NotoTrack: Step 3 – GPS Coordinate Updates
-- Generated: 2026-03-30T21:46:36.950397
-- Auto-matched: 3 shops (score ≥ 72%)
-- Manual review: 135 coords in gps_review.csv
-- ============================================================

BEGIN;

-- KwaJIM (score: 0.92)
UPDATE public.assessments
  SET gps_lat = -29.211189, gps_lng = 31.151531
  WHERE gps_lat IS NULL
    AND LOWER(shop_name) = LOWER('KwaJIM');

-- Gasela (score: 0.80)
UPDATE public.assessments
  SET gps_lat = -29.528112, gps_lng = 30.94734
  WHERE gps_lat IS NULL
    AND LOWER(shop_name) = LOWER('Gasela');

-- KwaMfeka Store (score: 0.75)
UPDATE public.assessments
  SET gps_lat = -29.588116, gps_lng = 30.851511
  WHERE gps_lat IS NULL
    AND LOWER(shop_name) = LOWER('KwaMfeka Store');

COMMIT;
