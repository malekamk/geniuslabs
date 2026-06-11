# Genius Lab — Full Project Documentation

> **Version:** MVP 1.0 · **Date:** June 2026 · **Platform:** iOS · Android · Web

---

## 1. Project Overview

**Genius Lab** is a mobile-first tutoring platform built for Ravhuyani Genius Lab, a South African supplementary education centre serving Grade 6–12 learners. The app transforms what was a static informational website into a full interactive learning experience with real-time classes, group chats, quizzes, materials, payments, and push notifications.

### Mission
Connect learners with qualified tutors, streamline enrolment, and deliver a CAPS-aligned educational experience on a single mobile platform.

### Target Users
| Role | Description |
|---|---|
| **Learner** | Grade 6–12 student enrolled at Genius Lab |
| **Tutor** | Subject teacher managing classes, quizzes, and materials |
| **Guardian** | Parent/guardian who enrols and pays for a learner |
| **Admin** | Platform administrator with full access |

---

## 2. Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React Native** | Cross-platform mobile framework |
| **Expo SDK 54** (Managed Workflow) | Build tooling, OTA updates, device APIs |
| **Expo Router v6** | File-based navigation (tabs, stacks, modals) |
| **TypeScript** | Type safety across the entire codebase |
| **NativeWind / StyleSheet** | Styling (utility + React Native StyleSheet) |
| **expo-linear-gradient** | Gradient cards and banners |
| **expo-notifications (v0.29)** | Local push notifications |
| **@expo/vector-icons (Ionicons)** | Icon system |

### Backend
| Technology | Purpose |
|---|---|
| **Supabase** | Postgres database, Auth, Realtime, Storage, RLS |
| **Supabase Realtime** | Live chat messages and notification delivery |
| **Supabase Auth** | Email/password authentication + JWT sessions |
| **Row Level Security (RLS)** | Per-row permission enforcement at the DB layer |
| **Supabase Storage** | File uploads (materials, documents) |

### Key Libraries
- `@supabase/supabase-js` — database client
- `expo-router` — navigation
- `react-native-safe-area-context` — notch/status bar handling
- `expo-status-bar` — per-screen status bar control

---

## 3. Application Architecture

### Folder Structure
```
src/
├── app/                        # Expo Router screens
│   ├── (tabs)/                 # Bottom tab screens
│   │   ├── index.tsx           # Home
│   │   ├── classes.tsx         # Classes list
│   │   ├── chat.tsx            # Group chat list
│   │   ├── tasks.tsx           # Quizzes & materials
│   │   └── profile.tsx         # User profile
│   ├── auth/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── chat-room.tsx           # Real-time chat room
│   ├── notifications.tsx       # Notification inbox
│   ├── enroll.tsx              # Enrolment application
│   ├── live-class/[room].tsx   # Live class viewer
│   ├── quiz/[id].tsx           # Quiz attempt
│   ├── quiz-questions/[id].tsx # Quiz question manager (tutor)
│   ├── create-class.tsx        # Create class modal
│   ├── create-material.tsx     # Upload material modal
│   └── create-quiz.tsx         # Create quiz modal
│
├── components/                 # Shared UI components
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── animated-icon.tsx
│   ├── app-tabs.tsx            # Native tab bar
│   ├── app-tabs.web.tsx        # Web sidebar nav
│   └── learner-banner.tsx
│
├── context/                    # React Context providers
│   ├── auth-context.tsx        # Session + profile state
│   ├── classes-context.tsx     # Classes CRUD + state
│   ├── learner-context.tsx     # Selected learner
│   └── notification-context.tsx # Unread count + local notifs
│
├── hooks/
│   └── use-supabase-query.ts   # Generic Supabase query hook
│
├── types/
│   └── db.ts                   # TypeScript interfaces for all DB tables
│
├── constants/
│   └── theme.ts                # Colors, Spacing, Fonts
│
├── data/
│   └── classes.ts              # Local mock data (dev fallback)
│
└── utils/
    ├── supabase.ts             # Supabase client singleton
    └── logger.ts               # Dev logging utility
```

