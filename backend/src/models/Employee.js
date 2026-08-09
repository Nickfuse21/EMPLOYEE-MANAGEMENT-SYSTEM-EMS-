/**
 * Employee model.
 *
 * A single collection represents both the *authentication user* and the
 * *employee record*. Every person who can log in is an Employee with a role,
 * which keeps auth, RBAC, and the reporting hierarchy unified in one document.
 *
 * The `reportingManager` field is a self-reference to another Employee, which
 * is what makes the organisational tree possible.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_VALUES, ROLES } from '../utils/roles.js';
import { nextSequence, formatReference } from './Counter.js';

const { Schema, model } = mongoose;

const employeeSchema = new Schema(
  {
    // Human-friendly unique identifier (e.g. "EMP-0001"), auto-generated below.
    employeeId: {
      type: String,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    // Password is write-only: `select: false` hides it from ordinary queries.
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9+\-\s()]{7,20}$/, 'Please provide a valid phone number'],
    },
    department: { type: String, trim: true, index: true },
    designation: { type: String, trim: true },
    salary: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
      default: 0,
    },
    joiningDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.EMPLOYEE,
      index: true,
    },
    // Self-reference — the employee's direct manager.
    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    profileImage: {
      type: String, // URL or data-URI to an avatar image.
      default: '',
    },
    // Soft-delete flag (bonus feature): records are hidden, never destroyed.
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --- Session & brute-force protection ------------------------------------

    // Incremented whenever every existing session must stop working (password
    // change, "log out everywhere"). Embedded in the JWT and re-checked on each
    // request, which is what makes stateless tokens revocable.
    tokenVersion: { type: Number, default: 0, select: false },

    // Consecutive failed logins, and the time until which this account is
    // locked. IP rate limiting alone does not stop a distributed attack against
    // one account; this does.
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
  },
  {
    timestamps: true, // Adds createdAt / updatedAt automatically.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Pre-save hook: hash the password whenever it is set or changed. Storing only
 * the bcrypt hash means plaintext passwords never touch the database.
 */
employeeSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Pre-save hook: generate a sequential, padded employeeId (EMP-0001, ...) for
 * new documents that don't already have one.
 *
 * The number comes from an atomic counter rather than a document count: two
 * simultaneous creates would otherwise read the same count, build the same ID,
 * and one of them would fail on the unique index. A counter also never re-issues
 * an ID after a record is deleted.
 */
employeeSchema.pre('save', async function assignEmployeeId(next) {
  if (this.employeeId) return next();
  const seq = await nextSequence('employee');
  this.employeeId = formatReference('EMP', seq);
  next();
});

/**
 * Post-save hook: invalidate existing sessions whenever the password changes.
 *
 * Bumping `tokenVersion` makes every already-issued JWT for this user fail the
 * check in the authenticate middleware, so a password change (or an admin
 * resetting it) actually kicks an attacker out instead of leaving their stolen
 * token valid until it expires.
 *
 * The increment is done with `$inc` in the database rather than on the in-memory
 * document, because `tokenVersion` is `select: false` and is usually absent from
 * a loaded document — incrementing an undefined value would reset the counter
 * and silently make old tokens valid again.
 */
employeeSchema.pre('save', function notePasswordChange(next) {
  this.$locals.passwordChanged = this.isModified('password') && !this.isNew;
  next();
});

employeeSchema.post('save', async function revokeSessionsOnPasswordChange(doc) {
  if (!doc.$locals?.passwordChanged) return;
  await doc.constructor.updateOne({ _id: doc._id }, { $inc: { tokenVersion: 1 } });
});

/** Instance method: compare a plaintext candidate against the stored hash. */
employeeSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** True while the account is temporarily locked after repeated failed logins. */
employeeSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
};

/**
 * Ensure secrets are never leaked, even if a document is serialised manually
 * somewhere. `id` (string) is exposed via the virtual `id` getter.
 */
employeeSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    delete ret.__v;
    return ret;
  },
});

// The employee list is almost always "not deleted, filtered, sorted by one
// field". A compound index lets MongoDB satisfy the filter and the sort from
// the same index instead of loading and sorting matches in memory.
employeeSchema.index({ isDeleted: 1, department: 1, createdAt: -1 });
employeeSchema.index({ isDeleted: 1, role: 1, status: 1 });

export const Employee = model('Employee', employeeSchema);
