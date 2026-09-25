# Fixko Figma Prototype Specification

This document is the build sheet for a clickable Figma prototype of Fixko, the
school facility reporting and report management system. It is based on the
current implementation in `fixko-prototype-v2.html` and
`frontend/app/page.tsx`.

## Prototype goal

Demonstrate the complete journey from discovering Fixko to submitting a
facility issue, tracking its status, and resolving it through the admin
workflow.

## Figma file structure

Create these pages in the Figma file:

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Public`
5. `04 Student`
6. `05 Faculty`
7. `06 Admin`
8. `07 Prototype map`

Use Auto Layout for every card, form, list row, navigation group, and modal.
Use components with variants for role, status, priority, and responsive state.

## Frame inventory

### Public frames

| Frame | Size | Purpose |
| --- | --- | --- |
| `Public / Landing / Desktop` | 1440 x 1200 | Marketing landing page with hero, campus pulse, feature cards, workflow demo, roles, and CTA |
| `Public / Landing / Mobile` | 390 x 844 | Stacked mobile landing layout |
| `Public / Auth / Sign in / Student` | 480 x 640 | Student sign-in modal |
| `Public / Auth / Sign in / Faculty` | 480 x 640 | Faculty sign-in modal |
| `Public / Auth / Sign in / Admin` | 480 x 640 | Admin sign-in modal without the public role toggle |
| `Public / Auth / Sign up / Student` | 480 x 760 | Student school-email and student-ID registration |
| `Public / Auth / Sign up / Faculty` | 480 x 760 | Faculty school-email and employee-ID registration |

### Student and faculty frames

| Frame | Size | Purpose |
| --- | --- | --- |
| `App / Student / Dashboard` | 1440 x 960 | Personal report summary and quick actions |
| `App / Student / New report` | 1440 x 960 | Facility issue submission form |
| `App / Student / Duplicate warning` | 1440 x 960 | Similar open reports warning state |
| `App / Student / My reports` | 1440 x 960 | Student report list with filters |
| `App / Student / Report detail` | 1440 x 960 | Report detail side panel with timeline and comments |
| `App / Student / Notifications` | 1440 x 960 | Status and assignment notifications |
| `App / Faculty / Dashboard` | 1440 x 960 | Faculty dashboard with department visibility |
| `App / Faculty / Department reports` | 1440 x 960 | Department-scoped report list |
| `App / Faculty / Report detail` | 1440 x 960 | Faculty report detail and comment view |

### Admin frames

| Frame | Size | Purpose |
| --- | --- | --- |
| `App / Admin / All reports` | 1440 x 960 | All campus reports with status, priority, room, and technician |
| `App / Admin / Report detail` | 1440 x 960 | Admin report detail with assignment and status controls |
| `App / Admin / Analytics` | 1440 x 960 | Open vs resolved chart, most reported items, and resolution metrics |
| `App / Admin / Inventory` | 1440 x 960 | Equipment list with room and condition |
| `App / Admin / Users` | 1440 x 960 | Student, faculty, technician, and admin accounts |
| `App / Admin / Rooms` | 1440 x 960 | Buildings, rooms, report frequency, and QR entry points |
| `App / Admin / Notifications` | 1440 x 960 | Admin activity and system alerts |

Create one mobile frame for the report form and one for the report detail:

- `App / Student / New report / Mobile` - 390 x 844
- `App / Student / Report detail / Mobile` - 390 x 844

## Visual foundations

### Colors

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#4F46E5` | Main actions, active navigation, links |
| `primary-dark` | `#4338CA` | Hover and pressed states |
| `primary-light` | `#EEF2FF` | Active backgrounds and soft accents |
| `canvas` | `#F4F7FB` | App background |
| `surface` | `#FFFFFF` | Cards, panels, modals |
| `border` | `#E5E8EF` | Dividers and input borders |
| `text` | `#0F172A` | Primary text |
| `text-soft` | `#475569` | Supporting text |
| `muted` | `#8891A5` | Captions and metadata |
| `success` | `#15A36B` | Resolved and healthy states |
| `warning` | `#DB8B1F` | Medium priority and warnings |
| `danger` | `#E5484D` | Critical states and unread alerts |
| `field` | `#0F9F83` | Faculty accent and field actions |
| `teal` | `#0E8F9C` | Analytics and technician accents |
| `coral` | `#E76F51` | Supporting highlights |

