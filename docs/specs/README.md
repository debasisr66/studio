# Feature specs

Spec-based work for Studio. A spec is written **before** any change that affects behaviour, data, trust or operations ([PRD](../PRD.md) §9.7). Release-level documents in `docs/` remain the history of what shipped; a spec is the reasoning and traceable contract for one workstream.

## Index

| Spec | Status | Requirements | PRD phase | Folder |
|------|--------|--------------|-----------|--------|
| Product trust and reliability (`SPEC-TR`) | Shipped (v1.5) | TR-01 … TR-13 | Phase 2 | [product-trust-reliability/](product-trust-reliability/spec.md) |
| Stabilize the core hub (`SPEC-SH`) | Shipped in v2.0 (2026-10-26) | SH-01 … SH-08 | Phase 1 / 2.5, **step 1 of 2.0** | [stabilize-core-hub/](stabilize-core-hub/spec.md) |
| Reads: Technical and Others (`SPEC-RC`) | Shipped in v2.0 (2026-10-26) | RC-01 … RC-09 | Phase 2.5, step 2 | [reads-categories/](reads-categories/spec.md) |
| Podcast links replace the Blog (`SPEC-PC`) | Shipped in v2.0 (2026-10-26) | PC-01 … PC-09 | Phase 2.5, step 3 | [podcast-links/](podcast-links/spec.md) |
| Quick add: paste first, unlock when needed (`SPEC-QA`) | Complete 2026-10-23: Phase A merged (PR #24); QA-09 (Phase B) dropped by the owner | QA-01 … QA-10 | Phase 2.5, planned before UX | [quick-add/](quick-add/spec.md) |
| Owner status line (`SPEC-ST`) | Shipped in v2.1 (2026-10-27) | ST-01 … ST-06 | After 2.0 | [owner-status/](owner-status/spec.md) |
| Simpler layout (`SPEC-UX`) | Shipped in v2.0 (2026-10-26) | UX-01 … UX-07 | Phase 2.5, step 4 | [simple-layout/](simple-layout/spec.md) |

## Traceability convention

```
PRD section → spec requirement (XX-nn) → test case (TC-XX-nnn) → code or workflow → release docs (REQ-nn in docs/test.md, security log, changelog)
```

- Each spec has a short prefix (`TR`) and numbers its requirements. Test cases use `TC-<prefix>-<group><nn>`.
- A spec's traceability table lists, per requirement: PRD reference, the release `REQ-nn` it extends, test IDs, and files touched.
- When the work ships, matching `REQ-nn` rows go into `docs/test.md`, a log goes into `docs/security.md`, and a plain-language note goes into `content/changelog.json`.
- Status lines: `Draft` → `Approved` → `In progress` → `Shipped (vX.Y)` or `Superseded`. Record each change in the spec's status log.

## Folder layout per spec

```
docs/specs/<name>/
  spec.md    required: problem, evidence, requirements with acceptance, traceability, open questions
  test.md    required: cases by requirement ID, exit criteria
  plan.md    when work starts: phases, order
  design.md  when work starts: decisions, Mermaid diagrams
  security.md optional: only if the spec adds a trust boundary
```

## When a spec is required

Required: new or changed data files or schemas, sync or health behaviour, workflows or permissions, admin or security behaviour, anything changing what a visitor can rely on. Not required: typo fixes, copy, dependency pins merged by Dependabot.
