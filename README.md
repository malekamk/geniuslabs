# Genius Lab

Mobile app for Ravhuyani Genius Lab — an after-school tutoring centre. Parents enrol their kids, pay fees, and stay in touch with tutors; tutors run classes and share study material; admins run the whole centre from one dashboard.

Full breakdown of how it works (user stories, payment flow, tech architecture, roadmap) is in [SPEC.md](SPEC.md).

## What it does, in short

- **Guardians** enrol a learner, pay tuition by card in-app, get notified on approvals/rejections, chat with tutors, see a photo gallery.
- **Learners** see their classes and study materials, join live video lessons, chat with their class.
- **Tutors** schedule classes, upload materials, chat with their students.
- **Admins** review enrolments, track payments, manage users/content, and send announcements — all from a dashboard.

## Tech stack

Expo (SDK 54, managed) · React Native · Expo Router · TypeScript · NativeWind · Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) · Yoco (payments) · Jitsi Meet (live classes) · Expo Push Notifications.

## Get started

1. Install dependencies
   ```bash
   npm install
   ```

2. Start the app
   ```bash
   npx expo start
   ```

Open it in Expo Go, an Android emulator, or an iOS simulator from the output menu.

3. Backend: this app talks to a Supabase project (Auth/DB/Storage/Realtime) and three Edge Functions (`create-checkout`, `verify-payment`, `payment-webhook`) plus `send-push`, found in `supabase/functions/`. You'll need Supabase env vars configured locally to run auth/data features.

## Learn more

- [SPEC.md](SPEC.md) — full product spec, user flows, payment/architecture details, and roadmap
- [Expo documentation](https://docs.expo.dev/versions/v54.0.0/)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [Supabase docs](https://supabase.com/docs)
