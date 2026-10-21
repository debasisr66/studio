# Feature specs

Spec-based work for Studio. A spec is written **before** any change that affects behaviour, data, trust or operations ([PRD](../PRD.md) §9.7). Release-level documents in `docs/` remain the history of what shipped; a spec is the reasoning and traceable contract for one workstream.

## Index

| Spec | Status | Requirements | PRD phase | Folder |
|------|--------|--------------|-----------|--------|
| Product trust and reliability (`SPEC-TR`) | A and B merged; C in review | TR-01 … TR-13 | Phase 2 | [product-trust-reliability/](product-trust-reliability/spec.md) |

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
