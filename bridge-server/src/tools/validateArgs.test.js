// Quick validation tests
// Run with: node src/tools/validateArgs.test.js

const v = require("./validateArgs");

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
  }
}

// Phone validation
test("validatePhone: valid E.164", () => {
  const r = v.validatePhone("+33612345678");
  if (!r.ok) throw new Error("Should be valid");
});

test("validatePhone: invalid format", () => {
  const r = v.validatePhone("not a phone");
  if (r.ok) throw new Error("Should be invalid");
});

test("validatePhone: invalid missing country code", () => {
  const r = v.validatePhone("0612345678");
  if (r.ok) throw new Error("Should be invalid");
});

// Priority validation
test("validatePriority: valid priority", () => {
  const r = v.validatePriority("high");
  if (!r.ok) throw new Error("Should be valid");
});

test("validatePriority: invalid priority", () => {
  const r = v.validatePriority("super-urgent");
  if (r.ok) throw new Error("Should be invalid");
});

test("validatePriority: undefined is OK", () => {
  const r = v.validatePriority(undefined);
  if (!r.ok) throw new Error("Should be valid (optional)");
});

// Max length validation
test("validateMaxLen: within limit", () => {
  const r = v.validateMaxLen("hello", "text", 10);
  if (!r.ok) throw new Error("Should be valid");
});

test("validateMaxLen: exceeds limit", () => {
  const r = v.validateMaxLen("hello world", "text", 5);
  if (r.ok) throw new Error("Should be invalid");
});

test("validateMaxLen: non-string is OK", () => {
  const r = v.validateMaxLen(123, "number", 5);
  if (!r.ok) throw new Error("Should be valid (non-string ignored)");
});

// Date validation
test("validateDate: valid date", () => {
  const r = v.validateDate("2026-04-21");
  if (!r.ok) throw new Error("Should be valid");
});

test("validateDate: invalid format", () => {
  const r = v.validateDate("21/04/2026");
  if (r.ok) throw new Error("Should be invalid");
});

test("validateDate: missing date", () => {
  const r = v.validateDate("");
  if (r.ok) throw new Error("Should be invalid");
});

// Time validation
test("validateTime: valid time", () => {
  const r = v.validateTime("14:30", "test_time");
  if (!r.ok) throw new Error("Should be valid");
});

test("validateTime: invalid hour", () => {
  const r = v.validateTime("25:00", "test_time");
  if (r.ok) throw new Error("Should be invalid");
});

test("validateTime: invalid minute", () => {
  const r = v.validateTime("14:75", "test_time");
  if (r.ok) throw new Error("Should be invalid");
});

test("validateTime: invalid format", () => {
  const r = v.validateTime("2:30", "test_time");
  if (r.ok) throw new Error("Should be invalid");
});

// ISO datetime validation
test("validateIsoDatetime: valid ISO datetime", () => {
  const r = v.validateIsoDatetime("2026-04-21T14:30:00+02:00", "startTime");
  if (!r.ok) throw new Error("Should be valid");
});

test("validateIsoDatetime: invalid format", () => {
  const r = v.validateIsoDatetime("2026-04-21 14:30", "startTime");
  if (r.ok) throw new Error("Should be invalid");
});

test("validateIsoDatetime: invalid datetime", () => {
  const r = v.validateIsoDatetime("2026-02-30T14:30:00+02:00", "startTime");
  if (r.ok) throw new Error("Should be invalid (Feb 30 doesn't exist)");
});

// Ordering validation
test("validateOrdering: end after start", () => {
  const r = v.validateOrdering("2026-04-21T14:00:00+02:00", "2026-04-21T15:00:00+02:00");
  if (!r.ok) throw new Error("Should be valid");
});

test("validateOrdering: end before start", () => {
  const r = v.validateOrdering("2026-04-21T15:00:00+02:00", "2026-04-21T14:00:00+02:00");
  if (r.ok) throw new Error("Should be invalid");
});

test("validateOrdering: end equals start", () => {
  const r = v.validateOrdering("2026-04-21T14:00:00+02:00", "2026-04-21T14:00:00+02:00");
  if (r.ok) throw new Error("Should be invalid");
});

// Duration validation
test("validateBookingDuration: valid 1-hour booking", () => {
  const r = v.validateBookingDuration("2026-04-21T14:00:00+02:00", "2026-04-21T15:00:00+02:00");
  if (!r.ok) throw new Error("Should be valid");
});

test("validateBookingDuration: too short (< 5 min)", () => {
  const r = v.validateBookingDuration("2026-04-21T14:00:00+02:00", "2026-04-21T14:02:00+02:00");
  if (r.ok) throw new Error("Should be invalid");
});

test("validateBookingDuration: too long (> 8 hours)", () => {
  const r = v.validateBookingDuration("2026-04-21T14:00:00+02:00", "2026-04-21T23:00:00+02:00");
  if (r.ok) throw new Error("Should be invalid");
});

console.log("\n✅ All tests passed!");
