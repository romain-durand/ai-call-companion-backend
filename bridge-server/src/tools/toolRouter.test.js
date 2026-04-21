// Quick integration test of validation in toolRouter
// Simulates what happens when invalid args come from Gemini

const v = require("./validateArgs");

// Simulate tool handlers with validation
function simulateValidation(toolName, args, validators) {
  console.log(`\nTesting: ${toolName}`);
  console.log(`  Args: ${JSON.stringify(args)}`);
  
  for (const [field, validator] of Object.entries(validators)) {
    const result = validator(args);
    if (!result.ok) {
      console.log(`  ❌ ${field}: ${result.message}`);
      return false;
    }
  }
  console.log(`  ✅ All validations passed`);
  return true;
}

// Test 1: check_availability with missing date
console.log("=== Test Suite: Validation Error Cases ===");

simulateValidation(
  "check_availability (MISSING DATE)",
  { time_range_start: "09:00", time_range_end: "17:00" },
  {
    "date": (args) => args.date ? v.validateDate(args.date) : v.fail("date is required"),
  }
);

// Test 2: check_availability with bad date format
simulateValidation(
  "check_availability (INVALID DATE FORMAT)",
  { date: "21/04/2026", time_range_start: "09:00", time_range_end: "17:00" },
  {
    "date": (args) => v.validateDate(args.date),
    "time_range_start": (args) => v.validateTime(args.time_range_start),
    "time_range_end": (args) => v.validateTime(args.time_range_end),
    "ordering": (args) => {
      if (args.time_range_start >= args.time_range_end) {
        return v.fail("end must be after start");
      }
      return { ok: true };
    },
  }
);

// Test 3: book_appointment with reversed times
simulateValidation(
  "book_appointment (REVERSED TIMES)",
  {
    start_time: "2026-04-21T15:00:00+02:00",
    end_time: "2026-04-21T14:00:00+02:00",
  },
  {
    "start_time": (args) => v.validateIsoDatetime(args.start_time, "start_time"),
    "end_time": (args) => v.validateIsoDatetime(args.end_time, "end_time"),
    "ordering": (args) => v.validateOrdering(args.start_time, args.end_time),
  }
);

// Test 4: book_appointment with too-short duration
simulateValidation(
  "book_appointment (TOO SHORT)",
  {
    start_time: "2026-04-21T14:00:00+02:00",
    end_time: "2026-04-21T14:02:00+02:00",
  },
  {
    "start_time": (args) => v.validateIsoDatetime(args.start_time, "start_time"),
    "end_time": (args) => v.validateIsoDatetime(args.end_time, "end_time"),
    "duration": (args) => v.validateBookingDuration(args.start_time, args.end_time),
  }
);

// Test 5: notify_user with invalid priority
simulateValidation(
  "notify_user (INVALID PRIORITY)",
  {
    summary: "Call about appointment",
    priority: "URGENT",  // Wrong case/enum
  },
  {
    "priority": (args) => v.validatePriority(args.priority),
  }
);

// Test 6: create_callback with oversized reason
simulateValidation(
  "create_callback (OVERSIZED REASON)",
  {
    reason: "x".repeat(600),  // Exceeds MAX_REASON (500)
    priority: "normal",
  },
  {
    "reason": (args) => v.validateMaxLen(args.reason, "reason", v.MAX_REASON),
    "priority": (args) => v.validatePriority(args.priority),
  }
);

// Test 7: get_caller_profile with invalid phone
simulateValidation(
  "get_caller_profile (INVALID PHONE)",
  {
    phone_number: "0612345678",  // Missing country code
  },
  {
    "phone_number": (args) => v.validatePhone(args.phone_number),
  }
);

// Test 8: Valid check_availability
simulateValidation(
  "check_availability (VALID)",
  {
    date: "2026-04-21",
    time_range_start: "09:00",
    time_range_end: "17:00",
  },
  {
    "date": (args) => v.validateDate(args.date),
    "time_range_start": (args) => v.validateTime(args.time_range_start),
    "time_range_end": (args) => v.validateTime(args.time_range_end),
  }
);

// Test 9: Valid book_appointment
simulateValidation(
  "book_appointment (VALID)",
  {
    start_time: "2026-04-21T14:00:00+02:00",
    end_time: "2026-04-21T15:30:00+02:00",
    title: "Meeting",
    attendee_phone: "+33612345678",
  },
  {
    "start_time": (args) => v.validateIsoDatetime(args.start_time, "start_time"),
    "end_time": (args) => v.validateIsoDatetime(args.end_time, "end_time"),
    "ordering": (args) => v.validateOrdering(args.start_time, args.end_time),
    "duration": (args) => v.validateBookingDuration(args.start_time, args.end_time),
    "title": (args) => v.validateMaxLen(args.title, "title", v.MAX_TITLE),
    "phone": (args) => args.attendee_phone ? v.validatePhone(args.attendee_phone) : { ok: true },
  }
);

console.log("\n✅ Integration tests complete!\n");
