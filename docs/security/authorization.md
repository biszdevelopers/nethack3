# Authorization

Status: authorization specification. This document defines required checks and denials. It does not assert that any route, policy, or test is implemented. Every control must be verified by the suites named in `docs/security/security-requirements.md`.

## 1. Principles

- Deny by default. A request is permitted only when an explicit policy allows it.
- The API is authoritative. The frontend, the API client, and the browser are untrusted input.
- Identity is not authorization. A valid session proves who the caller is, not what the caller may do.
- Organization scope is explicit. Every organization-owned resource is read and written inside exactly one organization context.
- Object-level authorization is mandatory. Route-level checks are not enough when the route contains an object identifier.
- Least privilege and separation of duties apply. A person who organizes a competition does not automatically judge it or vote in it.
- Authorization is re-evaluated at the time of the operation, inside the transaction for mutations.
- Fail closed. Missing context, missing membership, missing assignment, or an unavailable policy input results in denial, not a permissive fallback.
- Privileged decisions are auditable.

## 2. Six-step request verification

Every protected request runs the following checks in order. A failure stops the request. Later steps do not run after an earlier denial.

| Step | Check | Source of truth | Failure response |
| --- | --- | --- | --- |
| 1 | Identity | Session cookie hash, session record, user status | `401` |
| 2 | Organization context | Explicit organization in the route and an active membership | `403` |
| 3 | Resource organization | Resource row constrained by the organization | `404` |
| 4 | Membership | Current active membership and role from the database | `403` |
| 5 | Operation permission | Explicit policy for the role and operation | `403` |
| 6 | Competition eligibility, assignment, or ownership | Registration, team, project, submission, assignment, conflict-of-interest, deadline, and state records | `403` or `409` |

### 2.1 Step 1: identity

- Read the `__Host-nethack_session` cookie. Reject a missing, malformed, or oversized value.
- Hash the value and look up the session by hash. Do not compare raw session identifiers in application code.
- Reject a session that is expired, revoked, or past its idle timeout.
- Reject a user whose status is not active.
- Load the current user and global administrator flag from the database. Do not trust a cached session snapshot for authority.
- For state-changing requests, verify the CSRF token before executing the operation. CSRF is a separate gate, not a substitute for authorization.
- Return `401` for missing or invalid authentication. Do not reveal whether a session existed.

### 2.2 Step 2: organization context

- Organization-scoped routes carry an explicit organization identifier in the path, for example `/api/v1/organizations/:organizationId/...`.
- The identifier is a request parameter, never a grant. The API verifies that the authenticated user has an active membership in that organization.
- A client-supplied organization header may be used only as a convenience. It must be verified against the database exactly like a path parameter, and it must never override the path or the session.
- Missing organization context on an organization-scoped route is a validation failure. An organization the user does not belong to is a denial.
- Suspended membership is a denial.
- A user may belong to multiple organizations. Selecting one organization in the workspace does not grant access to another.

### 2.3 Step 3: resource organization

- Load the resource with both its identifier and the organization identifier: `WHERE id = $1 AND organization_id = $2`.
- For nested resources, verify the entire parent chain, not only the immediate child. A submission belongs to a project, which belongs to an organization.
- If the resource does not exist in the current organization, return `404`. Do not return `403` for an object that exists in another organization; that would confirm its existence.
- Do not use an unscoped `findById`, `getById`, or equivalent on a tenant table.
- Do not accept a parent identifier from the request without loading and verifying it.
- Counts, aggregates, search results, and pagination cursors must also be organization-scoped. A total count can leak another organization's data.

### 2.4 Step 4: membership

- Load the current membership for `(organizationId, userId)` from the database.
- Require `status = active`.
- Use the stored role. Do not accept a role from the request, the session snapshot, a JWT permission claim, or local storage.
- If the role changed after the session was created, the new role applies immediately. The session may show stale UI until it refreshes, but the API uses the current role.
- A removed or suspended member is denied even if the browser still has a valid session cookie.
- Membership selection is one role per organization in the specified model. Do not invent implicit additional roles. A person who must judge and organize needs an explicit decision about how that is represented; the default is that one membership has one role.

