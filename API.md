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

### Authentication

The API accepts the JWT in **either** of two ways:

- an http-only cookie named `ems_token` (set automatically on login), or
- an `Authorization: Bearer <token>` header.

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

**401** — invalid credentials.

### POST `/auth/logout`
Clears the auth cookie. → `200 { "success": true }`

### GET `/auth/me` 🔒
Returns the currently authenticated user.

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

### GET `/leave/balance` 🔒
The caller's own remaining balance per paid leave type.
```json
{ "success": true, "data": [ { "type": "annual", "allowance": 20, "used": 5, "remaining": 15 } ] }
```

### GET `/leave` 🔒
Employees receive only their own requests; HR & Super Admin receive everyone's
(optionally filtered by `?status=`).

### POST `/leave` 🔒
Apply for leave (always on your own behalf). Body: `type` (`annual|sick|casual|unpaid`),
`startDate`, `endDate`, optional `reason`. Day count is computed server-side. → `201`

### PATCH `/leave/:id/decision` 🔒 · Super Admin, HR
Approve or reject a pending request. Body: `{ "decision": "approved" | "rejected", "reviewNote": "" }`.
An approval is what draws down the balance.

### PATCH `/leave/:id/cancel` 🔒
The owner (or a manager) cancels a still-pending request.

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
