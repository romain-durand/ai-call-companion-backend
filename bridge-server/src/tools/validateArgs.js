// Input validation helpers for tool arguments
// Returns { ok: true } or { ok: false, message: "..." }

// Regex patterns
const E164_RE = /^\+[1-9]\d{7,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// Constants
const PRIORITY_VALUES = ["low", "normal", "high", "urgent"];
const MAX_REASON = 500;
const MAX_SUMMARY = 6000;
const MAX_QUESTION = 1000;
const MAX_TITLE = 200;
const MAX_NAME = 100;
const MAX_NOTE = 200;
const MIN_BOOKING_MINUTES = 5;
const MAX_BOOKING_HOURS = 8;

function ok() {
  return { ok: true };
}

function fail(message) {
  return { ok: false, message };
}

function validatePhone(phone) {
  if (typeof phone !== "string" || !E164_RE.test(phone.trim()))
    return fail(`Invalid phone number (expected E.164 format, e.g. +33612345678)`);
  return ok();
}

function validatePriority(priority) {
  if (priority !== undefined && !PRIORITY_VALUES.includes(priority))
    return fail(`Invalid priority "${priority}". Allowed values: ${PRIORITY_VALUES.join(", ")}`);
  return ok();
}

function validateMaxLen(value, fieldName, max) {
  if (typeof value === "string" && value.length > max)
    return fail(`${fieldName} must be at most ${max} characters (got ${value.length})`);
  return ok();
}

function validateDate(date) {
  if (typeof date !== "string" || !DATE_RE.test(date.trim()))
    return fail(`Invalid date format (expected YYYY-MM-DD, got "${date}")`);
  return ok();
}

function validateTime(time, fieldName = "time") {
  if (typeof time !== "string" || !TIME_RE.test(time.trim()))
    return fail(`Invalid ${fieldName} format (expected HH:MM, got "${time}")`);
  const parts = time.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (h > 23 || m > 59)
    return fail(`${fieldName} out of range (got "${time}")`);
  return ok();
}

function validateIsoDatetime(value, fieldName) {
  if (typeof value !== "string" || !ISO_DT_RE.test(value.trim()))
    return fail(`${fieldName} must be an ISO 8601 datetime (e.g. 2026-04-21T14:00:00+02:00)`);
  const time = new Date(value).getTime();
  if (isNaN(time))
    return fail(`${fieldName} is not a valid datetime (got "${value}")`);
  // Sanity check: date should be within a reasonable range (past 100 years, future 50 years)
  const now = Date.now();
  const hundredYearsMs = 100 * 365.25 * 24 * 3600 * 1000;
  const fiftyYearsMs = 50 * 365.25 * 24 * 3600 * 1000;
  if (time < now - hundredYearsMs || time > now + fiftyYearsMs)
    return fail(`${fieldName} is too far in the past or future`);
  return ok();
}

function validateOrdering(startStr, endStr) {
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (end <= start)
    return fail(`end must be after start (start="${startStr}", end="${endStr}")`);
  return ok();
}

function validateBookingDuration(startStr, endStr) {
  const diffMs = new Date(endStr) - new Date(startStr);
  const diffMin = diffMs / 60000;
  if (diffMin < MIN_BOOKING_MINUTES)
    return fail(`Booking duration too short (minimum ${MIN_BOOKING_MINUTES} minutes)`);
  if (diffMin > MAX_BOOKING_HOURS * 60)
    return fail(`Booking duration too long (maximum ${MAX_BOOKING_HOURS} hours)`);
  return ok();
}

module.exports = {
  validatePhone,
  validatePriority,
  validateMaxLen,
  validateDate,
  validateTime,
  validateIsoDatetime,
  validateOrdering,
  validateBookingDuration,
  ok,
  fail,
  PRIORITY_VALUES,
  MAX_REASON,
  MAX_SUMMARY,
  MAX_QUESTION,
  MAX_TITLE,
  MAX_NAME,
  MAX_NOTE,
  MIN_BOOKING_MINUTES,
  MAX_BOOKING_HOURS,
};