### 2.5 Step 5: operation permission

- Resolve the operation to a named permission, for example `organization.members.manage`, `competition.publish`, `submission.review`, or `evaluation.submit`.
- Evaluate an explicit policy for the role and operation. The role matrix in section 4 is the baseline; finer-grained rules may restrict it, never expand it silently.
- Deny when the operation is not listed for the role.
- Deny when the policy requires an additional condition that is absent, such as an active assignment or a conflict-of-interest declaration.
- Do not treat a Basis Auth scope or permission as sufficient for a local organization operation. External permissions may complement local policy; they never replace it.
- Record denials for privileged or sensitive operations.

### 2.6 Step 6: competition eligibility, assignment, and ownership

For competition-scoped operations, verify the relationship between the actor and the specific object:

- The competition edition is in a state that permits the operation.
- Registration exists and is approved where required.
- The participant is eligible for the division and the edition.
- The team exists, is active, and the actor's membership is current.
- The project belongs to the actor's team or to the actor.
- The submission belongs to the project and is in the required state.
- The submission deadline has not passed, unless the actor has an explicit extension or organizer override.
- A judge has an active assignment to the specific submission or project.
- A judge has declared any required conflict of interest and is not assigned to a conflicted entry.
- A voter is eligible for the round and has not already voted.
- The operation does not violate separation of duties, such as evaluating one's own project or voting for one's own team.

Return `409` for a state conflict such as a closed deadline or an already submitted evaluation when the actor is otherwise permitted. Return `403` when the actor lacks the relationship or permission.

## 3. Organization context and session data

- The session response may include the user's memberships and the currently selected organization for user-interface purposes.
- The API must not trust the membership list in the session as authorization. Every protected request re-reads the current membership and role.
- If a short-lived authorization cache is used, it must be invalidated on membership, role, suspension, or global administrator changes, and it must fail closed when the cache is unavailable.
- Switching organizations in the workspace changes the selected context and the route. It does not create authority.
- An API request that mixes identifiers from different organizations must be rejected, not partially executed.

## 4. Role matrix

Legend:

- **Yes**: permitted within the actor's organization and scope.
- **No**: denied.
- **Own**: permitted only for the actor's own registration, team, project, or submission.
- **Assigned**: permitted only for an active, non-conflicted assignment.
- **Review**: read or inspect, but not create, edit, or delete.
- **Break-glass**: permitted only through a time-bounded, reasoned, audited emergency procedure.
- **Audited**: permitted with mandatory audit and review.

The matrix is a baseline. A stricter rule in a capability is allowed. A broader rule requires an explicit security review and an update to this document.

| Operation | Owner | Organizer | Judge | Participant | Global administrator |
| --- | --- | --- | --- | --- | --- |
| View public competition and published project data | Yes | Yes | Yes | Yes | Yes |
| View private organization profile and settings | Yes | Yes | No | No | Audited |
| Update organization profile and settings | Yes | No | No | No | Break-glass |
| Manage organization memberships and roles | Yes | No | No | No | Break-glass |
| Create and edit competition series, editions, and divisions | Yes | Yes | No | No | Break-glass |
| Configure registration, eligibility, and deadlines | Yes | Yes | No | No | Break-glass |
| View registrations and participant records | Yes | Yes | No | Own | Break-glass |
| Approve or reject registrations | Yes | Yes | No | No | Break-glass |
| Manage any team in the organization | Yes | Yes | No | No | Break-glass |
| Manage own team | Yes | Yes | No | Own | Break-glass |
| View team details | Yes | Yes | Assigned | Own | Break-glass |
| Create or edit a project | Review | Review | No | Own | Break-glass |
| Upload or delete project files | Review | Review | No | Own | Break-glass |
| Submit a project | Review | Review | No | Own | No |
| Review submissions | Yes | Yes | Assigned | Own | Break-glass |
| Assign judges | Yes | Yes | No | No | Break-glass |
| View assigned submissions | Yes | Yes | Assigned | Own | Break-glass |
| Submit an evaluation | No | No | Assigned and no conflict | No | No |
| View evaluations and scores | Yes | Yes | Own | No until published | Break-glass |
| Manage voting rounds | Yes | Yes | No | No | Break-glass |
| Cast a vote | No | No | No | Eligible only | No |
| Publish results | Yes | Yes | No | No | Break-glass |
| View organization audit logs | Yes | Yes | No | No | Yes |
| View platform audit logs | No | No | No | No | Yes |
| Manage global administrators | No | No | No | No | Yes |
| Disable users and perform platform administration | No | No | No | No | Yes |
| Access private files | Yes | Yes | Assigned | Own | Break-glass |

