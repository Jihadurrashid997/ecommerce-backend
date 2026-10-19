const assert = require("node:assert/strict");
const test = require("node:test");
const isDatabaseReady = require("../services/databaseHealth");

test("database health is ready only for an established connection", () => {
    assert.equal(isDatabaseReady(1), true);
    assert.equal(isDatabaseReady(0), false);
    assert.equal(isDatabaseReady(2), false);
    assert.equal(isDatabaseReady(3), false);
});
