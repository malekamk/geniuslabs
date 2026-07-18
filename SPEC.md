# Genius Lab — Product & Technical Spec

Mobile app for Ravhuyani Genius Lab (an after-school/tutoring centre). Built with Expo + React Native, backed by Supabase. This doc reflects what the app **actually does today**, not the original MVP pitch.

---

## 1. Who uses it

| Role | Who they are |
|---|---|
| **Guardian** | Parent/caregiver. Enrolls a child, pays fees, gets announcements, chats with tutors. |
| **Learner** | The student. Views classes, materials, chats with their class group. |
| **Tutor** | Teaches subjects. Creates classes, uploads materials, chats with students. |
| **Admin** | Runs the centre. Approves enrolments, tracks payments, manages users/content. |

One person can only hold one role at a time (set once, right after signup).

---

## 2. How it works — story flows (plain English)

### 🧑‍🦱 Guardian journey
1. Downloads the app, signs up with email/password **or** "Continue with Google/Apple".
2. First time in, picks their role ("I'm a Guardian") — a one-time question.
3. Fills in the **Enrol a Learner** form: child's name, DOB, school, grade, which subjects, uploads ID/birth certificate + latest school report, ticks a consent box.
4. Waits for Admin to review. Gets a push notification the moment it's **approved** or **rejected**.
5. Once approved, gets a **Yoco card payment** link inside the app to pay tuition/assessment fees — never leaves the app, pays by card, sees "Paid" reflected within seconds.
6. From then on: sees the child's **Classes** (upcoming/live/history), can tap a live class to join a video call, gets **Announcements** as push notifications, can join the subject's **group chat** to message the tutor and other parents/students, browses the **Gallery** of centre photos.
7. If a second child enrols, the guardian can link/manage both from Programmes.

### 🎓 Learner journey
1. Either signs up directly, or a guardian's enrolment auto-creates their learner record, which they later claim by picking "Learner" at signup and getting linked to it.
2. Sees a personalised **Classes** tab — only the subjects/grade they're enrolled in.
3. Taps a live class → opens a video call for that lesson.
4. **Tasks** tab shows study **Materials** (PDFs, videos, worksheets, past papers) the tutor has published for their grade/subject; can mark each as in-progress/done.
5. Joins the **Chat** group for each enrolled subject — it's a class-wide group chat with their tutor and classmates, not 1:1 messaging.
6. Gets a badge/notification whenever a new material, class, or chat message arrives.

### 👩‍🏫 Tutor journey
1. Signs up, is set up as a Tutor (by admin, via role).
2. Sees classes for the subjects/grades they teach — can **create** a new class (date/time), which auto-reminds enrolled learners and schedules the tutor's own reminder.
3. Uploads **Materials** for their subject (a file or a link, e.g. YouTube/Drive).
4. Chats with their class group.
5. (Quiz builder exists and is fully working under the hood, but is currently hidden from the Tasks screen — see §6.)

### 🛠️ Admin journey
1. Logs in to an **Admin Dashboard**: live counts of learners/tutors, pending applications, this month's revenue vs outstanding fees, class count, quiz pass rate.
2. **Enrolments**: reviews each application (documents, subjects, guardian info), adds notes, and moves it through Pending → Reviewing → Approved/Rejected. Guardian is notified automatically at each decision.
3. **Payments**: sees every payment (paid/pending/overdue), totals, and can manually mark one as "Paid" if a parent paid by EFT/cash outside the app.
4. **Learners**: full searchable roster, can activate/deactivate a learner.
5. **Users**: manage Guardians/Tutors/Learners, activate/deactivate accounts.
6. **Content**: publish/unpublish Materials, create/delete Classes, upload/delete Gallery photos.
7. **Announcements**: writes a broadcast (title, body, target role) that instantly pushes a notification to everyone it targets.

---

## 3. Technical architecture

**Stack**: Expo SDK 54 (managed, Expo Router file-based navigation) · React Native 0.81 · TypeScript · NativeWind (Tailwind) · Supabase (Postgres + Auth + Storage + Realtime + Edge Functions, Deno).

