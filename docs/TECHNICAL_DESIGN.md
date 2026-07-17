# EMS — Architecture & How It Works

> A plain-English walkthrough of how this Employee Management System is built.
> Everything here describes **code that actually runs in this repo** — no
> buzzwords, nothing you can't point to in the source. Use it to revise before an
> interview or demo.

---

## 1. What the app does

A small full-stack web app to manage employees with:

- **Login / logout** with secure passwords (JWT + bcrypt).
- **Three roles** — Super Admin, HR Manager, Employee — each sees and does
  different things.
- **Employee CRUD** — create, read, update, delete (soft delete).
- **Org chart** — who reports to whom, shown as a tree.
- **Dashboard** — counts and simple charts.
- **Search / filter / sort / pagination** on the employee list.

## 2. Tech stack (and why)

| Layer | Choice | Why I picked it (interview answer) |
|-------|--------|------------------------------------|
| Frontend | **React + TypeScript + Vite + Tailwind** | Component-based UI, TypeScript catches bugs early, Vite is fast, Tailwind keeps styling in the markup. |
| Backend | **Node.js + Express** | JavaScript on both sides, Express is a simple, well-known way to build a REST API. |
| Database | **MongoDB + Mongoose** | Flexible schema; the "reporting manager" reference makes the org tree easy. |
| Auth | **JWT + bcrypt** | JWT = stateless login token; bcrypt = one-way password hashing. |

> One honest line for the interview: *"It's a MERN-style app — MongoDB, Express,
> React, Node — with TypeScript on the frontend."*

## 3. Folder structure

```
ems/
├── backend/
│   └── src/
│       ├── config/       # env variables + DB connection
│       ├── models/       # Mongoose Employee schema
│       ├── middleware/   # auth check, role check, validation, errors
│       ├── controllers/  # the actual logic for each route
│       ├── routes/       # URL → controller wiring
│       ├── services/     # org-tree helper (kept out of controllers)
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

**Why split it this way?** Each folder has one job. If someone asks "where does
login live?", the answer is obvious: `controllers/authController.js`.

## 4. How login works (JWT + bcrypt)

Two things you should be ready to explain:

1. **Passwords are never stored as plain text.** When an employee is created,
   a `pre('save')` hook in the model hashes the password with **bcrypt** before
   it hits the database. bcrypt is one-way — you can't reverse it.
2. **Login returns a token, not a session.** On correct email + password, the
   server signs a **JWT** (JSON Web Token) containing the user's id and role.
   The browser sends that token on every later request; the server verifies it
   and knows who you are. No server-side session storage needed.

```
Login flow:
  email+password ─▶ find user ─▶ bcrypt.compare(password, storedHash)
                                        │
                          ✅ match ─────┴──▶ sign JWT ──▶ send to browser (cookie)
                          ❌ no match ─────▶ 401 "Invalid email or password"
```

**Protected routes:** a middleware (`authenticate`) reads the token, verifies it,
loads the user, and attaches it to the request. If the token is missing or fake,
the request is rejected before it reaches any controller.

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
   Admin"). The frontend also hides buttons, but the **backend is the real
   guard** — the UI is just for convenience.

> Interview soundbite: *"The client hides what you can't use, but I never trust
> the client — every rule is re-checked on the server."*

## 6. The Employee data model

One collection does double duty: it's both the **login account** and the
**employee record**. Every person who logs in is an Employee with a role.

Key fields: `employeeId` (auto `EMP-0001`), `name`, `email`, `password` (hidden),
`phone`, `department`, `designation`, `salary`, `joiningDate`, `status`,
`role`, `reportingManager` (points to another employee), `profileImage`,
`isDeleted` (for soft delete).

**Why `reportingManager` is a reference to another employee:** that single field
is what makes the org chart possible — follow the chain of managers upward and you
have the hierarchy.

## 7. The org chart & "no circular reporting"

- **Tree:** start from people with no manager (the top), then nest each person's
  direct reports under them.
- **Circular check:** before saving a new manager, the code walks *up* the
  manager's own chain. If it ever reaches the employee we're editing, that would
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

## 9. Bonus features I added (and can explain)

- **Pagination** on the employee list (page + limit).
- **Soft delete** — deleting sets `isDeleted: true` instead of erasing the row,
  so nothing is truly lost.
- **Dashboard charts** with Recharts.
- **Dark mode** (Tailwind `dark:` classes + a theme toggle saved in the browser).
- **Docker** files so the whole thing can run with one command.

## 10. Things I'd add with more time

Honest, realistic next steps (good to mention — shows you know what's missing):

- **Automated tests** (Jest for the backend, a couple of endpoint tests).
- **Refresh tokens** so logins last longer safely.
- **Image upload** to a service instead of storing a URL string.
- **Deployment** to a host (Render/Railway for the API, Vercel for the frontend).
- **Rate limiting** on the login route to slow down guessing attacks.

---

*This document intentionally stays at the level of the actual codebase. If you can
explain sections 4–8 out loud, you can defend this project in an interview.*
