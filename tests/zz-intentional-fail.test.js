// TEMPORARY: proves what happens when CI is red. Must never reach main; delete this branch.
const test = require('node:test');
const assert = require('node:assert/strict');
test('intentional failure for the branch-ruleset experiment', () => { assert.fail('CI is meant to be red here'); });