**Auth** (`src/context/auth-context.tsx`, `src/app/auth/*`)
- Email/password and Google/Apple OAuth (via `expo-auth-session` browser redirect through Supabase Auth — no native OAuth SDK).
- OAuth users hit a one-time **complete-profile** screen to pick a role, since OAuth skips the signup form's role field.
- Roles stored on `profiles.role`: `guardian | learner | tutor | admin`. Route guards in `src/app/_layout.tsx` redirect based on role (e.g. non-admins can't reach `/admin/*`).
- Admins have an impersonation ("login as") capability in state, for support/debugging.

**Payments** (Yoco, South African card processor)
1. App calls the `create-checkout` edge function with the learner + amount → function verifies the caller owns that learner, writes a `pending` row to `payments`, asks Yoco for a hosted checkout URL.
2. App opens that URL in an in-app WebView (`payment-webview.tsx`).
3. On completion, Yoco redirects to a `geniuslabs://payment-return` deep link — the app **doesn't trust this directly**, it calls `verify-payment`, which re-checks the real status straight from Yoco's API before updating the DB.
4. In parallel, Yoco also calls the `payment-webhook` edge function directly (server-to-server), which verifies Yoco's HMAC-SHA256 signature (timing-safe, 5-min timestamp tolerance) before marking `payments` paid/failed — this is the source of truth even if the user closes the app mid-payment.
5. Admins can also flip a payment to "Paid" manually (for cash/EFT).

**Live classes**: not embedded video — tapping "Join" opens `https://meet.jit.si/<room>` (public Jitsi Meet) in the device browser. "Live now" is just a computed time window around the scheduled start, not a real presence check.

**Chat**: Supabase Realtime on `chat_room_messages`. Rooms are keyed by subject+grade (group chat per class, not DMs). A background subscription keeps unread badges/push working app-wide regardless of which screen is open.

**Notifications**: Expo push tokens stored on `profiles.push_token`. Admin actions (approve/reject enrolment, mark paid, publish material, new class, announcement) call a `send-push` edge function (using the service-role key) which writes a `notifications` row and forwards to Expo's push API. No delivery-receipt/retry handling yet.

**Storage**: Supabase Storage buckets — `enrolment-docs` (ID/report uploads), `materials`, `gallery`.

**Data model** (key tables): `profiles`, `learners`, `enrolment_applications`, `classes`, `materials`, `user_material_progress`, `quizzes`/`quiz_questions`/`quiz_attempts`, `chat_rooms`/`chat_room_messages`, `payments`, `announcements`, `notifications`, `gallery`.

---

## 4. Known gaps (be aware before building on these)

- **Quizzes** are fully built end-to-end (creation, taking, scoring) but hidden from the Tasks screen — commented out as "paused for MVP." Easy to re-enable.
- **Live classes** link out to a public Jitsi room rather than an embedded, branded call — anyone with the link URL could join.
- **Payment webhook** field-parsing is unverified against a real Yoco webhook payload (flagged in the code itself) — should be tested against Yoco's sandbox before relying on it in production.
- **No schema-as-code**: database structure lives only in the live Supabase project + a hand-maintained notes file, not versioned migrations. Risky for onboarding new devs or rolling back changes.
- Unused `PaymentMethod` enum values (PayFast/Ozow/Snapscan) that aren't wired to anything — Yoco is the only live provider.
- A few dead-code paths: the Gallery tab's own "Add" button has no handler (real gallery admin lives in a separate screen); onboarding carousel and a demo quick-login panel exist but are disabled.

---

## 5. Improvement ideas / roadmap

**High value, low effort**
- Re-enable Quizzes on the Tasks tab — feature is already done.
- Add a payment reminder flow (auto-notify guardians N days before/after due date).
- Weekly progress digest to guardians (materials completed, upcoming classes, outstanding fees).

**Medium effort**
- Move live classes to an embedded, access-controlled video call (e.g. a proper video SDK) instead of a public Jitsi link, with attendance tracking.
- Version the database schema with real Supabase migrations checked into the repo.
- Multi-child switcher for guardians with more than one enrolled learner.
- Read receipts / "seen by" in class chat.

**Bigger bets**
- Installment/subscription billing for fees instead of one-off payments.
- Admin analytics: subject-level performance, tutor workload, cohort trends.
- Offline caching of materials for low-connectivity access.
- In-app video recording/upload for tutors to post recorded lessons alongside live ones.
