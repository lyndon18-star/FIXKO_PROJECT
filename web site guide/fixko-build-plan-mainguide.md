# Fixko — Facility Reporting and Management System
### Build Plan & Technical Spec (for CLI / Claude Code implementation)

---

## 1. Project Summary

Fixko is a web-based facility reporting and report management system for a school.
Students and faculty report damaged/missing equipment; admins track, assign, and
resolve reports; the system keeps an inventory and repair history and gives
admins analytics on recurring problems.

---

## 2. User Roles

| Role | Account creation | Identifier required |
|---|---|---|
| **Admin** | Pre-seeded/built-in (created via seed script, not public sign-up) | Admin username/email + password |
| **Faculty** | Self sign-up | School email (must match school domain, e.g. `@school.edu.ph`) + Faculty/Employee ID |
| **Student** | Self sign-up | School email (must match school domain) + Student ID |

### Auth notes specific to your requirements
- **Sign-up** validates the school email domain and stores the Student ID or
  Faculty ID as a unique field per account (no two accounts can share the same ID).
- **Sign-in** is standard email + password once the account exists.
- **Every report/report submission form also asks for Student ID/School Email
  again** (per your requirement), even though the user is logged in. Treat this
  as a required verification field on the report form itself, not just profile
  data. Two implementation options — worth deciding before building:
  1. **Manual re-entry** (as you described): the field is blank, user types it in
     every time. Simplest to build, matches your spec exactly.
  2. **Autofill + confirm**: pre-fill from their profile but keep the field
     editable/required so they must actively confirm it. Reduces typos and
     drop-off, still satisfies "must be present on every report."
  Default recommendation: **build option 2** (autofill + editable/required) —
  same data guarantee, better UX. Say the word if you want strict option 1 instead.
- Passwords hashed (bcrypt/argon2), JWT or session-based auth middleware
  protecting role-specific routes.
- Forgot-password flow via email OTP/reset link.

---

## 3. Recommended Feature Set (original + additions)

**Original features (kept):**
1. Facility/Damage Reporting (with optional photo upload)
2. Report Tracking (Pending → Under Review → In Progress → Resolved)
3. Mobile-responsive reporting form
4. Repairs & Replacement Log
5. Notifications (new report → admin; status change → reporter)
6. Room/Building map or list, sortable by report frequency
7. Export reports/inventory to CSV/Excel

**Added features:**
8. **Priority/Severity levels** — Low / Medium / High / Critical, settable by admin, visible on report list.
9. **Report comment thread** — reporter ⇄ admin/technician messages tied to a report.
10. **Technician assignment** — admin assigns a report to a specific maintenance staff account or name.
11. **Duplicate flagging** — on submit, system checks for existing open reports in the same room/item and warns the reporter ("3 similar reports already open").
12. **QR code per room** — printable QR linking straight to that room's report form (skips manual room selection).
13. **Analytics dashboard** — charts for most-reported items, reports by department/building, average resolution time, open vs resolved trend.
14. **Post-resolution feedback** — 1–5 star rating + optional comment once marked Resolved.
15. **Audit/activity log** — timestamped record of status changes and who made them.
16. **Department-scoped admin views** (optional) — if the school wants per-department admins who only see their own department's reports.

---

## 4. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React (Vite) + Tailwind CSS** | Fast, mobile-responsive by default with Tailwind, huge component ecosystem |
| Backend | **Node.js + Express** (or Next.js API routes if you want one repo) | Simple REST API, easy to pair with Prisma |
| Database | **PostgreSQL** | Relational data (users, reports, equipment, logs) fits relational model well |
| ORM | **Prisma** | Type-safe queries, easy migrations, good with Postgres |
| Auth | **JWT + bcrypt** | Stateless auth, simple role middleware |
| File storage (photos) | **Local `/uploads` folder for dev, Cloudinary/S3 for production** | Cheap start, easy swap later |
| Notifications | **Nodemailer (email)** + in-app notification table (polled or via WebSocket later) | Covers both email + in-app without needing a paid service initially |
| Export | **`exceljs`** (Excel) or **`csv-writer`** (CSV) on the backend | Generates downloadable files from report/inventory queries |
| QR codes | **`qrcode` npm package** | Generates QR per room server-side |
| Charts (admin analytics) | **Recharts** on the frontend | Matches React, simple bar/line/pie charts |

This stack is intentionally boring/standard so a CLI coding agent can scaffold it without ambiguity.

---

## 5. Database Schema (core entities)

