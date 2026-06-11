# Genius Lab App — Development & Running Cost Summary

**Prepared for:** Ravhuyani Genius Lab  
**Date:** June 2026  
**App:** Genius Lab Mobile (iOS · Android · Web)

---

## Overview

This document summarises the accounts, subscriptions, and third-party services required to develop, publish, and operate the Genius Lab mobile application. Costs are presented in ZAR where applicable, with USD originals noted.

---

## 1. Development Infrastructure

### Supabase (Backend — Database, Auth, Realtime, Storage)
| Plan | Cost | What's Included |
|---|---|---|
| **Free (current)** | R0/month | 500MB DB · 1GB Storage · 50k MAU · Realtime enabled |
| **Pro (recommended at launch)** | ~R470/month ($25) | 8GB DB · 100GB Storage · 250GB bandwidth · Daily backups · No pause |

**What we use Supabase for:**
- PostgreSQL database (all 16 tables: users, learners, classes, payments, chat, quizzes, etc.)
- Authentication (email + password sign-in)
- Row Level Security (per-user data access control)
- Realtime (live chat messages, instant notifications)
- File storage (materials, documents, profile images)

**Recommendation:** Upgrade to Pro before going live. The Free tier pauses after 1 week of inactivity — unacceptable for a production app.

---

## 2. Mobile App Publishing

### Apple Developer Program (iOS App Store)
| Item | Cost |
|---|---|
| Annual membership | **R1,990/year (~$99)** |
| One-time setup | Included |

Required to distribute the app on the Apple App Store and install on physical iOS devices via TestFlight.

### Google Play Console (Android)
| Item | Cost |
|---|---|
| One-time registration | **R480 (~$25)** |
| Annual renewal | Free |

Required to publish on the Google Play Store. Once-off fee, no annual renewal.

---

## 3. Expo / EAS (Build & Update Service)

Publishing to app stores requires Expo Application Services (EAS).

| Plan | Cost | What's Included |
|---|---|---|
| **Production** | ~R950/month ($50) | 100 builds/month · OTA updates · Priority queue |

**What EAS provides:**
- Cloud builds for iOS (.ipa) and Android (.apk/.aab) without needing a Mac
- EAS Submit — automated upload to App Store & Google Play
- OTA (Over-the-Air) updates — push app fixes without going through the store review process

**Minimum required:** EAS Free is sufficient during development. Move to Production plan when releasing updates.

---

## 4. Payment Processing — Yoco

Currently integrated via a demo/sandbox URL for testing. For real payments:

| Item | Cost |
|---|---|
| Yoco account setup | Free |
| Transaction fee (card payments) | **2.45% – 2.95% per transaction** |

**Example:** A R890 tuition payment → Yoco keeps ~R21.

**Steps to go live:**
1. Register a business account at yoco.com
2. Complete KYC (FICA documents, business registration)
3. Replace the demo URL in `payment-webview.tsx` with the real Yoco checkout URL
4. Point success/cancel redirect URLs to your domain

---

## 5. Push Notifications (Future)

Currently the app uses **local notifications only** (fires while the app is open). For true background push notifications (app closed):


## 6. Domain/Web Hosting & Web Development (Optional)

website Development - charged separately:

| Item | Cost |
|---|---|
| Domain geniuslabapp.co.za | ~R200–R400/year |


---



## 7. Developer Accounts Summary

| Account | Purpose | Cost |
|---|---|---|
| Supabase account | Backend database + auth | Free → R470/mo (Pro) |
| Apple Developer | iOS publishing | R1,990/year |
| Google Play Console | Android publishing | R480 (once) |
| Expo / EAS | App builds + OTA |  R950/mo |
| Yoco business account | Payment processing | Free + 2.45–2.95% per txn |

---

## 8. Monthly Cost Estimate



### Launch (50–500 users)
| Item | Monthly |
|---|---|
| Supabase Pro | R470 |
| EAS Production | R950 |
| Yoco (commissions) | ~R200–R600 |
| **Total fixed** | **~R1,420/month** |

---

## 9. One-Time Setup Costs

| Item | Cost |
|---|---|
| Apple Developer membership (year 1) | R1,990 |
| Google Play registration | R480 |
| **Total one-time** | **R2,470** |

---

## Notes

- All USD prices converted at approximately R19/$1 (June 2026 rate).
- Supabase Free tier is suitable for development and beta testing. Switch to Pro before public launch.
- Yoco integration is currently in sandbox/demo mode. Full KYC verification required before processing real payments.
- No third-party analytics, crash reporting (e.g. Sentry), or A/B testing tools are currently integrated — these would add R0–R500/month depending on provider and tier chosen.
- Background push notifications (when app is fully closed) require additional development work and are not yet implemented.

---

*Genius Lab Mobile App · South Africa · 2026*
