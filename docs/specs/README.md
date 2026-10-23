# Feature specs

Spec-based work for Studio. A spec is written **before** any change that affects behaviour, data, trust or operations ([PRD](../PRD.md) §9.7). Release-level documents in `docs/` remain the history of what shipped; a spec is the reasoning and traceable contract for one workstream.

## Index

| Spec | Status | Requirements | PRD phase | Folder |
|------|--------|--------------|-----------|--------|
| Product trust and reliability (`SPEC-TR`) | Shipped (v1.5) | TR-01 … TR-13 | Phase 2 | [product-trust-reliability/](product-trust-reliability/spec.md) |
| Stabilize the core hub (`SPEC-SH`) | Phases A and B merged (PRs #12, #13); C not started | SH-01 … SH-08 | Phase 1 / 2.5, **step 1 of 2.0** | [stabilize-core-hub/](stabilize-core-hub/spec.md) |
| Reads: Technical and Others (`SPEC-RC`) | Phases A and B merged (PRs #14, #16; live in v1.6); C not started | RC-01 … RC-09 | Phase 2.5, step 2 | [reads-categories/](reads-categories/spec.md) |
| Podcast links replace the Blog (`SPEC-PC`) | Phases A and B merged (PRs #15, #21); C not started | PC-01 … PC-09 | Phase 2.5, step 3 | [podcast-links/](podcast-links/spec.md) |
| Simpler layout (`SPEC-UX`) | Approved, not started | UX-01 … UX-07 | Phase 2.5, step 4 | [simple-layout/](simple-layout/spec.md) |

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
