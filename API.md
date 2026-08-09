# EMS API Reference

Base URL: `http://localhost:5000/api`

All responses are JSON. Successful responses include `"success": true`.
Errors follow a consistent shape:

```json
{
  "success": false,
  "message": "Human-readable error",
  "details": { "field": "reason" }   // present for validation errors only
}
```

Common status codes: `400` validation, `401` unauthenticated, `403` forbidden,
`404` missing, `409` conflict, `413` body too large, `422` business rule
violated, `429` rate limited.

### Authentication

The API accepts the JWT in **either** of two ways:

- an http-only cookie named `ems_token` (set automatically on login), or
- an `Authorization: Bearer <token>` header.

Every request re-loads the caller from the database and authorises against the
**stored** role, not the role claimed inside the token. Tokens also carry a
session version, so a password change or `/auth/logout-all` invalidates them
immediately rather than leaving them valid until expiry.

### Rate limits

| Scope | Limit |
|-------|-------|
| `/api/auth/login`, `/api/auth/change-password` | 5 **failed** attempts per 15 min per IP |
| Everything else under `/api` | 300 requests per 15 min per IP |
| `/api/health` | Not limited, so uptime probes are never throttled |

Exceeding a limit returns `429` in the standard error shape.

---

## Auth

### POST `/auth/login`
Authenticate and receive a token.

**Body**
```json
{ "email": "admin@ems.com", "password": "Admin@123" }
```

**200**
```json
{
  "success": true,
  "message": "Logged in successfully",
  "token": "<jwt>",
  "user": { "_id": "...", "name": "System Administrator", "role": "super_admin", ... }
}
```

**401** — invalid credentials. The message is identical for an unknown email and
a wrong password, so the endpoint cannot be used to discover which emails exist.

**429** — either too many attempts from this IP (5 failures per 15 minutes) or
the account itself is locked after 5 consecutive failures. A locked account is
refused *before* the password is checked, so the lock cannot be used to confirm a
correct password.

### POST `/auth/logout`
Clears the auth cookie. → `200 { "success": true }`

Note this only drops the cookie — a bearer token already issued keeps working
until it expires. Use `/auth/logout-all` to actually revoke it.

### POST `/auth/logout-all` 🔒
Revokes **every** session for the caller by bumping their token version. Tokens
already handed out — including any an attacker holds — stop working immediately.
→ `200 { "success": true }`

### POST `/auth/change-password` 🔒
Rotate your own password. Requires the current one, so a hijacked session cannot
lock the real owner out. On success **all sessions are revoked** and the caller
must log in again.

**Body**
```json
{ "currentPassword": "Password@123", "newPassword": "Brand@NewPass9" }
```

The new password must be 10–72 characters with lower case, upper case, a digit,
and a symbol, and must not be a commonly-used password.

- **400** — the new password is weak or the same as the current one.
- **401** — the current password is wrong.

### GET `/auth/me` 🔒
Returns the currently authenticated user.

**401** is returned when the token is invalid, the account was deleted, **or the
session has been revoked** since the token was issued.

---

## Employees

> 🔒 = requires authentication. Role requirements noted per-endpoint.

### GET `/employees` 🔒 · Super Admin, HR
List employees with search / filter / sort / pagination.

**Query params**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Matches name or email (case-insensitive) |
| `department` | string | Exact department |
| `role` | enum | `super_admin` \| `hr_manager` \| `employee` |
| `status` | enum | `active` \| `inactive` |
| `sortBy` | enum | `name` \| `joiningDate` \| `salary` \| `createdAt` |
| `order` | enum | `asc` \| `desc` (default `desc`) |
| `page` | number | Default `1` |
| `limit` | number | Default `10`, max `100` |

**200**
```json
{
  "success": true,
  "data": [ { "...employee..." } ],
  "pagination": { "total": 6, "page": 1, "limit": 10, "totalPages": 1 }
}
```

### POST `/employees` 🔒 · Super Admin, HR
Create an employee. HR cannot create a Super Admin.

**Body** (required: `name`, `email`, `password`)
```json
{
  "name": "Jane Smith",
  "email": "jane@ems.com",
  "password": "Secret@123",
  "phone": "+1 555 0110",
  "department": "Engineering",
  "designation": "Software Engineer",
  "salary": 95000,
  "joiningDate": "2026-01-15",
  "status": "active",
  "role": "employee",
  "reportingManager": "<employeeObjectId | null>",
  "profileImage": "https://…"
}
```
→ `201` with the created employee.

