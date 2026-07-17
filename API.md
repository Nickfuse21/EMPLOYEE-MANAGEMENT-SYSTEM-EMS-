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

## Health

### GET `/health`
Liveness probe → `{ "success": true, "status": "ok", "timestamp": "..." }`
