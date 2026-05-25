-- =============================================================================
-- Security Advisor fix — Public SELECT policy on coach-* buckets
-- =============================================================================
-- Resolves 1 Lovable Supabase Advisor warning:
--
-- #6 — Public buckets (coach-logos, coach-avatars, coach-branding) have no
--    public SELECT policy, but coach SELECT policies are scope-limited
--
-- Background:
--   Migrations 20260116205522 and 20260116210649 created the three buckets
--   with `public = true`, intended for use across the app (coach avatar in
--   chat headers, logo on athlete dashboard, branding on athlete landing).
--   The original migrations also created `Anyone can view ...` SELECT
--   policies that allowed any role (including anon) to read.
--
--   Migration 20260421072045 then DROPPED those public SELECT policies and
--   replaced them with `Coaches can list own X` (scope-limited to
--   `auth.uid()::text = (storage.foldername(name))[1]`). The author's
--   comment said: "Public file FETCHES still work via the CDN/public URL;
--   this only blocks `.list()` enumeration." That's true for unsigned
--   public-URL GETs going through the CDN, but Supabase Advisor still
--   flags the mismatch because:
--     - The bucket is marked `public = true` (advertising public access).
--     - The only SELECT policy is restrictive (denying it).
--   Athletes (authenticated, NOT the owning coach) can therefore not
--   `.list()` to discover files, but they ALSO can't read via the
--   Supabase REST API (which honors RLS). The CDN fetch is a side-channel
--   that works regardless — relying on it is fragile and inconsistent.
--
-- After this migration:
--   - A public SELECT policy explicitly authorizes anyone to read files
--     in coach-logos, coach-avatars, coach-branding (matching the
--     `public = true` bucket flag).
--   - The existing "Coaches can list own X" policies stay — they're now
--     redundant for SELECT (any role can read), but they convey intent
--     and would matter if the bucket flag is flipped to private later.
--   - INSERT / UPDATE / DELETE policies (folder-based ownership) are
--     untouched. Only the owning coach can mutate their own files.
--
-- Strategy: explicit `TO public` grant on a narrow set of bucket_ids.
-- Names chosen to be searchable and distinct from the legacy
-- "X are publicly viewable" names that the 20260421072045 migration
-- dropped, so future audits can clearly trace this back to the
-- Security Advisor fix.
-- =============================================================================

CREATE POLICY "Public can view coach-logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'coach-logos');

CREATE POLICY "Public can view coach-avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'coach-avatars');

CREATE POLICY "Public can view coach-branding"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'coach-branding');
