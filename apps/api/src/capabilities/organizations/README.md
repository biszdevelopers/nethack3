# Organizations capability

Owns organizations, settings, memberships, invitations, audit-log reads, and edition reports for the active organization.

## Ownership

- Organization profiles, slugs, descriptions, and public showcase settings.
- Browser onboarding: an authenticated user without a membership can create an organization and becomes its owner.
- Memberships, roles, suspension, removal, and owner-retention rules.
- Invitations and invitation acceptance.
- Organization-scoped audit reads and aggregate edition reports.
- Tables: `organizations`, `organization_settings`, `organization_memberships`, `organization_invitations`, `audit_logs`.

## Dependencies

- `identity` through the authenticated `AuthContext` supplied by the Core.
- No other capability. Reports use organization-owned tables only.

## Permissions

- Owners manage members, invitations, and settings.
- Owners and organizers read the audit log and reports.
- Every route requires an active membership in the target organization.
- Role changes and removals cannot remove the last owner.

## Events

Organization events are published through the transactional outbox and consumed by the notifications capability: invitations, membership changes, and ownership decisions.

## Tests

- `tests/organization-rules.test.ts` covers role ranking, owner-only management, and last-owner protection.
- `apps/api/tests/auth/organization-isolation.test.ts` covers cross-tenant membership and settings isolation.
- `apps/api/tests/security/cross-organization.test.ts` and `role-escalation.test.ts` cover organization boundaries and privilege escalation.
- `tests/e2e/03-organizer-workflow.spec.ts` covers approval, settings, and announcement administration in the browser.
- `tests/e2e/10-organization-creation.spec.ts` covers creating an organization from the first-run onboarding panel and becoming its owner.

## Extraction

The capability owns its routes, service, rules, repository, contracts, and tests. Other capabilities use `contracts.ts`; no private module is imported. It can be extracted with the Core, database client, audit logger, and outbox.
