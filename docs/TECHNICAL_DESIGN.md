# EMS — Architecture & How It Works

> A plain-English walkthrough of how this Employee Management System is built.
> Everything here describes **code that actually runs in this repo** — no
> buzzwords, nothing that isn't in the source.

---

## 1. What the app does

A full-stack web app to manage employees with:

- **Login / logout** with secure passwords (JWT + bcrypt).
- **Three roles** — Super Admin, HR Manager, Employee — each with different
  permissions.
- **Employee CRUD** — create, read, update, delete (soft delete).
- **Org chart** — who reports to whom, shown as a tree.
- **Dashboard** — counts and charts.
- **Search / filter / sort / pagination** on the employee list.

## 2. Tech stack (and why)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **React + TypeScript + Vite + Tailwind** | Component-based UI, TypeScript catches bugs early, Vite is fast, Tailwind keeps styling in the markup. |
| Backend | **Node.js + Express** | JavaScript on both sides, Express is a simple, well-known way to build a REST API. |
| Database | **MongoDB + Mongoose** | Flexible schema; the "reporting manager" reference makes the org tree easy. |
| Auth | **JWT + bcrypt** | JWT = stateless login token; bcrypt = one-way password hashing. |

It's a MERN-style stack — MongoDB, Express, React, Node — with TypeScript on the
frontend.

## 3. Folder structure

```
ems/
├── backend/
│   └── src/
│       ├── config/       # env variables + DB connection
│       ├── models/       # Mongoose schemas
│       ├── middleware/   # auth check, role check, validation, errors
│       ├── controllers/  # the logic for each route
│       ├── routes/       # URL → controller wiring
│       ├── services/     # helpers kept out of controllers (org-tree, audit, etc.)
│       ├── utils/        # small helpers (errors, JWT, roles)
│       └── server.js     # starts the app
└── frontend/
    └── src/
        ├── api/          # functions that call the backend
        ├── context/      # global state: logged-in user + dark mode
        ├── components/   # reusable UI (layout, buttons, cards)
        ├── pages/        # one file per screen
        └── types/        # shared TypeScript types
```

Each folder has one job, so the logic for any given concern is easy to locate —
login lives in `controllers/authController.js`, and so on.

## 4. How login works (JWT + bcrypt)

Two key points:

1. **Passwords are never stored as plain text.** When an employee is created,
   a `pre('save')` hook in the model hashes the password with **bcrypt** before
   it hits the database. bcrypt is one-way — it can't be reversed.
2. **Login returns a token, not a session.** On a correct email + password, the
   server signs a **JWT** (JSON Web Token) containing the user's id and role.
   The browser sends that token on every later request; the server verifies it
   and knows who the caller is. No server-side session storage needed.

```
Login flow:
  email+password ─▶ find user ─▶ bcrypt.compare(password, storedHash)
                                        │
                          ✅ match ─────┴──▶ sign JWT ──▶ send to browser (cookie)
                          ❌ no match ─────▶ 401 "Invalid email or password"
```

**Protected routes:** a middleware (`authenticate`) reads the token, verifies it,
loads the user, and attaches it to the request. If the token is missing or
invalid, the request is rejected before it reaches any controller.

## 5. How roles work (RBAC — Role-Based Access Control)

Every user has one `role`. The rules:

| Action | Super Admin | HR Manager | Employee |
|--------|:-----------:|:----------:|:--------:|
| View dashboard & all employees | ✅ | ✅ | ❌ |
| Create / edit employees | ✅ | ✅ | ❌ |
| Delete employee | ✅ | ❌ | ❌ |
| Make someone a Super Admin | ✅ | ❌ | ❌ |
| Edit **own** profile only | ✅ | ✅ | ✅ |

**How it's enforced (two layers):**

1. **Route level** — an `authorize('super_admin', 'hr_manager')` middleware
   blocks whole routes for the wrong role.
