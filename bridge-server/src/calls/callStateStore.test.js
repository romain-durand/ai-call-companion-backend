// Quick test for callStateStore cleanup mechanism
// Run with: node src/calls/callStateStore.test.js

const callStore = require("./callStateStore");
const { createCallContext } = require("./callContext");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function test(name, fn) {
  tests.push({ name, fn });
}

const tests = [];

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log("Running callStateStore tests...\n");

  test("stores and retrieves call context", async () => {
    const ctx = createCallContext();
    callStore.set(ctx.traceId, ctx);
    const retrieved = callStore.get(ctx.traceId);
    assert(retrieved !== undefined, "Context should be retrievable");
    callStore.remove(ctx.traceId);
  });

  test("touch updates lastActivityTime", async () => {
    const ctx = createCallContext();
    callStore.set(ctx.traceId, ctx);
    const originalTime = ctx.lastActivityTime;

    await sleep(50);
    callStore.touch(ctx.traceId);

    const updated = callStore.get(ctx.traceId);
    assert(updated.lastActivityTime > originalTime, "lastActivityTime should increase");
    callStore.remove(ctx.traceId);
  });

  test("get auto-touches context", async () => {
    const ctx = createCallContext();
    callStore.set(ctx.traceId, ctx);
    const originalTime = ctx.lastActivityTime;

    await sleep(50);
    const retrieved = callStore.get(ctx.traceId);
    assert(retrieved.lastActivityTime > originalTime, "get() should auto-touch lastActivityTime");
    callStore.remove(ctx.traceId);
  });

  test("size returns correct count", async () => {
    const ctx1 = createCallContext();
    const ctx2 = createCallContext();
    callStore.set(ctx1.traceId, ctx1);
    callStore.set(ctx2.traceId, ctx2);

    assert(callStore.size() === 2, "Size should be 2");

    callStore.remove(ctx1.traceId);
    assert(callStore.size() === 1, "Size should be 1 after removal");

    callStore.remove(ctx2.traceId);
    assert(callStore.size() === 0, "Size should be 0 after all removals");
  });

  test("getStats returns call information", async () => {
    const ctx = createCallContext();
    ctx.callerNumber = "+33612345678";
    callStore.set(ctx.traceId, ctx);

    const stats = callStore.getStats();
    assert(stats.activeCallCount === 1, "Should report 1 active call");
    assert(stats.calls.length === 1, "Should have 1 call in list");
    assert(stats.calls[0].callerNumber === "+33612345678", "Should include callerNumber");
    assert(stats.calls[0].durationMin === 0, "Should report duration");

    callStore.remove(ctx.traceId);
  });

  for (const { name, fn } of tests) {
    await runTest(name, fn);
  }

  console.log("\n✅ All tests passed!");
  process.exit(0);
}

runTests().catch(e => {
  console.error("Test suite failed:", e);
  process.exit(1);
});
