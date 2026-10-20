#!/usr/bin/env node
// Keeps GitHub from disabling the scheduled workflows. GitHub switches scheduled workflows off in a public repository after
// 60 days without repository activity. If main has had no commit for 30 days (half the limit), the workflow adds one empty commit.
// The decision is a pure function (tested); this file only reads the last commit date and reports. No dependencies.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');

const DEFAULT_THRESHOLD_DAYS = 30;
const DAY = 86400;

function needsHeartbeat({ lastCommitEpoch, nowEpoch, thresholdDays = DEFAULT_THRESHOLD_DAYS, force = false }) {
  if (force) return { needed: true, ageDays: ageOf(lastCommitEpoch, nowEpoch), reason: 'forced by the manual run' };
  if (typeof lastCommitEpoch !== 'number' || !Number.isFinite(lastCommitEpoch)) return { needed: true, ageDays: null, reason: 'last commit date unknown or unreadable' };
  const age = (nowEpoch - lastCommitEpoch) / DAY;
  if (age < 0) return { needed: false, ageDays: 0, reason: 'last commit is dated in the future (clock skew); nothing to do' };
  return age >= thresholdDays
    ? { needed: true, ageDays: Math.floor(age), reason: `no commit for ${Math.floor(age)} days (limit ${thresholdDays})` }
    : { needed: false, ageDays: Math.floor(age), reason: `last commit ${Math.floor(age)} days ago (limit ${thresholdDays})` };
}
function ageOf(last, now) { return typeof last === 'number' && Number.isFinite(last) ? Math.floor((now - last) / DAY) : null; }

function heartbeatMessage({ ageDays }) {
  return `chore: keep scheduled workflows active${ageDays === null || ageDays === undefined ? '' : ` (no commit for ${ageDays} days)`}`;
}

module.exports = { needsHeartbeat, heartbeatMessage, DEFAULT_THRESHOLD_DAYS };

if (require.main === module) {
  let last = NaN;
  try { last = Number(execFileSync('git', ['log', '-1', '--format=%ct'], { encoding: 'utf8' }).trim()); } catch { /* unknown: heartbeat is harmless */ }
  const now = Math.floor(Date.now() / 1000);
  const d = needsHeartbeat({ lastCommitEpoch: last, nowEpoch: now, force: process.env.FORCE === 'true' });
  const dry = process.env.DRY_RUN === 'true';
  console.log(`${d.needed ? (dry ? 'would add a heartbeat commit' : 'heartbeat needed') : 'no heartbeat needed'}: ${d.reason}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `heartbeat=${d.needed && !dry}\nmessage=${heartbeatMessage(d)}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Keep-alive\n${d.reason}${dry ? ' (dry run)' : ''}\n`);
}