2. **Data level** — inside the controller, for rules that depend on the data
   (e.g. "an Employee can only edit *their own* record", "HR can't grant Super
   Admin").

The frontend also hides controls the user can't use, but that is purely for UX —
the backend re-checks every rule on the server, so the client is never trusted.

## 6. The Employee data model

One collection does double duty: it's both the **login account** and the
**employee record**. Every person who logs in is an Employee with a role.

Key fields: `employeeId` (auto `EMP-0001`), `name`, `email`, `password` (hidden),
`phone`, `department`, `designation`, `salary`, `joiningDate`, `status`,
`role`, `reportingManager` (points to another employee), `profileImage`,
`isDeleted` (for soft delete).

`reportingManager` is a reference to another employee — that single self-reference
is what makes the org chart possible: follow the chain of managers upward and you
have the hierarchy.

## 7. The org chart & "no circular reporting"

- **Tree:** start from people with no manager (the top), then nest each person's
  direct reports under them.
- **Circular check:** before saving a new manager, the code walks *up* the
  manager's own chain. If it ever reaches the employee being edited, that would
  create a loop (A reports to B who reports to A), so it's rejected. This lives in
  `services/organizationService.js`.

## 8. One request, end to end (example: create an employee)

```
React form ─▶ POST /api/employees ─▶ authenticate (valid token?)
                                   ─▶ authorize (admin or HR?)
                                   ─▶ validate (email valid? name long enough?)
                                   ─▶ controller: check role rules, save to MongoDB
                                   ─▶ 201 Created + the new employee
React list updates ◀──────────────────────────────────────────────┘
```

Every mutating route follows this same pipeline: **authenticate → authorize →
validate → controller**. Errors from any step funnel into one central error
handler that returns a consistent JSON shape.

## 9. Bonus features

- **Pagination** on the employee list (page + limit).
- **Soft delete** — deleting sets `isDeleted: true` instead of erasing the row,
  so nothing is truly lost.
- **Dashboard charts** with Recharts.
- **Dark mode** (Tailwind `dark:` classes + a theme toggle saved in the browser).
- **Docker** files so the whole thing can run with one command.

## 9b. Extended modules (per-role features)

On top of the core CRUD, the app has five modules that give each role something
distinct to do. All of them are plain Node + Mongo with no external services, so
every result is traceable to the data it came from.

### Audit trail (Super Admin)
An **append-only** `AuditLog` collection: every critical action (logins & failed
logins, employee create/update/delete, salary or role changes, leave decisions)
inserts one row via a small `auditService.recordAudit()` helper. It runs as a
*side effect* after the real action succeeds, wrapped in a try/catch so a logging
failure can never break the user's request. Nothing ever updates or deletes a
row — that write-once property is what makes the log trustworthy.

### Leave management (Employee ↔ HR)
Employees apply for leave; HR/Admin approve or reject. The balance is **derived,
not stored**: it sums the days from a person's *approved* requests and subtracts
from the allowance. There's no counter to keep in sync, so the balance can never
drift out of step with the records.

### Helpdesk (Employee ↔ HR)
A `Ticket` model with an embedded comment thread and an auto `TKT-0001` id.
Employees see only their own tickets; HR/Admin see all and can triage. Access is
enforced in the controller (`assertCanView`), not just in the UI.

### Attrition / flight-risk (HR / Super Admin)
A **transparent, weighted rule set** in `attritionService.js`. Each employee gets
a 0–100 score from named factors: pay vs. the department median, leave
utilisation, unpaid leave, open tickets, and tenure. Every point carries a
human-readable reason shown in the UI, so it's always clear why someone is
flagged — there is no black box.

### Policy Assistant (everyone)
Ask the handbook a question and get an answer grounded in real policy text, with
citations. Under the hood it's **keyword-relevance search**
(`policySearchService.js`): tokenise the question, score each paragraph by matching
terms weighted by rarity (the TF-IDF idea), and return the best passage. The key
detail is **access control**: each query filters documents to `audience: <role>`
*before* searching, so a restricted doc (e.g. compensation bands) is never even
loaded for a user who shouldn't see it — it can't leak.

## 10. Future improvements

Realistic next steps:

- **Automated tests** (Jest for the backend, a set of endpoint tests).
- **Refresh tokens** so logins last longer safely.
- **Image upload** to a storage service instead of storing a URL string.
- **Rate limiting** on the login route to slow down guessing attacks.
- **CSV import/export** for bulk employee onboarding.

---

*This document stays at the level of the actual codebase — every section maps to
code that runs in this repository.*
