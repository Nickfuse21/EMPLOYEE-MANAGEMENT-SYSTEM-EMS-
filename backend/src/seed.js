/**
 * Database seed script  (run with:  npm run seed).
 *
 * Creates a Super Admin plus a small, realistic set of employees wired into a
 * reporting hierarchy, so the app is immediately demoable. Safe to re-run: it
 * wipes the Employee collection first.
 *
 * Demo logins (all use the same password unless noted):
 *   Super Admin : SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  (from .env)
 *   HR Manager  : hr@ems.com       / Password@123
 *   Employee    : john@ems.com     / Password@123
 */
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { Employee } from './models/Employee.js';
import { LeaveRequest, countLeaveDays } from './models/LeaveRequest.js';
import { Ticket } from './models/Ticket.js';
import { PolicyDoc } from './models/PolicyDoc.js';
import { env } from './config/env.js';
import { ROLES, ROLE_VALUES } from './utils/roles.js';

const DEMO_PASSWORD = 'Password@123';

async function seed() {
  await connectDatabase();
  console.log('🌱 Seeding database...');

  // Start from a clean slate for repeatable demos.
  await Promise.all([
    Employee.deleteMany({}),
    LeaveRequest.deleteMany({}),
    Ticket.deleteMany({}),
    PolicyDoc.deleteMany({}),
  ]);

  // NOTE: create documents individually so the pre-save hooks (password hash +
  // employeeId generation) run for each one.

  // 1) Super Admin — top of the tree, no manager.
  const admin = await Employee.create({
    name: 'System Administrator',
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    role: ROLES.SUPER_ADMIN,
    department: 'Management',
    designation: 'Chief Executive Officer',
    phone: '+1 555 0100',
    salary: 250000,
    status: 'active',
  });

  // 2) HR Manager — reports to the admin.
  const hr = await Employee.create({
    name: 'Priya Sharma',
    email: 'hr@ems.com',
    password: DEMO_PASSWORD,
    role: ROLES.HR_MANAGER,
    department: 'Human Resources',
    designation: 'HR Manager',
    phone: '+1 555 0101',
    salary: 120000,
    reportingManager: admin._id,
    status: 'active',
  });

  // 3) An engineering lead — reports to the admin.
  const engLead = await Employee.create({
    name: 'David Chen',
    email: 'david@ems.com',
    password: DEMO_PASSWORD,
    role: ROLES.EMPLOYEE,
    department: 'Engineering',
    designation: 'Engineering Manager',
    phone: '+1 555 0102',
    salary: 160000,
    reportingManager: admin._id,
    status: 'active',
  });

  // 4) Engineers — report to the engineering lead.
  const john = await Employee.create({
    name: 'John Doe',
    email: 'john@ems.com',
    password: DEMO_PASSWORD,
    role: ROLES.EMPLOYEE,
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    phone: '+1 555 0103',
    salary: 92000, // Below the Engineering median → demonstrates flight-risk scoring.
    joiningDate: new Date('2019-03-01'), // Long tenure → tenure-stagnation factor.
    reportingManager: engLead._id,
    status: 'active',
  });

  await Employee.create({
    name: 'Sara Ali',
    email: 'sara@ems.com',
    password: DEMO_PASSWORD,
    role: ROLES.EMPLOYEE,
    department: 'Engineering',
    designation: 'Software Engineer',
    phone: '+1 555 0104',
    salary: 90000,
    reportingManager: engLead._id,
    status: 'inactive', // Demonstrates the "inactive" metric.
  });

  // 5) A recruiter — reports to HR.
  await Employee.create({
    name: 'Michael Brown',
    email: 'michael@ems.com',
    password: DEMO_PASSWORD,
    role: ROLES.EMPLOYEE,
    department: 'Human Resources',
    designation: 'Talent Recruiter',
    phone: '+1 555 0105',
    salary: 70000,
    reportingManager: hr._id,
    status: 'active',
  });

  // --- Leave requests (drives balances + the flight-risk signal) ------------
  const leaveRange = (type, status, start, end) => ({
    employee: john._id,
    type,
    status,
    startDate: new Date(start),
    endDate: new Date(end),
    days: countLeaveDays(start, end),
    reason: `${type} leave`,
    ...(status !== 'pending' ? { reviewedBy: hr._id, reviewedAt: new Date() } : {}),
  });
  await LeaveRequest.create([
    leaveRange('annual', 'approved', '2026-02-10', '2026-02-24'), // 15 approved days
    leaveRange('sick', 'approved', '2026-04-06', '2026-04-08'),
    leaveRange('unpaid', 'approved', '2026-05-18', '2026-05-19'), // unpaid → risk signal
    leaveRange('casual', 'pending', '2026-08-03', '2026-08-04'), // awaiting HR decision
  ]);

  // --- Helpdesk tickets ------------------------------------------------------
  await Ticket.create([
    {
      subject: 'VPN keeps disconnecting',
      description: 'My VPN drops every 10 minutes when working from home.',
      category: 'it',
      priority: 'high',
      status: 'open',
      raisedBy: john._id,
    },
    {
      subject: 'Payslip missing for June',
      description: "I can't find my June payslip in the portal.",
      category: 'payroll',
      priority: 'medium',
      status: 'in_progress',
      raisedBy: john._id,
      assignedTo: hr._id,
    },
  ]);

  // --- Policy handbook (Policy Assistant corpus) -----------------------------
  // Note the `audience` field: the compensation doc is Super-Admin-only, so a
  // standard employee's question can never surface it.
  await PolicyDoc.create([
    {
      title: 'Annual & Sick Leave Policy',
      category: 'leave',
      audience: ROLE_VALUES,
      content:
        'Every full-time employee receives 20 days of paid annual leave, 10 days of sick leave, and 5 days of casual leave per calendar year.\n\n' +
        'Annual leave must be requested at least two weeks in advance and approved by your manager. Sick leave can be applied for retroactively with a doctor\'s note for absences longer than three days.\n\n' +
        'Unused annual leave does not carry over to the next year. Unpaid leave may be granted at management discretion once paid balances are exhausted.',
    },
    {
      title: 'Travel & Expense Reimbursement',
      category: 'travel',
      audience: ROLE_VALUES,
      content:
        'The daily meal reimbursement limit for domestic travel is 60 USD and 90 USD for international travel. Hotel stays are reimbursed up to 200 USD per night.\n\n' +
        'Submit receipts within 30 days of travel through the expense portal. Claims above the stated limits require prior written approval from your department head.\n\n' +
        'Personal expenses, mini-bar charges, and in-flight entertainment are not reimbursable.',
    },
    {
      title: 'Remote Work & IT Security',
      category: 'it',
      audience: ROLE_VALUES,
      content:
        'Employees may work remotely up to three days per week with manager approval. You must connect through the company VPN when accessing internal systems.\n\n' +
        'Company laptops must have full-disk encryption enabled and screen-lock set to five minutes. Report any lost or stolen device to the IT helpdesk immediately.\n\n' +
        'Never share your credentials. Enable multi-factor authentication on all company accounts.',
    },
    {
      title: 'Code of Conduct',
      category: 'conduct',
      audience: ROLE_VALUES,
      content:
        'We are committed to a respectful, harassment-free workplace. Discrimination on the basis of race, gender, religion, age, or disability is strictly prohibited.\n\n' +
        'Report concerns confidentially to HR or through the anonymous ethics hotline. Retaliation against anyone who raises a good-faith concern is itself a serious violation.',
    },
    {
      title: 'Compensation Bands & Bonus Structure',
      category: 'compensation',
      audience: [ROLES.SUPER_ADMIN], // Executive-only — never shown to HR or employees.
      content:
        'Level L1 engineers are banded at 70,000–95,000 USD, L2 at 95,000–130,000 USD, and L3 at 130,000–175,000 USD.\n\n' +
        'The annual bonus pool is 12% of base payroll, allocated on performance rating. Equity refresh grants are reviewed each March by the executive committee.',
    },
  ]);

  const total = await Employee.countDocuments();
  console.log(`✅ Seed complete — ${total} employees created.`);
  console.log('   + leave requests, helpdesk tickets, and 5 handbook policies.');
  console.log('\nDemo logins:');
  console.log(`  Super Admin : ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
  console.log(`  HR Manager  : hr@ems.com / ${DEMO_PASSWORD}`);
  console.log(`  Employee    : john@ems.com / ${DEMO_PASSWORD}`);

  await disconnectDatabase();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await disconnectDatabase();
  process.exit(1);
});