Additional matrix rules:

- The owner role is organization-scoped. It does not grant authority in another organization.
- The organizer role may manage competitions, registrations, teams, projects, submissions, judging administration, voting administration, results, and announcements within the organization. It does not grant membership management, ownership transfer, or organization deletion.
- The judge role may read only assigned work and may submit only its own evaluations. It may not see all participant records, manage assignments, or publish results.
- The participant role may manage only its own registration, team, project, files, submission, and eligible vote. It may not review other participants' private work.
- The global administrator role is a platform-level grant. It does not imply an organization role, a judge assignment, or a participant eligibility. It may not submit evaluations or cast votes.
- Break-glass access must be time-bounded, reasoned, audited, and reviewed after use. It must not be a permanent permission.
- Published results and published project data are public only after the publication state is reached. Before that, the organizer rules apply.

## 5. Global administrator

- Global administrator is stored in a separate table or flag, not inferred from an organization role.
- Grants are rare, explicit, reasoned, and recorded with grantor and timestamp.
- Access is reviewed on a schedule and after every incident.
- Global administrator can create, disable, and recover organizations, manage platform configuration, and inspect audit records needed for support.
- Global administrator cannot submit an evaluation, cast a vote, or change a score without a separate judge or participant role and the corresponding assignment or eligibility.
- Support access to private participant data uses a break-glass procedure with a reason, a ticket reference, a time limit, and an audit record.
- Global administrator sessions are subject to the same session, CSRF, and revocation rules as any other session. There is no permanent bypass.

## 6. Explicit rules against trusting the frontend

The following are prohibited as authorization inputs:

- A role, permission, or scope value from a request body, query, header, cookie, local storage, or client-side state.
- An organization identifier that is not verified against the authenticated user's active membership.
- A user identifier supplied by the client when the operation concerns the actor. The actor is derived from the session.
- An owner, creator, team, or participant identifier supplied by the client when the server can derive it from the authenticated actor and the resource.
- A status, price, score, deadline, eligibility flag, or submission state supplied by the client.
- A hidden or disabled user-interface control as evidence of permission.
- A Basis Auth permission claim treated as sufficient for a local organization operation.
- A frontend route guard treated as a security boundary.

Required frontend rules:

- The workspace may hide actions for usability. The API must return the same denial when the action is attempted directly.
- The API client must not attach an authorization decision to a request. It may attach the session cookie and the CSRF token only.
- The frontend must handle `401`, `403`, `404`, and `409` without bypassing the server decision or retrying with elevated parameters.
- The frontend must not cache another user's or organization's private response and reuse it after switching context.

## 7. Explicit rules against ID-based access

- A resource identifier is not a capability. Knowledge of an identifier does not grant access.
- Do not use unguessable identifiers as the only protection. UUIDs can leak through logs, URLs, exports, screenshots, and integrations.
- Every tenant-table query must include the organization scope, even when RLS is active.
- Every object-level operation must load the resource through an organization-scoped repository method and then evaluate the relationship and permission.
- Do not authorize by checking only that the actor is a member of some organization. The actor must be a member of the resource's organization and must satisfy the operation and relationship rules.
- Do not authorize by checking only that the actor is an organizer. The actor must be an organizer in the resource's organization.
- Do not authorize a nested object by its parent identifier alone. Load the parent and verify the full chain.
- Batch, search, export, and report endpoints must apply the same object-level rules to every item. A partial result must not include an unauthorized item.
- Signed download URLs must be scoped to one file, one organization, and a short expiry. They must not be reusable for another file.
- Pagination cursors must not contain data from another organization. If a cursor is opaque, it must be signed or encrypted and scoped to the same query and organization.

## 8. Response policy

