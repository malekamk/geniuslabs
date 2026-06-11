PROJECT SPEC: Genius Lab Mobile App (Expo MVP)
🎯 Objective

Build a mobile application prototype using Expo (Expo Go compatible, no native code) for Ravhuyani Genius Lab based on this website:

https://sites.google.com/view/ravhuyanigeniuslab/

The goal is to:

Transform a static informational website into a mobile-first interactive experience
Focus on usability, engagement, and scalability
Deliver a production-structured MVP, not a hacky demo
🧩 TECH CONSTRAINTS
MUST USE:
Expo (managed workflow)
React Native
Expo Router (file-based routing)
No custom native modules
Compatible with Expo Go
ALLOWED:
Firebase or Supabase (optional for backend simulation)
AsyncStorage / MMKV (light state persistence)
Expo APIs (Notifications, Linking, etc.)
👥 TARGET USERS
Students (primary)
Parents
Staff/Admin (future phase)
📱 CORE PRODUCT FEATURES (MVP)
1. 🏠 Home Screen

Purpose:

Entry point
Highlight lab identity and offerings

Content:

Hero section (branding, slogan)
Quick actions:
View Programs
Contact
Enroll
Announcements / updates
2. 📚 Programs / Services

Purpose:

Display offerings clearly

Features:

List of programs
Each program has:
Title
Description
Duration
CTA (Enroll / Contact)
3. 📸 Gallery

Purpose:

Social proof / engagement

Features:

Image grid
Tap → full screen preview
4. 📞 Contact / Reach Us

Purpose:

Convert users

Features:

Call button
WhatsApp deep link
Email link
Location (open maps)
5. 📝 Enrollment (MVP Simulation)

Purpose:

Capture leads

Features:

Form:
Name
Phone
Email
Program selection
Submit:
Store locally (AsyncStorage)
Show success feedback
⭐ OPTIONAL (HIGH VALUE ADDITIONS)

If time allows:

🔔 Notifications (Expo)
Simulated announcements
💬 WhatsApp Integration
Pre-filled message:
“Hi, I’m interested in enrolling…”
🧠 AI Assistant (mock)
Simple chatbot UI (no backend required initially)
🧱 APP ARCHITECTURE
Navigation

Use Expo Router:

/app
  /(tabs)
    index.tsx (Home)
    programs.tsx
    gallery.tsx
    contact.tsx
  /enroll.tsx
  /program/[id].tsx
State Management
Lightweight:
React Context OR Zustand
Folder Structure
/src
  /components
  /screens
  /hooks
  /services
  /constants
  /styles
🎨 UI/UX REQUIREMENTS
Design Style:
Modern
Clean
Mobile-first
Education-tech inspired
Guidelines:
Use cards for content
Large touch targets
Smooth spacing
Avoid clutter
⚡ PERFORMANCE REQUIREMENTS
Fast load (no heavy dependencies)
Lazy load images
Avoid unnecessary re-renders
🔌 DATA STRATEGY

For MVP:

Hardcode content OR use JSON

Example:

const programs = [
  {
    id: "1",
    title: "STEM Training",
    description: "Hands-on science & technology learning",
    duration: "3 months"
  }
];
🔐 FUTURE SCALABILITY (DO NOT IMPLEMENT FULLY)

Design code so it can later support:

Authentication
Backend API
Admin dashboard
Real-time updates
📦 DELIVERABLES

Claude should output:

Expo project setup
Folder structure
Core screens implemented
Navigation working
Reusable components
Clean, readable code
🚫 DO NOT
Do NOT use native modules
Do NOT overcomplicate
Do NOT build backend-heavy features
Do NOT use WebView
✅ SUCCESS CRITERIA
Runs in Expo Go
Clean UI
Functional navigation
Feels like a real app (not a website wrapper)
🧠 BONUS (IMPORTANT)

Make thoughtful improvements:

Improve UX beyond the website
Suggest better layout where needed
Optimize for mobile interaction
🔚 END OF SPEC
💡 Why this works (important for you)

This spec:

Forces Claude to think like:
Product Manager
Mobile Engineer
UX Designer
Prevents garbage output like: