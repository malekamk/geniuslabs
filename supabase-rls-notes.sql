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