```
User
 - id, name, email (unique, school domain validated), password_hash
 - role: enum [admin, faculty, student]
 - school_id (unique, student ID or faculty ID depending on role)
 - department_id (nullable, FK -> Department)
 - created_at

Department
 - id, name

Building
 - id, name

Room
 - id, name, building_id (FK), department_id (nullable FK)
 - qr_code_token (unique, for QR scan-to-report)

Equipment (inventory)
 - id, name, category (chair, aircon, computer, light, etc.)
 - room_id (FK), department_id (FK)
 - condition: enum [good, damaged, missing, under_repair]
 - date_acquired

Report
 - id, reporter_id (FK -> User)
 - reporter_school_id_snapshot (string, captured at submission time)
 - reporter_email_snapshot (string, captured at submission time)
 - equipment_id (nullable FK, or free-text item description)
 - room_id (FK)
 - description, photo_url (nullable)
 - priority: enum [low, medium, high, critical]
 - status: enum [pending, under_review, in_progress, resolved]
 - assigned_technician (nullable string/FK)
 - created_at, updated_at

ReportStatusHistory
 - id, report_id (FK), old_status, new_status, changed_by (FK -> User), changed_at

ReportComment
 - id, report_id (FK), author_id (FK -> User), message, created_at

RepairHistory
 - id, equipment_id (FK), report_id (nullable FK)
 - action: enum [repaired, replaced]
 - notes, date, performed_by

Notification
 - id, user_id (FK), message, is_read, related_report_id (nullable FK), created_at

Feedback
 - id, report_id (FK), rating (1-5), comment, created_at
```

---

## 6. API Endpoint Outline

```
Auth
 POST   /api/auth/signup          (role: student/faculty, validates school email + ID)
 POST   /api/auth/login
 POST   /api/auth/forgot-password
 POST   /api/auth/reset-password

Reports
 POST   /api/reports                     (create report — requires school_id + email snapshot)
 GET    /api/reports                     (list, filterable by status/priority/department/room)
 GET    /api/reports/:id
 PATCH  /api/reports/:id/status          (admin/technician only)
 POST   /api/reports/:id/comments
 POST   /api/reports/:id/feedback        (reporter, after resolution)

Inventory
 GET    /api/equipment
 POST   /api/equipment                   (admin)
 PATCH  /api/equipment/:id               (admin — condition updates)
 GET    /api/equipment/:id/repair-history
 POST   /api/equipment/:id/repair-history    (admin/technician)

Rooms / Buildings
 GET    /api/buildings
 GET    /api/rooms
 GET    /api/rooms/:id/qr                (generate/return QR code)

Admin analytics & export
 GET    /api/analytics/summary           (counts, avg resolution time, top items)
 GET    /api/export/reports.csv
 GET    /api/export/reports.xlsx

Notifications
 GET    /api/notifications
 PATCH  /api/notifications/:id/read
```

---

## 7. Suggested Folder Structure

```
fixko/
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # Login, Signup, ReportForm, Dashboard, ReportDetail, AdminPanel
│   │   ├── components/
│   │   ├── context/         # auth context
│   │   └── api/             # axios/fetch wrappers
├── server/                  # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/      # auth, role-check
│   │   ├── prisma/          # schema.prisma, migrations
│   │   └── utils/           # email, qrcode, export helpers
└── README.md
```

---

## 8. Phased Build Order (for the CLI to follow)

**Phase 1 — Foundation**
1. Scaffold client (Vite + React + Tailwind) and server (Express) in a monorepo.
2. Set up PostgreSQL + Prisma, write schema from Section 5, run initial migration.
3. Seed script: creates the built-in Admin account.

**Phase 2 — Auth**
4. Sign-up endpoint with school-email-domain + unique school-ID validation (student/faculty).
5. Login endpoint, JWT issuance, role-based middleware.
6. Frontend Login/Signup pages, protected routes by role.

**Phase 3 — Core reporting**
7. Report form (mobile-first) with school ID/email field (per Section 2), room selector, photo upload, priority.
8. Report creation endpoint + duplicate-check logic.
9. Report list + detail views (role-aware: students see their own, admins see all).

**Phase 4 — Report lifecycle**
10. Status update endpoint + ReportStatusHistory logging.
11. Comment thread (create/list).
12. Technician assignment field + notification trigger on assignment/status change.

**Phase 5 — Inventory & repair log**
13. Equipment CRUD (admin).
14. Repair/replacement log tied to equipment and optionally to a report.

**Phase 6 — Notifications**
15. In-app notification table + endpoint.
16. Email notifications via Nodemailer (new report → admin, status change → reporter).

**Phase 7 — Admin extras**
17. Analytics dashboard (Recharts) using `/api/analytics/summary`.
18. CSV/Excel export endpoints + download buttons.
19. QR code generation per room + scan-to-report landing page.
20. Post-resolution feedback form + display average ratings per equipment/department.

**Phase 8 — Polish**
21. Mobile responsiveness pass on all forms/tables.
22. Role-based UI guards double-checked (student can't hit admin routes).
23. Basic error handling/loading states across app.

---

## 9. Open Decisions Before Building
- Confirm: autofill+confirm vs strict manual re-entry for the ID/email field on reports (Section 2).
- Confirm your school's email domain(s) for validation.
- Decide if department-scoped admin accounts (feature 16) are needed at launch or later.
- Decide photo storage: local disk (fine for school-scale, low cost) vs cloud (Cloudinary/S3) if hosting off-campus.
