# Nethack Engineering Handbook

This directory is the maintained documentation for nethack. It describes the implemented system and the standards every change must meet.

## Start here

- `architecture/overview.md` — applications, boundaries, and runtime topology
- `architecture/capability-architecture.md` — capabilities, contracts, events, extraction
- `engineering/constitution.md` — the condensed engineering law
- `engineering/coding-standards.md` — TypeScript and repository conventions
- `engineering/ui-system.md` — Nethack UI architecture and component coverage
- `security/threat-model.md` — assets, trust boundaries, and mitigations
- `security/authentication.md` — Basis Auth flow and session lifecycle
- `security/tenant-isolation.md` — organization isolation and row-level security
- `integrations/basis-auth.md` — the downstream identity-provider contract
- `operations/development.md` — local setup and commands
- `operations/deployment.md` — Node and Bun deployment targets

## Verification

`docs/implementation/REQUIREMENT_TRACKER.md` maps every specification requirement to its implementation location and verification method. `docs/implementation/FINAL_IMPLEMENTATION_REPORT.md` records executed results, measurements, limitations, and remaining work. A requirement is only marked verified after its check has actually run.