### GET `/employees/:id` 🔒
Fetch one employee. Employees may only fetch their own record.

### PUT `/employees/:id` 🔒
Update an employee.
- **Employee:** may edit only their own `name`, `phone`, `profileImage`.
- **HR:** may edit anyone except a Super Admin; cannot grant Super Admin role.
- **Super Admin:** may edit anything.

Send only the fields you want to change. Omit `password` to keep the current one.

### DELETE `/employees/:id` 🔒 · Super Admin
Soft-deletes the employee (sets `isDeleted`, marks inactive) and re-parents any
direct reports to the deleted employee's manager. → `200`

---

## Organisation / Hierarchy

### GET `/employees/:id/reportees` 🔒 · Super Admin, HR
Returns the direct reports of an employee.
```json
{ "success": true, "manager": {...}, "count": 2, "data": [ {...}, {...} ] }
```

### PATCH `/employees/:id/manager` 🔒 · Super Admin, HR
Assign or clear an employee's reporting manager.
Rejected (400) if it would create a circular relationship.

**Body**
```json
{ "reportingManager": "<employeeObjectId>" }   // or null to clear
```

### GET `/organization/tree` 🔒
Returns the full nested reporting hierarchy. Root nodes are employees with no
manager; every node has a recursive `directReports` array.

### GET `/organization/my-team` 🔒
Personalised team view for the logged-in user (any role): their manager, peers
(colleagues sharing the same manager), and their own direct reports.
```json
{
  "success": true,
  "data": {
    "manager": { "...employee..." },
    "peers": [ {...}, {...} ],
    "directReports": [ {...} ]
  }
}
```

---

## Dashboard

### GET `/dashboard/stats` 🔒 · Super Admin, HR
Returns summary metrics, grouped breakdowns for the charts, and the five most
recent hires. **`totalPayroll` and `avgSalary` are included only for a Super
Admin** — HR never receives them.
```json
{
  "success": true,
  "data": {
    "totalEmployees": 6,
    "activeEmployees": 5,
    "inactiveEmployees": 1,
    "departmentCount": 3,
    "byDepartment": [ { "department": "Engineering", "count": 3 } ],
    "byRole": [ { "role": "employee", "count": 4 } ],
    "recentHires": [ { "...employee..." } ],
    "totalPayroll": 800000,   // Super Admin only
    "avgSalary": 133333       // Super Admin only
  }
}
```

---

## Audit trail

### GET `/audit` 🔒 · Super Admin
Append-only security log, newest first. Read-only — entries are never edited or
deleted.

