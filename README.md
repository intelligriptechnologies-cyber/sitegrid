# SITEGRID — Builder Workforce, Site, Attendance & Wage Management (Demo)

A pure-client, no-backend demo of the BRD in `brd.md`. It is a single-page
app built with plain HTML, CSS, and JavaScript (no frameworks, no build
step, no server). All data is seeded on load (`data.js`); edits made during
the demo (approvals, attendance, expenses, etc.) persist in the browser's
localStorage across sessions until explicitly reset.

Visual direction: futuristic, minimalistic, monochromatic — ink/white
base with a single teal accent, monospace labels, no gradients or
decorative color.

## How to run

No install, no build, no dependencies.

**Option A — just open it**
Double-click `index.html` (or open it from your browser: File → Open).

**Option B — local static server (recommended, avoids browser file:// quirks)**
```bash
# from this folder
npx serve .
# or
python -m http.server 8000
```
Then visit the printed local URL.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell — sidebar, topbar, content mount point |
| `styles.css` | Full monochrome/teal design system |
| `data.js` | All seed data (departments, sites, labour, attendance, wages, expenses, tools, safety equipment, materials, users, approvals, audit log) |
| `app.js` | Routing, rendering, role-based access simulation, interactive demo actions |
| `core/auth.js` | User authentication, sign-in validation, OTP logic, role scope computation, and the `Session` (sessionStorage) helper |
| `core/login.js` | Login screen rendering and interaction (user picker, mobile input, OTP) |
| `core/store.js` | localStorage persistence layer for the data tables |
| `tests/phase1.test.js` | Phase 1 spec tests (run with `node tests/phase1.test.js`) |

## How to demo the role model

Sign in via the login screen:

1. **Choose a user** from the "Select user (demo)" dropdown
2. **Mobile number** is prefilled and editable
3. Tap **Send OTP** (demo OTP: `1111`)
4. Enter OTP and tap **Verify & Sign in**

Demo account details:
- **9 users** with demo mobiles `9876500001`–`9876500009`
- **`9876500009` (Bikash Jena) is inactive**
- Unregistered or inactive numbers show "Contact Admin to configure access"

Department access:
- **Super Admin & Business Owner**: see "All Departments" + each department in top bar dropdown (switchable)
- **Department Head & Project roles**: fixed to their assigned department(s); Kiran Sahu maps to 2 departments and can switch between them
- **Sidebar tabs**: "Departments" and "Users & Roles" visible only to Super Admin and Business Owner

Data & session:
- **Persist in localStorage**: edits survive browser refresh
- **Session login** stored in sessionStorage
- **"Reset demo data"** link on login screen clears all local data and reloads
- To log out and reach the reset link, use the **Logout** button (top right)

## Scenario coverage map

Every functional requirement in `brd.md` Section 4.1 (Phase 1 scope) is
represented with seeded data and, where the BRD implies an action, a
working interaction. This table maps BRD section → screen → what's
seeded/demoable.

| # | BRD Requirement (Section) | Screen | What's demoed |
|---|---|---|---|
| 1 | User & role management (5.1, 6.1) | **Users & Roles** | 5 roles (Super Admin → Project Engineer), 9 users spanning all roles, one inactive user, role-hierarchy permission table rendered directly from the access matrix |
| 2 | Department setup (6.2) | **Departments** | 3 departments (Civil, Electrical, Plumbing) each with a head, linked sites, and staff count; "New Department" form (Departments tab visible only to Super Admin and Business Owner) |
| 3 | Site/project creation with GPS (6.3, 6.12) | **Sites & Projects** | 5 sites across Active / Paused / Completed states, each with numeric GPS lat/lng, area, client, address, timeline, assigned PM/PE; "New Site" form captures GPS as numeric fields |
| 4 | Labour/manpower onboarding (6.4) | **Manpower** | 8 labour records covering Approved, Pending, and Rejected states, searchable by name/phone/Aadhaar/site; "Add Labour" form live-checks Aadhaar for duplicates |
| 5 | Duplicate Aadhaar prevention (6.4) | **Manpower → Add Labour** | Pre-seeded rejected record (Labour ID 4, Ajay Nath) with reason "Duplicate Aadhaar number"; the Add Labour form blocks a new submission reusing an active Aadhaar and shows the same message live |
| 6 | Labour transfer between sites (6.4) | **Manpower** | Labour ID 5 (Dilip Pradhan) shows a Transfer column: Tower 1 → Tower 2 with date and mover |
| 7 | Labour approval workflow (6.5) | **Approvals** | Full request log (requested by, request date, approver, decision date, status); Approve/Reject buttons for Level 0–2 roles, with a rejection-reason prompt that updates the labour record live |
| 8 | Daily attendance (6.6) | **Attendance** | Present / Absent / Half Day / Leave all represented across two dates, with check-in/out times and optional GPS; "Mark Attendance" form blocks duplicate (labour+site+date) entries |
| 9 | Wage & payment tracking (6.7) | **Wages & Payments** | Pending / Partially Paid / Paid statuses, advance vs balance payable; "Mark Paid" action for Level 0–3 roles |
| 10 | Petty expense tracking (6.8) | **Petty Expenses** | 5 categorised entries, one awaiting approval (`approvedBy: null`) to demonstrate the pending-review state described as future scope; "Add Expense" form |
| 11 | Tools tracking, text entry (6.9) | **Tools & Safety** | Free-text tool inventory per site, matching the Phase 1 "text box" requirement exactly |
| 12 | Safety equipment tracking, text entry (6.10) | **Tools & Safety** | Free-text safety equipment inventory per site, alongside tools |
| 13 | Material tracking, client vs company (6.11) | **Materials** | 6 material entries split into Client Provided / Company Provided tables |
| 14 | GPS capture for sites (6.12) | **Sites & Projects** | Every site card shows a numeric GPS chip; the New Site form requires lat/lng as numbers |
| 15 | Dashboards & reports (6.13) | **Dashboard**, **Reports** | KPI tiles (active sites, manpower, pending approvals, today's attendance, wage outstanding, expense total), department summary, site-wise report table, labour approval report |
| 16 | Role-based access control (5.2) | All screens | `ACCESS_MATRIX` in `data.js` drives every enable/disable state; Departments and Users & Roles are hidden from non-admin roles; other restricted actions are disabled |
| 17 | Audit trail (9.2) | **Audit Log**, **Dashboard** | Every interactive demo action (add labour, approve/reject, mark attendance, mark wage paid, add expense, add site/department) appends a real audit entry, on top of 9 pre-seeded historical entries |
| 18 | Active/inactive status (6.1, 6.4) | **Users & Roles**, **Manpower** | Inactive user (Bikash Jena) and inactive/pending labour records both shown with status indicators |
| 19 | Site status lifecycle (6.3) | **Sites & Projects** | Active, Paused, and Completed sites all seeded to show every state |
| 20 | Scalable department model (2, 6.2) | **Departments** | Adding a department via the form demonstrates the architecture is not hardcoded to 3 |

## Data conventions used in the seed set

- IDs are plain sequential numbers (`1, 2, 3…`) — no invented mixed
  alphanumeric codes.
- Fields that are naturally numeric in the real world (Aadhaar, phone,
  wage rate, GPS coordinates, area) are stored as numbers or numeric
  strings only.
- Fields that are naturally text (names, addresses, remarks, tool/safety
  descriptions) are plain words — mixed alphanumeric only appears where
  the real field itself would have it (e.g. a biometric reference ID
  like `BIO10001`, since biometric device references are typically
  alphanumeric in practice).
- Dates are seeded around September 2026 to stay close to "today" in
  this demo environment.

## Known limitations (by design, since this is a demo)

- No backend server — all data and logic run client-side in the browser.
- Authentication is via a demo login screen with hardcoded OTP (`1111`);
  not suitable for production.
- Wage payable figures are pre-computed in the seed data rather than
  derived live from every attendance row, to keep the dataset legible;
  the "Mark Paid" action still updates state live to demonstrate the
  workflow.
- Items explicitly marked "Future Scope" in the BRD (biometric device
  integration, mobile GPS tracking, payroll automation, vendor
  management, client billing, document/photo upload, notifications,
  advanced analytics) are intentionally out of scope for this Phase 1
  demo, matching the BRD itself.