| Situation | Response | Reason |
| --- | --- | --- |
| No session or invalid session | `401` | Authentication is required |
| Expired, revoked, or malformed access token | `401 invalid_token` | Standard token rejection |
| Authenticated but lacking organization context | `403` | The request is not valid for the actor |
| Resource exists in another organization | `404` | Do not confirm existence |
| Authenticated, in the organization, but lacking the role or permission | `403` | The actor is known but not permitted |
| Authenticated and permitted, but the state forbids the operation | `409` | State conflict, not a permission failure |
| Missing required scope or permission on a token | `403` | The token is valid but insufficient |
| Validation failure | `400` | Input is malformed or incomplete |
| Rate limit exceeded | `429` | Retry later |
| Internal failure | `500` | Never include internal details |

The response must not reveal whether a cross-organization object exists, which role the actor has, or which specific check failed beyond the documented error category.

## 9. Implementation requirements

- Centralize authorization in a named policy module or service. Do not scatter ad hoc role comparisons across route handlers.
- Route handlers perform only request reception, validation, authentication, organization context, authorization, application operation invocation, and serialization.
- Application operations re-evaluate authorization when they are called from another entry point, such as a worker or an administrative action.
- Repositories that touch tenant tables require an organization identifier in their signatures. Do not provide a default or an overload that omits it.
- Mutations perform the authorization check inside the database transaction, then lock or re-read the rows needed to prevent time-of-check to time-of-use races.
- Domain state machines enforce allowed transitions. Authorization does not replace state validation, and state validation does not replace authorization.
- Unique constraints enforce duplicate prevention for votes, submissions, registrations, and memberships. Do not rely only on a pre-check.
- Audit records include the actor, organization, action, target, decision, correlation ID, and timestamp for privileged and sensitive operations.
- A denied privileged action is logged without sensitive parameters.
- Authorization code must be testable without a browser. The policy module must expose deterministic decisions for a given actor, organization, operation, and resource state.

## 10. Test obligations

`tests/security` must contain:

- A role matrix test for every operation in section 4.
- A cross-organization test for every resource type, including nested resources, files, exports, and search.
- A BOLA/IDOR test that changes an object identifier to another user's or organization's object.
- A test that a suspended or removed membership is denied with a still-valid session.
- A test that a changed role takes effect without waiting for a new session.
- A test that a removed judge assignment is denied.
- A test that a judge cannot evaluate a conflicted or unassigned entry.
- A test that a participant cannot vote twice or vote in an ineligible round.
- A test that a global administrator cannot submit an evaluation or vote.
- A test that break-glass access expires and is audited.

`tests/integration` must contain:

- Route-level checks for every protected route, including nested routes.
- Database-backed membership and role changes during a session.
- Transactional rechecks under concurrent updates.
- Composite foreign key and organization-scope enforcement.
- Response code consistency for `401`, `403`, `404`, and `409`.

`tests/architecture` must contain:

- No unscoped tenant repository method.
- No client-provided role or organization claim used as authority.
- No authorization decision implemented only in frontend code.
- No route handler that bypasses the central policy module for a protected operation.

`tests/e2e` must contain:

- A user with each role sees only the actions the matrix permits.
- A hidden action attempted directly is denied by the API.
- Switching organizations does not expose the previous organization's data.
- A cross-organization URL returns not found or denied without leaking data.
- Logout and session revocation take effect immediately.

## 11. Review checklist

Before merging an authorization change:

- [ ] The operation is named and mapped to the role matrix.
- [ ] The organization context is explicit and verified.
- [ ] The resource is loaded with its organization scope.
- [ ] The actor's current membership and role are read from the database.
- [ ] The operation permission is explicit, not inferred.
- [ ] Competition eligibility, assignment, conflict, deadline, and ownership rules are checked where applicable.
- [ ] The check is enforced on the server for every entry point, including workers, exports, and administrative actions.
- [ ] Mutations recheck inside the transaction.
- [ ] Cross-organization attempts return the documented response without confirming existence.
- [ ] The change has positive and negative tests for every affected role.
- [ ] Privileged or sensitive denials are audited.
- [ ] The change does not weaken an existing check for convenience.