**Query params:** `action` (e.g. `auth.login_failed`, `employee.salary_changed`),
`search` (matches actor / target / summary), `page`, `limit`.
```json
{
  "success": true,
  "data": [
    { "action": "employee.salary_changed", "actorName": "System Administrator",
      "targetName": "John Doe", "summary": "Salary changed 90000 → 95000",
      "ip": "::1", "createdAt": "2026-07-18T09:00:00.000Z" }
  ],
  "pagination": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

---

## Leave

Leave is measured in **working days**: weekends and dates in the holiday
calendar are never charged against an entitlement.

### GET `/leave/balance` 🔒
The caller's balance per capped leave type, for the current leave year.
```json
{
  "success": true,
  "data": [
    { "type": "annual", "allowance": 20, "used": 5, "pending": 2, "remaining": 13 }
  ]
}
```

`pending` counts days that have been requested but not yet decided. They are
subtracted from `remaining` too — otherwise several individually-affordable
requests could all be approved and take the employee over their entitlement.

### POST `/leave/preview` 🔒
Prices a date range **without** submitting it, so the UI can show what a request
will cost before the employee commits.

**Body:** `startDate`, `endDate`, optional `halfDay`.

**200**
```json
{
  "success": true,
  "data": {
    "workingDays": 5,
    "calendarDays": 8,
    "excluded": [
      { "date": "2026-08-05", "reason": "Founders Day" },
      { "date": "2026-08-08", "reason": "Weekend" }
    ]
  }
}
```

### GET `/leave` 🔒
By default a user receives their own requests **plus anything awaiting their
decision**; HR & Super Admin receive everyone's.

| Query | Type | Description |
|-------|------|-------------|
| `status` | enum | `pending` \| `approved` \| `rejected` \| `cancelled` |
| `scope` | enum | `inbox` — only pending requests routed to the caller. `mine` — for HR, only their own requests. |

### POST `/leave` 🔒
Apply for leave (always on your own behalf).

**Body:** `type` (`annual\|sick\|casual\|unpaid`), `startDate`, `endDate`,
optional `reason`, optional `halfDay` (`first_half\|second_half`, single date only).

The day count is computed server-side from the working-day calendar, and the
request is routed to the employee's reporting manager (`pendingWith`), or left
for HR when they have none.

- **201** — created.
- **400** — the range is backwards, or contains no working days at all.
- **409** — the dates overlap an existing pending or approved request.
- **422** — not enough remaining entitlement of that type.

### PATCH `/leave/:id/decision` 🔒
Approve or reject a pending request. Body:
`{ "decision": "approved" | "rejected", "reviewNote": "" }`.

Permitted for the manager the request was routed to, or for HR / Super Admin —
**not** restricted by role alone, since a reporting manager is usually a regular
employee. Nobody may decide their own request, including HR. The balance is
re-checked at approval time, because other requests may have been approved since
this one was submitted.

- **403** — not your request to decide, or it is your own.
- **400** — already decided.

### PATCH `/leave/:id/cancel` 🔒
The owner (or HR) cancels a request. Pending requests can always be withdrawn; an
approved request can be cancelled while it is still in the future, which returns
the days to the balance. Once approved leave has started, only HR can cancel it.

---

## Holiday calendar

Public holidays are data rather than code, so HR can maintain them without a
deployment. Every holiday changes what leave costs across the whole company.

### GET `/holidays` 🔒
The calendar for one year (`?year=2026`, defaults to the current year), earliest
first. Readable by any authenticated user — the leave form needs it.

### POST `/holidays` 🔒 · Super Admin, HR
Body: `date` (ISO), `name`, optional `region`. → `201`
**409** if that date is already a holiday.

### DELETE `/holidays/:id` 🔒 · Super Admin, HR
Removes a holiday. → `200`

---

## Helpdesk tickets

### GET `/tickets` 🔒
Employees see only tickets they raised; HR & Super Admin see all (filter with
`?status=` / `?category=`).

### POST `/tickets` 🔒
Raise a ticket. Body: `subject`, `description`, `category` (`it|hr|payroll|facilities|other`),
`priority` (`low|medium|high|urgent`). A `ticketId` like `TKT-0001` is generated. → `201`

### GET `/tickets/:id` 🔒
One ticket with its full comment thread (owner or agent only).

### PATCH `/tickets/:id` 🔒 · Super Admin, HR
Triage — change `status`, `priority`, `category`, or `assignedTo`.

### POST `/tickets/:id/comments` 🔒
Add a comment to the thread (owner or agent). Body: `{ "body": "…" }`. → `201`

---

## Analytics

### GET `/analytics/attrition` 🔒 · Super Admin, HR
Transparent, rule-based flight-risk score (0–100) for every active employee,
highest first, plus a per-band summary. Each score lists the exact factors that
produced it.
```json
{
  "success": true,
  "data": {
    "summary": { "high": 1, "medium": 2, "low": 3 },
    "employees": [
      {
        "employee": { "name": "John Doe", "department": "Engineering", "...": "..." },
        "score": 65, "band": "medium",
        "factors": [
          { "label": "Paid 34% below the Engineering median", "points": 30 },
          { "label": "Took 2 day(s) of unpaid leave", "points": 15 }
        ]
      }
    ]
  }
}
```

---

## Policy Assistant

### GET `/policies` 🔒
Lists the handbook documents the caller's role is allowed to see (titles +
categories). Restricted docs (e.g. `compensation`) never appear for the wrong role.

### POST `/policies/ask` 🔒
Ask a plain-English question. The search runs **only over documents the caller may
see**, so restricted content can never leak. Body: `{ "question": "what is the travel meal limit?" }`.
```json
{
  "success": true,
  "data": {
    "answer": "The daily meal reimbursement limit for domestic travel is 60 USD…",
    "matchedTerms": ["travel", "meal", "reimbursement", "limit"],
    "citations": [ { "title": "Travel & Expense Reimbursement", "category": "travel", "passage": "…" } ]
  }
}
```

### GET `/policies/:id` 🔒
Read one full document — 404 if it is outside the caller's audience (we don't
reveal that it exists).

---

## Health

### GET `/health`
Liveness probe → `{ "success": true, "status": "ok", "timestamp": "..." }`
