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
 */
employeeSchema.pre('save', async function assignEmployeeId(next) {
  if (this.employeeId) return next();
  const count = await this.constructor.countDocuments();
  this.employeeId = `EMP-${String(count + 1).padStart(4, '0')}`;
  next();
});

/** Instance method: compare a plaintext candidate against the stored hash. */
employeeSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Ensure the password is never leaked, even if a document is serialised
 * manually somewhere. `id` (string) is exposed via the virtual `id` getter.
 */
employeeSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export const Employee = model('Employee', employeeSchema);
