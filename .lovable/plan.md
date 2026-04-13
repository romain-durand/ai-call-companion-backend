

## Bug: `matchedProfileId is not defined`

### Cause
`matchedProfileId` is declared with `let` at line 59, **inside** the `try` block. The TwiML template at line 148 references it **outside** the `try` block, where it doesn't exist.

### Fix
Move the declaration of `matchedProfileId` to line 54-56, alongside `accountId`, `phoneNumberId`, and `activeModeId`:

```
let accountId = "";
let phoneNumberId = "";
let activeModeId = "";
let matchedProfileId = null;   // ← move here
```

Then change line 59 from `let matchedProfileId = null;` to just remove the declaration (keep the assignment inside the loop at line 64 as-is since it already uses `=` not `let`).

### Files modified
- `bridge-server/src/twilio/twilioVoiceHandler.js` — one line moved, one line deleted.

No other changes needed.