### Typography

- Use Inter for all interface text.
- Use Inter Tight, ExtraBold, for page headings and major numeric values.
- Body: 14 px / 20 px.
- Supporting text: 13 px / 20 px.
- Page heading: 30 px / 36 px.
- Landing hero heading: 64 px / 66 px desktop, 44 px / 48 px mobile.
- Button labels: 14 px / 20 px, semibold.

### Geometry and effects

- Base spacing unit: 4 px.
- Card radius: 12 px.
- Button and input radius: 9 px.
- Pill radius: 999 px.
- Standard card padding: 24 px.
- Small card padding: 16 px.
- Border: 1 px solid `border`.
- Small shadow: `0 1px 2px rgba(15, 23, 42, 0.06)`.
- Medium shadow: `0 4px 16px rgba(15, 23, 42, 0.08)`.

## Core components

Create these components on `02 Components`:

- `Brand mark`: 32 x 32, 8 px radius, indigo diagonal gradient, white `F`.
- `Top navigation`: logo, navigation links, notification bell, avatar, sign-out.
- `Sidebar navigation`: role-aware links with active and collapsed variants.
- `Button`: primary, ghost, field, danger, small, disabled.
- `Input`: default, focused, filled, error, disabled.
- `Select`: default and open menu.
- `Badge / Status`: New, Under review, In progress, Resolved.
- `Badge / Priority`: Low, Medium, High, Critical.
- `Report row`: desktop, compact, selected, unread.
- `Report card`: mobile layout.
- `KPI card`: value, label, delta, icon.
- `Progress bar`: indigo, teal, warning, success.
- `Notification row`: unread and read.
- `Modal`: auth, duplicate warning, confirmation.
- `Side panel`: report detail open and closed.
- `Timeline item`: completed, active, upcoming.
- `Empty state`: no reports and no notifications.
- `Table header` and `Table row`: admin data tables.

## Screen construction notes

### Landing

Build the landing page in this order:

1. Sticky white navigation bar.
2. Two-column hero with the headline `Report it. Track it. Fix it.`.
3. Right-side campus status card with open, resolved, and response-time stats.
4. Trust strip with live updates, transparent tracking, mobile reporting, and
   school-ready controls.
5. Campus pulse cards.
6. Feature cards: facility reporting, report tracking, analytics, priority and
   duplicate alerts, inventory and repair log.
7. Interactive workflow preview with four states:
   `Report the issue`, `Review and assign`, `Repair in progress`, `Resolved`.
8. Role cards for Student, Faculty, and Admin.
9. Final call-to-action and footer.

### Authentication

Use a centered modal over a dimmed landing page:

- Header: Fixko mark, title, close control.
- Role selector for Student and Faculty on sign-up and shared sign-in.
- Admin sign-in uses a fixed Admin tag instead of the role selector.
- Sign-in fields: school email and password.
- Sign-up fields: name, school email, role-specific ID, password, confirm
  password.
- Primary action changes to `Continue as Student`, `Continue as Faculty`, or
  `Sign in as Admin`.
- Include `Forgot password?`, terms copy, and the alternate sign-in/sign-up
  link.

### Student and faculty app shell

- White top bar with brand, current role label, notifications, avatar, and
  sign-out.
- Left sidebar on desktop; bottom navigation on mobile.
- Main content uses a 1200 px max-width and 32 px desktop gutters.
- Student navigation: Dashboard, New report, My reports, Notifications.
- Faculty navigation: Dashboard, New report, Department reports, Notifications.
- Faculty action buttons use `field` green instead of indigo where appropriate.

### New report

Use a two-column desktop layout:

- Left: title, helper text, issue category, item, room/building, priority,
  description, photo upload, school ID and school email verification.
- Right: `Your report` summary card, response-time note, and support contact.
- Primary action: `Submit report`.
- On submit, transition to the duplicate warning frame when matching reports
  exist; otherwise transition to the report confirmation state.

### Report list

Include:

- Page title and description.
- Search field.
- Status and priority filters.
- Report rows with report ID, issue, room, date, priority, status, and
  assignee.
- Selected row state opens the report detail side panel.
- Empty state variant for a new user.

