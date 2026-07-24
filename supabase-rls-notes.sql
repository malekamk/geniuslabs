-- ============================================================
-- Genius Lab — Supabase RLS policies that must exist in prod
-- Run these in the Supabase SQL editor if guardian sees
-- an empty "My Learners" list despite enrolling a learner.
-- ============================================================

-- Allow a guardian to read their own learners (by guardian_id)
CREATE POLICY "Guardian reads own learners"
  ON learners FOR SELECT
  TO authenticated
  USING (guardian_id = auth.uid());

-- Allow a guardian to read enrolment applications they submitted
CREATE POLICY "Guardian reads own applications"
  ON enrolment_applications FOR SELECT
  TO authenticated
  USING (guardian_profile_id = auth.uid());

-- Allow authenticated users to read all profiles (needed for tutor names in chat)
-- Already applied previously; included here for reference
CREATE POLICY "Authenticated read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow chat room UPDATE (needed for upsert in notification-context)
CREATE POLICY "Authenticated update chat rooms"
  ON chat_rooms FOR UPDATE
  TO authenticated
  USING (true);

-- Allow push_token column update on own profile
CREATE POLICY "User updates own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- Gallery table — run once in SQL editor
-- ============================================================
CREATE TABLE IF NOT EXISTS gallery (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text        NOT NULL,
  caption    text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read gallery"
  ON gallery FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin insert gallery"
  ON gallery FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Background push notifications (Fix 10)
-- After deploying the Edge Function below, add a DB trigger:
--
--   CREATE OR REPLACE FUNCTION notify_push()
--   RETURNS trigger LANGUAGE plpgsql AS $$
--   DECLARE token text;
--   BEGIN
--     SELECT push_token INTO token FROM profiles WHERE id = NEW.profile_id;
--     IF token IS NOT NULL THEN
--       PERFORM net.http_post(
--         url := current_setting('app.push_url'),
--         body := json_build_object(
--           'push_token', token,
--           'title', NEW.title,
--           'body', NEW.body,
--           'data', NEW.data
--         )::text,
--         headers := '{"Content-Type":"application/json"}'::jsonb
--       );
--     END IF;
--     RETURN NEW;
--   END; $$;
--
--   CREATE TRIGGER on_notification_insert
--     AFTER INSERT ON notifications
--     FOR EACH ROW EXECUTE FUNCTION notify_push();
--
-- Set app.push_url = 'https://<project-ref>.supabase.co/functions/v1/send-push'
-- in the Supabase dashboard → Settings → Configuration.
-- ============================================================

-- ============================================================
-- Storage buckets for file uploads
-- Run in Supabase dashboard → SQL editor
-- ============================================================

-- Materials bucket (public — learners download files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload to materials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materials');

CREATE POLICY "Public read materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materials');

-- Enrolment documents bucket (public URL, guardian-uploaded)
INSERT INTO storage.buckets (id, name, public)
VALUES ('enrolment-docs', 'enrolment-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload to enrolment-docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'enrolment-docs');

CREATE POLICY "Public read enrolment-docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'enrolment-docs');

-- ============================================================
-- Chat read receipts ("Seen by") — run this in the Supabase SQL
-- editor to enable chat read receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_room_reads (
  chat_room_id  uuid        NOT NULL REFERENCES chat_rooms(id),
  profile_id    uuid        NOT NULL REFERENCES profiles(id),
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_room_id, profile_id)
);

ALTER TABLE chat_room_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read all chat room reads"
  ON chat_room_reads FOR SELECT TO authenticated USING (true);

CREATE POLICY "User upserts own chat room read"
  ON chat_room_reads FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "User updates own chat room read"
  ON chat_room_reads FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());

-- ============================================================
-- Prevent privilege escalation via self-service profile writes
-- (profiles.role must be settable only by the admin-create-user Edge
-- Function, via the service_role key — never by a user's own session)
--
-- Run the verification query FIRST:
--   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles';
-- Skip the final INSERT policy below if one already exists for profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- The admin-create-user Edge Function calls Postgres with the service
  -- role key, which carries role='service_role' — the only caller allowed
  -- to set profiles.role to 'tutor'/'admin'.
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    -- A normal self-service profile update (phone, subjects, grades, bio,
    -- push_token, avatar_url, etc.) can never change an existing role —
    -- silently pin it back so a benign upsert resending the same role
    -- still succeeds.
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- First-time self-service row creation (complete-profile.tsx's upsert,
    -- if no row exists yet) may only ever create guardian/learner.
    IF NEW.role NOT IN ('guardian', 'learner') THEN
      RAISE EXCEPTION 'role % is not self-assignable', NEW.role;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- NOT applied — live check showed an existing "Own profile" ALL policy
-- (qual/with_check: auth.uid() = id) already covers UPDATE and INSERT for
-- a user's own row with correct ownership scoping. Editing/adding the two
-- policies below would have been redundant (RLS policies are OR'd — the
-- "Own profile" policy grants the same access independently either way).
-- The trigger above is the actual fix; these are left here only so a
-- future reader doesn't wonder why they're missing.
--
-- DROP POLICY IF EXISTS "User updates own profile" ON profiles;
-- CREATE POLICY "User updates own profile" ON profiles FOR UPDATE
--   TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
--
-- CREATE POLICY "User inserts own profile" ON profiles FOR INSERT
--   TO authenticated WITH CHECK (id = auth.uid());

-- ============================================================
-- Guardian-invites-learner: replaces fragile name-matching linking
-- (learner self-signup + link_learner_account RPC) with a deterministic,
-- ID-based invite flow — see supabase/functions/guardian-invite-learner
-- and src/app/(tabs)/profile.tsx. APPLIED.
-- ============================================================

-- Lets a guardian check invite/link status for their own learners without
-- exposing auth.users directly to the client. Status derives from Auth's
-- own last_sign_in_at — no second source of truth to keep in sync.
CREATE OR REPLACE FUNCTION public.learner_invite_statuses(p_learner_ids uuid[])
RETURNS TABLE(learner_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  RETURN QUERY
  SELECT l.id,
    CASE
      WHEN l.profile_id IS NULL THEN 'not_invited'
      WHEN u.last_sign_in_at IS NULL THEN 'invited_pending'
      ELSE 'linked'
    END
  FROM public.learners l
  LEFT JOIN auth.users u ON u.id = l.profile_id
  WHERE l.id = ANY(p_learner_ids) AND l.guardian_id = auth.uid();
END; $$;

-- Cheap insurance against a double-invite race linking two different auth
-- users to the same learner row.
ALTER TABLE learners ADD CONSTRAINT learners_profile_id_key UNIQUE (profile_id);

-- Run once both signup.tsx and complete-profile.tsx no longer call it:
--   SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'link_learner_account';
-- then drop with the exact signature returned above, e.g.:
--   DROP FUNCTION IF EXISTS link_learner_account(text, text, uuid);

-- Once no UI path self-assigns 'learner' either, tighten the INSERT branch
-- of trg_prevent_role_self_escalation (defined earlier in this file) from
-- `NEW.role NOT IN ('guardian', 'learner')` to `NEW.role <> 'guardian'`.
-- APPLIED (both above are done).

-- ============================================================
-- Temp-password provisioning: replaces the email-invite-link flow for
-- admin-create-user and guardian-invite-learner. No email link, no deep
-- link, no redirect config to manage — the new user just signs in normally
-- with a generated temp password, then is forced to set a real one via
-- src/app/auth/set-password.tsx before reaching the rest of the app.
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- ============================================================
-- Account deletion (Apple 5.1.1(v) / Google Play account deletion policy)
-- Deploy: supabase functions deploy delete-account
--
-- The function anonymizes profiles/learners PII and calls
-- auth.admin.deleteUser() — it does NOT touch payments, classes, chat
-- messages, or quiz_attempts, since those are shared/legal-record tables
-- (deleting them would corrupt other users' chat history and destroy
-- financial records POPIA/tax law expect retained). No RLS policy is
-- needed for it since it runs entirely with the service_role key.
--
-- If a future review flags orphaned-but-identifiable data in tables not
-- covered above, extend supabase/functions/delete-account/index.ts rather
-- than adding it here.
-- ============================================================

-- ============================================================
-- profiles.email — admin Users list (src/app/(tabs)/admin-users.tsx) needs
-- to show each user's email, but email lives in auth.users, which the
-- client can't read directly (no client-side join across schemas). Mirror
-- it onto profiles instead: a SECURITY DEFINER trigger fills it in on every
-- future insert (covers signup.tsx, admin-create-user,
-- guardian-invite-learner — anywhere a profiles row gets created), and the
-- UPDATE below backfills every row that already exists.
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON profiles;
CREATE TRIGGER trg_sync_profile_email
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- One-time backfill for rows created before this trigger existed
UPDATE profiles SET email = u.email
FROM auth.users u
WHERE u.id = profiles.id AND profiles.email IS NULL;

-- ============================================================
-- admin_dashboard_stats — src/screens/admin-dashboard.tsx was firing 11
-- separate round trips on mount (Promise.all of counts + raw payment rows
-- reduced client-side). Collapsed into one SQL function: every count/sum
-- is computed server-side with aggregates, the revenue sparkline is a
-- running-sum window function instead of summing rows in JS, and the
-- "recent" lists are returned inline as JSON — one round trip total.
-- admin-only: raises if the caller isn't an admin, since this bypasses RLS
-- (SECURITY DEFINER) to aggregate across every user's data.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(p_mtd text, p_prev_mtd text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT json_build_object(
    'learners', (SELECT count(*) FROM learners),
    'tutors', (SELECT count(*) FROM profiles WHERE role = 'tutor' AND is_active = true),
    'pending_apps', (SELECT count(*) FROM enrolment_applications WHERE status = 'pending'),
    'revenue_mtd', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'paid' AND period_month = p_mtd),
    'prev_revenue', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'paid' AND period_month = p_prev_mtd),
    'outstanding', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status IN ('pending', 'overdue')),
    'total_attempts', (SELECT count(*) FROM quiz_attempts WHERE status = 'completed'),
    'passed_attempts', (SELECT count(*) FROM quiz_attempts WHERE status = 'completed' AND passed = true),
    'classes_total', (SELECT count(*) FROM classes),
    'sparkline', (
      SELECT coalesce(json_agg(cum ORDER BY paid_at), '[]'::json)
      FROM (
        SELECT paid_at, sum(amount) OVER (ORDER BY paid_at) AS cum
        FROM payments
        WHERE status = 'paid' AND paid_at IS NOT NULL AND period_month = p_mtd
      ) t
    ),
    'recent_apps', (
      SELECT coalesce(json_agg(row_to_json(a)), '[]'::json)
      FROM (
        SELECT id, learner_name, grade, status, submitted_at, updated_at
        FROM enrolment_applications
        ORDER BY updated_at DESC
        LIMIT 5
      ) a
    ),
    'recent_payments', (
      SELECT coalesce(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT id, amount, status, type, created_at, updated_at
        FROM payments
        ORDER BY updated_at DESC
        LIMIT 5
      ) p
    )
  ) INTO result;

  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(text, text) TO authenticated;