### Navigation Structure
```
RootLayout (AuthProvider)
├── auth/login
├── auth/signup
├── (tabs)                      ← main app after login
│   ├── index (Home)
│   ├── classes
│   ├── chat
│   ├── tasks
│   └── profile
├── chat-room                   ← full-screen modal
├── notifications               ← full-screen modal
├── enroll
├── live-class/[room]
├── quiz/[id]
├── quiz-questions/[id]
├── create-class (modal)
├── create-material (modal)
└── create-quiz (modal)
```

### State Management
- **React Context** for global state (auth, classes, learner selection, notifications)
- **Local component state** for UI interactions
- **Supabase Realtime** for live data (chat, notifications)
- No Redux or Zustand — kept intentionally lightweight

---

## 4. Database Schema

**Database:** PostgreSQL via Supabase · **RLS:** Enabled on all tables

### Entity Relationship Overview
```
auth.users
    └── profiles (1:1)
            ├── learners (guardian_id, profile_id)
            ├── classes (tutor_id)
            ├── materials (created_by)
            ├── quizzes (created_by)
            ├── payments (guardian_id)
            ├── notifications (profile_id)
            └── chat_room_messages (sender_id)

subjects
    ├── classes (subject_id)
    ├── materials (subject_id)
    ├── quizzes (subject_id)
    └── chat_rooms (subject_id)

learners
    ├── class_enrolments (learner_id)
    ├── payments (learner_id)
    ├── payment_plans (learner_id)
    └── enrolment_applications (learner_id)

classes
    └── class_enrolments (class_id)

quizzes
    ├── quiz_questions (quiz_id)
    └── quiz_attempts (quiz_id)

chat_rooms (subject_id + grade UNIQUE)
    └── chat_room_messages (chat_room_id)
```

---

### Table Reference

#### `profiles`
Extends `auth.users`. One row per authenticated user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Matches `auth.users.id` |
| `role` | text | `guardian` · `learner` · `tutor` · `admin` |
| `full_name` | text | |
| `phone` | text | |
| `avatar_url` | text | |
| `bio` | text | |
| `subjects` | text[] | Tutor's subjects OR learner's enrolled subjects |
| `grades` | text[] | Tutor's grade levels |
| `is_active` | bool | Default true |

---

#### `learners`
A learner record can exist independently of a profile (created by guardian before the learner has an account).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid FK → profiles | Nullable — set when learner creates account |
| `guardian_id` | uuid FK → profiles | Required |
| `full_name` | text | |
| `date_of_birth` | date | |
| `grade` | text | e.g. "Grade 12" |
| `school_name` | text | |
| `id_number` | text | SA ID |
| `medical_notes` | text | |
| `is_active` | bool | |

---

#### `subjects`
Master list of CAPS-aligned subjects. Seeded with 12 subjects.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text UNIQUE | e.g. "Mathematics" |
| `code` | text | e.g. "MATH" |
| `grade_band` | text | `junior` (Gr 6–9) · `senior` (Gr 10–12) · `all` |
| `description` | text | |
| `icon_name` | text | Ionicons name |
| `is_active` | bool | |

**Seeded subjects:** Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences, Natural Sciences, English, Afrikaans, Accounting, Business Studies, Geography, History + 1 more.

---

#### `classes`
A scheduled or live tutoring session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tutor_id` | uuid FK → profiles | |
| `subject_id` | uuid FK → subjects | |
| `title` | text | |
| `grade` | text | e.g. "Grade 12" |
| `grade_band` | text | `junior` · `senior` |
| `room` | text UNIQUE | Slug used for live class URL |
| `scheduled_at` | timestamptz | |
| `duration_minutes` | int | Default 60 |
| `max_learners` | int | Default 30 |
| `live` | bool | True = currently streaming |
| `status` | text | `scheduled` · `live` · `completed` · `cancelled` |
| `recording_url` | text | Post-class recording |
| `tags` | text[] | |

---

#### `class_enrolments`
Junction table: which learner is enrolled in which class.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `class_id` | uuid FK → classes | |
| `learner_id` | uuid FK → learners | |
| `attended` | bool | Marked by tutor |
| `joined_at` | timestamptz | When learner joined live stream |
| `enrolled_at` | timestamptz | |

---

#### `enrolment_applications`
Submitted by guardians to enrol a learner. Reviewed by admin.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | text | Submitter email |
| `guardian_name / phone / email` | text | Guardian contact |
| `learner_name` | text | |
| `learner_dob` | text | |
| `grade` | text | |
| `subjects` | text[] | Chosen subjects |
| `birth_cert_url` | text | Uploaded doc |
| `school_report_url` | text | Uploaded doc |
| `popia_consent` | bool | POPIA compliance |
| `status` | text | `pending` · `reviewing` · `approved` · `rejected` |
| `reviewed_by` | uuid FK → profiles | Admin who reviewed |
| `guardian_profile_id` | uuid FK → profiles | |
| `learner_id` | uuid FK → learners | Set after approval |

---

#### `materials`
Learning resources created by tutors.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid FK → subjects | |
| `created_by` | uuid FK → profiles | |
| `title` | text | |
| `grade` | text | |
| `type` | text | `pdf` · `video` · `worksheet` · `notes` · `exam_paper` |
| `pages` | int | |
| `file_url` | text | Supabase Storage URL |
| `external_url` | text | YouTube, etc. |
| `is_published` | bool | |
| `view_count` | int | |
| `tags` | text[] | |

---

#### `user_material_progress`
Tracks per-user reading/viewing progress on materials.

| Column | Type | Notes |
|---|---|---|
| `profile_id` | uuid FK → profiles | |
| `material_id` | uuid FK → materials | |
| `status` | text | `new` · `in_progress` · `done` |
| `last_page` | int | |

---

#### `quizzes`
A published quiz created by a tutor.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid FK → subjects | |
| `created_by` | uuid FK → profiles | |
| `title` | text | |
| `grade` | text | |
| `questions` | int | Count |
| `duration_minutes` | int | |
| `pass_score` | int | Percentage |
| `difficulty` | text | `easy` · `medium` · `hard` |
| `is_published` | bool | |
| `attempt_count` | int | Aggregate counter |

---

#### `quiz_questions`
Individual questions within a quiz.

| Column | Type | Notes |
|---|---|---|
| `quiz_id` | uuid FK → quizzes | |
| `question_text` | text | |
| `type` | text | `multiple_choice` · `true_false` · `short_answer` |
| `options` | jsonb | `[{ label: "A", text: "..." }]` |
| `correct_answer` | text | |
| `explanation` | text | Shown after attempt |
| `marks` | int | |
| `sort_order` | int | |

---

#### `quiz_attempts`
A learner's attempt at a quiz.

| Column | Type | Notes |
|---|---|---|
| `profile_id` | uuid FK → profiles | |
| `quiz_id` | uuid FK → quizzes | |
| `score` | int | Percentage |
| `passed` | bool | |
| `status` | text | `in_progress` · `completed` · `abandoned` |
| `answers` | jsonb | `{ questionId: "selected_answer" }` |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | |

---

#### `payments`
Individual payment records.

| Column | Type | Notes |
|---|---|---|
| `learner_id` | uuid FK → learners | |
| `guardian_id` | uuid FK → profiles | |
| `amount` | numeric | |
| `currency` | text | Default `ZAR` |
| `type` | text | `tuition` · `assessment` · `registration` · `material` · `other` |
| `status` | text | `pending` · `paid` · `failed` · `refunded` · `overdue` · `waived` |
| `due_date` | date | |
| `payment_method` | text | `eft` · `card` · `cash` · `payfast` · `ozow` · `snapscan` |
| `gateway_reference` | text | Payment gateway ID |
| `gateway_payload` | jsonb | Full gateway response |
| `invoice_url` | text | |
| `period_month` | text | e.g. "2026-06" |

---

#### `payment_plans`
Recurring monthly payment setup per learner.

| Column | Type | Notes |
|---|---|---|
| `learner_id` | uuid FK → learners | |
| `guardian_id` | uuid FK → profiles | |
| `monthly_amount` | numeric | |
| `billing_day` | int | 1–28 |
| `start_date` / `end_date` | date | |
| `discount_percent` | int | |
| `is_active` | bool | |

---

#### `announcements`
Platform-wide or targeted messages from admin/tutors.

| Column | Type | Notes |
|---|---|---|
| `title` / `body` | text | |
| `type` | text | `general` · `event` · `urgent` · `payment` · `exam` |
| `target_grade` | text | Null = all grades |
| `target_role` | text | Null = all roles |
| `active` | bool | |
| `published_at` | timestamptz | |
| `expires_at` | timestamptz | |
| `cta_label` / `cta_route` | text | Deep link button |

---

#### `notifications`
Per-user notification inbox (bell screen).

| Column | Type | Notes |
|---|---|---|
| `profile_id` | uuid FK → profiles | Recipient |
| `title` / `body` | text | |
| `type` | text | `class_reminder` · `payment_due` · `new_material` · `quiz_available` · `announcement` · `general` |
| `read` | bool | |
| `data` | jsonb | Extra payload (e.g. `chat_room_id`) |

---

#### `chat_rooms`
One room per subject × grade combination. Auto-created on first use.

| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid FK → subjects | |
| `grade` | text | e.g. "Grade 12" |
| `UNIQUE(subject_id, grade)` | | Enforced constraint |

---

#### `chat_room_messages`
Real-time chat messages within a room.

| Column | Type | Notes |
|---|---|---|
| `chat_room_id` | uuid FK → chat_rooms | |
| `sender_id` | uuid FK → profiles | |
| `sender_role` | text | `learner` · `tutor` · `admin` |
| `content` | text | Min length 1 |
| `created_at` | timestamptz | |

**Realtime:** Table is added to `supabase_realtime` publication. Clients subscribe via `postgres_changes` filtered by `chat_room_id`.

---

## 5. Features

### 5.1 Authentication
- Email + password via Supabase Auth
- Auto-redirect on session restore (app remembers login)
- Role-based routing: tutors see tutor UI, learners see learner UI
- Sign out clears session

### 5.2 Home Screen
- Dynamic greeting (Good morning / afternoon / evening) with user's first name and avatar initials
- Role-aware welcome banner: grade/school for learners, subjects/grades for tutors
- Stat circle showing live or upcoming class count
- 4 quick-access action cards (Classes, Chat, Tasks, Profile)
- Live class alert banner when a class is streaming
- Horizontal-scroll upcoming class cards (colour-coded by subject)
- Quiz cards with difficulty badges
- Latest active announcement with CTA
- Smart notification bell: shows count badge, filled icon when unread

### 5.3 Classes
- List of all classes with subject, grade, tutor, and status
- Tutor can create classes via modal (title, subject, grade, time)
- Tutor can delete classes
- Live class join button (navigates to live-class screen)
- Classes filtered client-side for learner's grade

### 5.4 Live Classes
- Room-based navigation: `live-class/[room]`
- WebRTC-ready room identifier for integration with Daily.co / Jitsi / etc.
- Tutor can mark class as live from admin

### 5.5 Group Chat (Real-time)
- **One chat room per subject × grade** — e.g. "Mathematics · Grade 12"
- All learners in that grade studying that subject share the same room
- Tutors see rooms for all their subjects × grades
- Chat groups auto-populated on app launch (rooms are pre-created)
- **Real-time messages** via Supabase Realtime subscriptions
- Messages show:
  - Sender name and initials avatar
  - Role badge: TUTOR (blue) or STUDENT (green)
  - Timestamp inline with message
  - Date dividers (Today / Yesterday / full date)
- Message content + timestamp on same line
- Background: grey (#F0F2F5) for chat-app feel

### 5.6 Notifications
- **Bell icon** on home screen with live unread count badge
- Badge increments for:
  - New chat message from another user (global Realtime subscription)
  - New row inserted in `notifications` table for this user
- **Notifications screen**: full inbox with type icons, colour coding, unread indicator (green left border)
- Tap → marks as read; badge decrements
- Mark all read on screen open
- Rich message format: `"Siphesihle: hey how are you · Business Studies · Grade 12"`

### 5.7 Quizzes & Tasks
- Published quizzes listed per subject/grade
- Learners can attempt quizzes with timer
- Question types: multiple choice, true/false, short answer
- Score and pass/fail result
- Tutors can create quizzes and manage questions

### 5.8 Materials
- Upload PDFs, videos, worksheets, notes, exam papers
- Linked to subject and grade
- View count tracking
- Per-user progress tracking (new / in_progress / done)

### 5.9 Enrolment
- Multi-step enrolment form: guardian details, learner details, subject selection, document uploads, POPIA consent
- On submit: creates `enrolment_applications` row + `learners` row, links `learner_id` back to application
- Admin reviews and approves/rejects
- Status tracking: pending → reviewing → approved / rejected

### 5.10 Payments
- Payment records per learner with full audit trail
- Methods: EFT, card, cash, PayFast, Ozow, SnapScan
- Types: tuition, assessment, registration, material, other
- Payment plans: recurring monthly with billing day and discount
- Invoice URL storage

### 5.11 Profile
- View personal details: name, grade, school, DOB
- Learner: sees enrolled subjects, assigned tutors
- Tutor: sees subjects taught and grade levels
- Guardian: sees linked learners and their applications

### 5.12 Announcements
- Admin-created announcements with type (general, event, urgent, payment, exam)
- Target by grade or role
- Expiry dates
- CTA button with deep link route

---

## 6. Security Model (RLS)

Every table has Row Level Security enabled. Key policies:

| Table | Read Rule | Write Rule |
|---|---|---|
| `profiles` | Own profile (ALL) · Tutors readable by all authenticated users | Own profile only |
| `learners` | Own learner record | Guardian can create/update |
| `classes` | All authenticated | Tutor of that class |
| `chat_rooms` | Tutor (subjects/grades match profile) OR learner (grade match) | Same |
| `chat_room_messages` | Same as chat_rooms | Same + `sender_id = auth.uid()` |
| `notifications` | Own (`profile_id = auth.uid()`) | Own only |
| `payments` | Guardian or learner linked to that payment | Admin only |
| `enrolment_applications` | Guardian who submitted | Guardian (insert), Admin (update) |

---

## 7. Real-time Architecture

Two Supabase Realtime subscriptions run globally (in `NotificationProvider`, mounted at app root):

1. **`notifications` table** — filtered by `profile_id = current_user`
   - On INSERT → increment bell badge + fire local OS notification

2. **`chat_room_messages` table** — one subscription per accessible chat room
   - On INSERT (from another user) → increment badge + insert notification row + fire local OS notification
   - Chat rooms are pre-created on app start so subscriptions are always active

Inside `chat-room.tsx`, an additional subscription updates the message list in real-time for the open room.

---

## 8. App Screens Summary

| Screen | Route | Access |
|---|---|---|
| Home | `/(tabs)` | All roles |
| Classes | `/(tabs)/classes` | All roles |
| Chat List | `/(tabs)/chat` | All roles |
| Tasks | `/(tabs)/tasks` | All roles |
| Profile | `/(tabs)/profile` | All roles |
| Login | `/auth/login` | Unauthenticated |
| Signup | `/auth/signup` | Unauthenticated |
| Chat Room | `/chat-room` | All roles |
| Notifications | `/notifications` | All roles |
| Enrolment Form | `/enroll` | Guardian / Learner |
| Live Class | `/live-class/[room]` | All roles |
| Quiz Attempt | `/quiz/[id]` | Learner |
| Create Class | `/create-class` | Tutor |
| Create Material | `/create-material` | Tutor |
| Create Quiz | `/create-quiz` | Tutor |
| Quiz Questions | `/quiz-questions/[id]` | Tutor |

---

## 9. Design System

### Colours
| Token | Hex | Usage |
|---|---|---|
| Primary (Green) | `#1A6B3C` | Brand, CTAs, learner role |
| Blue | `#1565C0` | Tutor role, classes |
| Purple | `#7C3AED` | Tasks, quizzes |
| Amber | `#D97706` | Payments, warnings |
| Red | `#DC2626` | Hard difficulty, live indicator |
| Background | `#F5F6FA` | App background |
| White | `#FFFFFF` | Cards |
| Dark | `#111827` | Primary text |
| Muted | `#6B7280` | Secondary text |