### Report detail

Side panel contents:

- Report ID, status badge, priority badge, and close button.
- Issue title, room, department, reporter, and created date.
- Description and attached photo placeholder.
- Status timeline: Submitted, Under review, In progress, Resolved.
- Assigned technician block.
- Comment thread with reply input.
- For resolved reports: five-star feedback control and optional comment.

### Admin

Admin shell uses the same top bar but has the navigation:
`All reports`, `Analytics`, `Inventory`, `Users`, `Rooms`, `Notifications`.

The all-reports view is table-first. Include filter chips for status, priority,
department, building, and technician. The report detail panel adds:

- Status select.
- Priority select.
- Technician assignment select.
- Internal activity log.
- `Save changes` action.

Analytics should show:

- Open vs resolved monthly bar chart.
- Most reported items horizontal bars.
- Average resolution time KPI.
- Reports by building or department.
- Open, in progress, and resolved summary cards.

Inventory should show equipment ID, item, room, department, condition, and
last repair. Rooms should show building, room number, active reports, QR
entry-point action, and condition summary.

## Prototype connections

Use `On click` interactions with `Smart animate`, 250 ms, `Ease out`, unless
otherwise noted.

| From | Trigger | To |
| --- | --- | --- |
| Landing | `Sign in` | Auth / Sign in / Student |
| Landing | `Get started` | Auth / Sign up / Student |
| Auth / Sign in | `Continue as Student` | Student / Dashboard |
| Auth / Sign in | `Continue as Faculty` | Faculty / Dashboard |
| Auth / Sign in / Admin | `Sign in as Admin` | Admin / All reports |
| Auth / Sign up | `Create account` | Matching role / Dashboard |
| Student / Dashboard | `New report` | Student / New report |
| Faculty / Dashboard | `New report` | Faculty / New report |
| New report | `Submit report` | Duplicate warning |
| Duplicate warning | `Continue anyway` | My reports |
| Duplicate warning | `View similar reports` | My reports |
| My reports | Select report | Report detail |
| Faculty / Department reports | Select report | Faculty / Report detail |
| Admin / All reports | Select report | Admin / Report detail |
| Report detail | Close panel | Previous list frame |
| Report detail | `Reply` | Same frame with new comment |
| Admin / Report detail | `Save changes` | Same frame with updated status |
| Admin / Sidebar | `Analytics` | Admin / Analytics |
| Admin / Sidebar | `Inventory` | Admin / Inventory |
| Admin / Sidebar | `Users` | Admin / Users |
| Admin / Sidebar | `Rooms` | Admin / Rooms |
| Any app frame | Notification bell | Matching role / Notifications |
| Resolved report | `Rate repair` | Same frame with feedback state |

Set the prototype starting point to `Public / Landing / Desktop`. Add a second
starting point on `Public / Landing / Mobile` for responsive review.

## Content fixtures

Use these realistic sample records consistently across frames:

- `FX-1042` Aircon leaking onto floor, Room 204, Critical, In progress,
  technician R. Aquino.
- `FX-1041` Broken projector signal, Room 101, High, Under review.
- `FX-1029` Missing chair, Room 204, Medium, Resolved.
- Users: Juan Dela Cruz, Maria Santos, Mrs. Bautista, Coach Dizon, R. Aquino.
- Inventory: EQ-201 Split-type aircon, EQ-118 Ceiling projector,
  EQ-330 Student chair set, EQ-412 Desktop PC Unit 12.

## Responsive behavior

- At 1024 px, collapse the sidebar and keep the top bar.
- At 768 px, stack two-column forms and analytics cards.
- At 480 px, use 16 px gutters, full-width buttons, cards without extra outer
  padding, and bottom navigation.
- Preserve 44 px minimum touch targets.
- Keep status and priority badges visible on mobile; move secondary metadata
  below the title.

## Handoff checklist

- Every frame uses named layers and Auto Layout.
- All repeated UI is a component, not a detached copy.
- Status, priority, role, and responsive variants are documented.
- Prototype starts at the landing page and has working role-specific paths.
- Desktop and mobile report flows are connected.
- Text styles and color styles use the token names from this document.
- Export the `Brand mark` component as SVG if the engineering team needs a
  standalone asset.
