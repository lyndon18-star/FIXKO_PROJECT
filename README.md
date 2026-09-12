# Fixko

Fixko is a school facility reporting and ticket management system.

## Current implementation

- `frontend/` is a Next.js + React + TypeScript app using Tailwind CSS, Bootstrap,
  Framer Motion, and GSAP-ready dependencies.
- The landing page mirrors the supplied prototype: campus status board, feature
  cards, role explanation, interactive workflow, authentication modal, and
  responsive layout.
- The dashboard shell supports student, faculty, and admin navigation with
  reports, filters, reporting form, analytics, inventory, users, rooms, and
  notifications.
- `backend/` contains the Laravel API boundary and ticket controller contract for
  Sanctum-protected MySQL-backed endpoints.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Backend setup

PHP and Composer are required for Laravel. From `backend/`, create the Laravel
application, install Sanctum, configure MySQL in `.env`, then apply the schema
and controllers described in the build guide.