### Spacing Scale
```
one   = 4px
two   = 8px
three = 16px
four  = 24px
five  = 32px
six   = 64px
```

### Typography
- Headers: `fontWeight: '800'` (Extra Bold)
- Body: `fontWeight: '400'`
- Labels/badges: `fontWeight: '700'`, uppercase with letter spacing
- Font: System default (SF Pro on iOS, Roboto on Android)

### Components
- **Cards**: `borderRadius: 16–20`, white background, subtle shadow
- **Gradient cards**: Subject-specific colours for class cards
- **Role badges**: Colour-coded pill (TUTOR = blue, STUDENT = green)
- **Avatar initials**: Gradient circle with 2-letter initials
- **Bottom tab bar**: 5 tabs with filled/outline icon states

---

## 10. Curriculum Coverage

CAPS-aligned subjects across two grade bands:

**Junior Phase (Grades 6–9)**
- Mathematics, Natural Sciences, English, Social Sciences

**Senior Phase (Grades 10–12)**
- Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences
- Accounting, Business Studies, Geography, History, English, Afrikaans

---

## 11. Data Flows

### Enrolment Flow
```
Guardian fills form → enrolment_applications INSERT
                    → learners INSERT (linked by learner_id)
Admin reviews → status UPDATE (approved/rejected)
```

### Chat Message Flow
```
User types message → chat_room_messages INSERT
                   → Realtime fires for all subscribers in room
                   → Other users: notifications INSERT + local push
```

### Quiz Attempt Flow
```
Learner starts quiz → quiz_attempts INSERT (status: in_progress)
Learner answers → quiz_attempts UPDATE (answers jsonb)
Learner submits → score calculated → quiz_attempts UPDATE (status: completed, score, passed)
```

---

## 12. Known Limitations (MVP)

| Limitation | Impact | Future Fix |
|---|---|---|
| No background push (APNs/FCM) | Notifications only work when app is open/foreground | Add Expo Push Token + Edge Function |
| `enrolment_applications.learner_id` not always set | Chat groups fall back to profile.subjects | Admin approval flow writes learner_id back |
| No video calling integrated | Live class screen is placeholder | Integrate Daily.co or Jitsi |
| No in-app payment gateway | Payments tracked manually | Integrate PayFast / Ozow SDK |
| Not multi-tenant | Single organisation only | Add `tenant_id` to all tables + RLS |

---

## 13. Future Roadmap

### Phase 2 — Production Polish
- Native development build (EAS Build)
- Background push notifications (APNs + FCM via Expo Push Service)
- Video calling in live classes (Daily.co WebRTC)
- Payment gateway (PayFast / Ozow)
- Admin web dashboard

### Phase 3 — Multi-Tenant SaaS
- `tenants` table with plan and branding config
- Add `tenant_id` to all tables
- Tenant self-service onboarding
- Feature gating by plan (Starter / Pro / Enterprise)
- Per-tenant subdomain or invite code

### Phase 4 — Intelligence
- AI tutor assistant (Claude API)
- Automated quiz generation from materials
- Learning analytics and progress dashboards
- Personalised subject recommendations

---

## 14. Converting This Document to PDF

**Option A — VS Code**
1. Install "Markdown PDF" extension
2. Right-click this file → "Markdown PDF: Export (pdf)"

**Option B — Pandoc (command line)**
```bash
pandoc DOCUMENTATION.md -o "Genius_Lab_Documentation.pdf" --pdf-engine=wkhtmltopdf
```

**Option C — Online**
- Paste into [markdown2pdf.com](https://md2pdf.netlify.app/) or [dillinger.io](https://dillinger.io) → Export as PDF

---

*Genius Lab Mobile App · Built with Expo + Supabase · South Africa · 2026*
