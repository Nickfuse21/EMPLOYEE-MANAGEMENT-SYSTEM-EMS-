/**
 * Helpdesk ticket controller.
 *
 * Employees can raise tickets and follow their own; HR & Super Admin see every
 * ticket and can triage them (assign, change priority/status). Everyone on a
 * ticket can add comments.
 */
import { Ticket } from '../models/Ticket.js';
import { Employee } from '../models/Employee.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ROLES } from '../utils/roles.js';

const RAISED_BY_POPULATE = { path: 'raisedBy', select: 'name email employeeId department profileImage' };
const ASSIGNED_POPULATE = { path: 'assignedTo', select: 'name employeeId profileImage' };

function isAgent(user) {
  return user.role === ROLES.SUPER_ADMIN || user.role === ROLES.HR_MANAGER;
}

/** Shared access check: agents see all; an employee only sees their own tickets. */
function assertCanView(user, ticket) {
  const isOwner = ticket.raisedBy._id
    ? ticket.raisedBy._id.toString() === user._id.toString()
    : ticket.raisedBy.toString() === user._id.toString();
  if (!isAgent(user) && !isOwner) {
    throw ApiError.forbidden('You can only view your own tickets');
  }
}

/**
 * GET /api/tickets
 * Agents see all tickets (optionally filtered by ?status= &category=); an
 * employee sees only the tickets they raised.
 */
export const listTickets = asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const filter = {};
  if (!isAgent(req.user)) filter.raisedBy = req.user._id;
  if (status) filter.status = status;
  if (category) filter.category = category;

  const tickets = await Ticket.find(filter)
    .populate(RAISED_BY_POPULATE)
    .populate(ASSIGNED_POPULATE)
    .sort({ createdAt: -1 });

  res.json({ success: true, data: tickets });
});

/**
 * GET /api/tickets/:id
 * One ticket with its full comment thread (owner or agent only).
 */
export const getTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate(RAISED_BY_POPULATE)
    .populate(ASSIGNED_POPULATE);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  assertCanView(req.user, ticket);
  res.json({ success: true, data: ticket });
});

/**
 * POST /api/tickets
 * Raise a new ticket (any authenticated user).
 */
export const createTicket = asyncHandler(async (req, res) => {
  const { subject, description, category, priority } = req.body;

  const ticket = await Ticket.create({
    subject,
    description,
    category,
    priority,
    raisedBy: req.user._id,
  });
  const populated = await ticket.populate(RAISED_BY_POPULATE);

  res.status(201).json({ success: true, message: 'Ticket raised', data: populated });
});

/**
 * PATCH /api/tickets/:id
 * Triage a ticket — assign it, change priority/status/category. Agents only
 * (route guard).
 */
export const updateTicket = asyncHandler(async (req, res) => {
  const { status, priority, category, assignedTo } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw ApiError.notFound('Ticket not found');

  if (assignedTo !== undefined) {
    if (assignedTo) {
      const exists = await Employee.exists({ _id: assignedTo, isDeleted: false });
      if (!exists) throw ApiError.badRequest('Assignee not found');
    }
    ticket.assignedTo = assignedTo || null;
  }
  if (status !== undefined) ticket.status = status;
  if (priority !== undefined) ticket.priority = priority;
  if (category !== undefined) ticket.category = category;

  await ticket.save();
  const populated = await ticket.populate([RAISED_BY_POPULATE, ASSIGNED_POPULATE]);

  res.json({ success: true, message: 'Ticket updated', data: populated });
});

/**
 * POST /api/tickets/:id/comments
 * Add a comment to a ticket's thread (owner or agent).
 */
export const addComment = asyncHandler(async (req, res) => {
  const { body } = req.body;

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  assertCanView(req.user, ticket);

  ticket.comments.push({ author: req.user._id, authorName: req.user.name, body });
  await ticket.save();
  const populated = await ticket.populate([RAISED_BY_POPULATE, ASSIGNED_POPULATE]);

  res.status(201).json({ success: true, message: 'Comment added', data: populated });
});
