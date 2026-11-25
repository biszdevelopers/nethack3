# Incident response

Status: operating procedure. This document defines how nethack must detect,
contain, investigate, recover from, and review security incidents. It does not
assert that any alert, runbook, rotation, or exercise has been performed.

## 1. Scope

This procedure covers incidents affecting:

- User identity, sessions, tokens, or account linking.
- Basis Auth client credentials, resource credentials, signing keys, or
  backchannel behavior.
- Organization data, cross-organization exposure, or tenant isolation.
- Competition, team, project, submission, judging, voting, or results integrity.
- Uploaded files, file inspection, storage, or the asset origin.
- Administrative access, global administrator grants, or break-glass use.
- Production infrastructure, deployment credentials, databases, backups, or
  secrets.
- Dependencies, build tools, container images, or release artifacts.
- Availability or integrity of the public site, workspace, or API.

An incident is any confirmed or suspected event that threatens confidentiality,
integrity, or availability, or that violates a security control. A failed attack
with no impact can still be an incident if it indicates a control gap or an
active campaign.

## 2. Roles

| Role | Responsibility |
| --- | --- |
| Incident commander | Owns the response, sets priorities, approves containment, coordinates communication |
| Security lead | Leads technical investigation, validates scope, recommends containment and remediation |
| Engineering lead | Implements containment and fixes, coordinates deploys and rollback |
| Identity and access lead | Handles Basis Auth, session revocation, token denylist, account linking, and key rotation |
| Data and platform lead | Handles database, storage, backups, and infrastructure evidence |
| Communications lead | Owns internal updates, status page, user and customer communication |
| Legal and privacy lead | Determines notification obligations, preserves privilege, reviews disclosure |
| Record keeper | Maintains the incident timeline, decisions, evidence index, and action log |

One person may hold more than one role in a small team, but the incident
commander and the security lead should not be the same person when staffing
allows. No one investigates an incident in which they are a subject without
independent oversight.

## 3. Severity levels

| Severity | Definition | Examples | Initial response |
| --- | --- | --- | --- |
| SEV1 Critical | Confirmed or imminent compromise with broad impact | Cross-organization data exposure, global administrator compromise, authentication bypass, remote code execution, signing-key or encryption-key exposure, mass session theft, destructive malware, platform-wide outage with no workaround | Acknowledge within 15 minutes; containment target within 1 hour; continuous coordination |
| SEV2 High | Confirmed or likely compromise with limited or serious impact | Single-organization data exposure, one user's session or tokens compromised, high-severity vulnerability with a working exploit path, significant authentication or file-pipeline degradation | Acknowledge within 1 hour; containment target within 4 hours |
| SEV3 Medium | Contained incident with little or no sensitive impact | Single-account compromise with no sensitive data, failed exploitation with traces, isolated malicious upload that was quarantined, limited availability degradation | Acknowledge within 1 business day; containment target within 3 business days |
| SEV4 Low | Low-impact policy violation or suspicious activity | Repeated failed logins from one source, scanner noise, misconfiguration without exposure, low-severity vulnerability with no exploit path | Acknowledge within 3 business days; handle in normal security work |

Severity may be raised at any time as scope becomes clearer. Lowering severity
requires incident-commander and security-lead agreement and a recorded reason.

## 4. Detection and reporting

### 4.1 Sources

- Authentication alerts: login failure spikes, state mismatches, invalid
  verifier attempts, refresh reuse, `invalid_grant` spikes, disabled-account
  attempts, unusual callback volume.
- Authorization alerts: cross-organization denials, repeated `403` or `404`
  patterns, privilege changes, global administrator grants, break-glass use.
- Backchannel alerts: verification failures, `logout_token` or
  `revocation_token` validation failures, delivery retries, denylist growth.
- File alerts: scanner hits, rejected active content, archive limit violations,
  worker timeouts, storage quota anomalies, download spikes.
- Data alerts: unexpected export volume, mass download, unusual report
  generation, database errors, replication or backup failures.
- Infrastructure alerts: WAF triggers, rate-limit saturation, certificate
  expiry, secret-store access anomalies, deployment failures, unexpected
  outbound traffic.
- Supply-chain alerts: critical or high advisories, unexpected lockfile
  changes, new lifecycle scripts, SBOM differences, container base-image
  vulnerabilities.
- Human reports: user, organizer, judge, participant, researcher, or operator
  reports.
- Provider notices: Basis Auth or Microsoft Entra ID security advisories,
  key-rotation notices, or incident communications.

### 4.2 Reporting

- Publish a security contact and a private reporting channel.
- Do not ask reporters to include tokens, codes, secrets, cookies, or personal
  data in a report.
- Acknowledge reports promptly and record the reporter, time, and description.
- Treat a credible external report as an incident until disproven.
- Never retaliate against a good-faith reporter.

## 5. Response phases

### 5.1 Triage

1. Open an incident record with a unique identifier.
2. Assign severity and incident commander.
3. Establish a timeline in UTC.
4. Identify affected origins, services, organizations, users, and data.
5. Preserve initial evidence before making changes that could destroy it.
6. Decide whether to declare an incident and notify stakeholders.
7. Start a communication cadence appropriate to the severity.

### 5.2 Containment

Choose the least disruptive containment that stops the harm:

- Revoke sessions and refresh tokens for affected users or organizations.
- Disable affected accounts.
- Add access-token JTIs to the denylist.
- Block a malicious file checksum and purge it.
- Disable a vulnerable feature or endpoint.
- Rotate a compromised credential or key.
- Isolate a worker or database connection.
- Apply an edge rate limit or block a source.
- Roll back to the previous deployable artifact.
- Take a targeted service offline if isolation is not possible.

Record every action, time, actor, and reason. Do not destroy evidence to contain
an incident. If containment would destroy evidence, capture a copy first when it
is safe to do so.

### 5.3 Eradication

- Identify and remove the root cause.
- Patch the vulnerability, remove the malicious dependency, or correct the
  misconfiguration.
- Rotate every credential that could have been exposed.
- Remove persistence: unauthorized accounts, keys, webhooks, jobs, tokens,
  rules, or deploy keys.
- Verify that the attacker's access path is closed.
- Add detection for the same path.

### 5.4 Recovery

- Restore from a known-good backup when integrity is uncertain.
- Deploy the fixed version through the normal release path.
- Re-enable features gradually and monitor.
- Verify login, refresh, logout, revocation, file handling, and organization
  isolation after recovery.
- Confirm that monitoring and alerts are active before declaring recovery.
- Keep the incident open until the recovery is stable.

### 5.5 Post-incident review

See section 10.

## 6. Playbooks

### 6.1 Suspected session or token compromise

1. Identify the affected session identifiers, users, and organizations from
   audit and access logs. Do not log or copy raw tokens.
2. Revoke the affected local sessions in the database. Set a revocation reason.
3. Revoke the refresh token at Basis Auth when possible.
4. Add affected access-token JTIs to the denylist with the correct
   `valid_after`.
5. If the compromise could affect other sessions, revoke all sessions for the
   user or organization.
6. Rotate the session cookie and CSRF token by requiring re-authentication.
7. Review account-linking changes, role changes, and data access during the
   exposure window.
8. Determine root cause: stolen cookie, XSS, malware, shared device, or a
   provider issue.

### 6.2 Client secret exposure

1. Treat the client secret as compromised. Do not wait to confirm use.
2. Follow the client-secret rotation sequence in section 7.1.
3. Review token-endpoint activity for the client during the exposure window.
4. Revoke sessions that may have been created by an attacker.
5. If the client ID changed, update the app, backchannel receiver, bootstrap
   grants, and every `applicationId` reference.
6. Remove the old client ID from seed configuration so a restart does not
   recreate it.

### 6.3 Resource secret exposure

1. Treat the resource secret as compromised.
2. Follow the resource-secret rotation sequence in section 7.2.
3. Review backchannel verification and internal API calls during the exposure
   window.
4. Check for forged logout or revocation events. If forgery is suspected, treat
   affected sessions as compromised and revoke them.
5. Rotate any other service that used the same secret.

### 6.4 Encryption-key exposure

1. Identify which key versions and which sessions or token records are
   affected.
2. Revoke sessions encrypted with the exposed key. Do not wait for expiry.
3. Add a new key version and make it current for new writes.
4. Re-encrypt affected records that must be retained, or delete them.
5. Remove the exposed key from the key ring only after no record depends on it.
6. Review whether plaintext tokens could have been extracted and whether those
   tokens must be revoked at the provider.
7. Record the key version, exposure window, and affected record count.

### 6.5 Cross-organization data exposure

1. Identify the endpoint, query, cache, export, file, or job that crossed the
   boundary.
2. Disable the affected path or apply a temporary deny rule.
3. Preserve request logs, response metadata, cache keys, and database query
   evidence.
4. Identify the organizations and users whose data was exposed and the
   organizations that received it.
5. Purge affected caches, CDN entries, signed URLs, exports, and search indexes.
6. Fix the authorization or tenant-isolation defect at the root.
7. Add cross-organization regression tests for the exact path.
8. Follow disclosure requirements in section 9.

### 6.6 Malicious upload

1. Keep the file quarantined or remove it from approved storage.
2. Preserve the file hash, metadata, scanner result, and upload audit record.
3. Block the hash and, if necessary, the uploader.
4. Identify every download or signed URL for the file.
5. If the file was downloaded, treat it as a potential client-side exposure and
   notify affected users.
6. Review inspection logs for a parser or scanner gap.
7. Update signatures, limits, and tests.

### 6.7 Dependency or build compromise

1. Stop deploying from the affected build or artifact.
2. Identify the compromised package, version, maintainer, or build step from
   the SBOM and lockfile.
3. Rebuild from a clean environment and a reviewed lockfile.
4. Rotate secrets that the build or runtime could access.
5. Compare the SBOM, artifact digest, and deployment record.
6. Remove the dependency or pin a known-good version.
7. Add a dependency-review rule or scanner check that would have caught it.
8. Review the vendor advisory and upstream guidance.

### 6.8 Denial of service

1. Apply edge rate limits and blocking for the abusive pattern.
2. Protect authentication and database resources first.
3. Scale or shed non-critical traffic.
4. Preserve logs for the attack pattern.
5. Avoid blocking legitimate shared networks without review.
6. After recovery, tune limits and add detection for the pattern.

### 6.9 Identity provider compromise or outage

1. Follow Basis Auth and Microsoft guidance for the provider incident.
2. If sign-in integrity is uncertain, disable new sign-ins and preserve
   existing sessions only if their tokens remain trustworthy.
3. Revoke sessions and refresh tokens when advised or when validation cannot be
   trusted.
4. Communicate status and recovery steps.
5. Re-run the authentication release checklist after the provider recovers.

## 7. Credential and key rotation

Rotations are coordinated changes. Keep the previous application version
deployable and both old and new credentials available during the change window
where the provider supports overlap.

### 7.1 Client secret rotation

Follow `SETUP_GUIDE.md` section 10.4:

1. The operator rotates or sets the new secret.
2. Deploy the new secret to the application environment.
3. Confirm login and refresh succeed.
4. Remove the old secret from every environment and secret store.
5. Rotating a secret invalidates the old value immediately unless the operator
   keeps both. Otherwise, expect a brief authentication outage.

If the client ID changes, update the app, backchannel receiver, bootstrap
grants, and every `applicationId` reference. Remove the old client ID from seed
configuration if the operator uses seed configuration, or startup may recreate
it.

### 7.2 Resource secret rotation

Follow `SETUP_GUIDE.md` section 10.5. The same resource secret is used by:

- The backchannel receiver to sign the webhook proof.
- Internal API calls for that resource.
- Any other service that authenticates as the resource.

Sequence:

1. The operator issues the new secret once.
2. Distribute it to every caller and keep it ready.
3. Switch callers, starting with the receiver and internal API clients.
4. Verify webhook re-verification, internal calls, refresh, and revocation.
5. Retire the old value.

A missed caller appears as `401 unauthorized` from the internal listener or a
failed webhook verification.

### 7.3 Encryption-key rotation

1. Add a new key version to the server-side key ring.
2. Configure new encryptions to use the new version.
3. Keep old versions available for decryption during the transition.
4. Re-encrypt records on use or in a bounded batch. Verify decryption before
   deleting the old version.
5. Remove an old version only after no record depends on it and the maximum
   session lifetime has passed.
6. If a key is compromised, revoke affected sessions immediately rather than
   waiting for re-encryption.
7. Record the key versions, record counts, and completion time.

### 7.4 Session invalidation

- Mark sessions revoked in the database with a reason and timestamp.
- Clear the browser cookie with the same attributes and `Max-Age=0`.
- Revoke refresh tokens at Basis Auth when possible.
- Add access-token JTIs to the denylist when immediate API rejection is
  required.
- Require re-authentication. Do not issue a new session from an old session.
- For organization-wide incidents, revoke all sessions for the organization's
  members.
- Verify invalidation with an authenticated request after the change.

### 7.5 Database credential rotation

- Rotate the runtime role password first, update the connection pool, and
  restart or reload the pool.
- Rotate the migration role separately. Do not use the migration role at
  runtime.
- Verify RLS and role attributes after rotation.
- Rotate backup and storage credentials separately.
- Record every credential that was rotated and every location that used it.

## 8. Evidence handling

- Preserve evidence before remediation when it is safe to do so.
- Capture logs, audit records, database snapshots, configuration, deployment
  records, SBOMs, file metadata, and relevant network logs.
- Record UTC timestamps, source, collector, and a cryptographic hash for each
  evidence item.
- Maintain a chain-of-custody record with who accessed, copied, or transferred
  each item.
- Store evidence in a restricted, write-once location outside the repository and
  outside public application storage.
- Do not place evidence in source control, chat, tickets visible to broad
  groups, or unapproved third-party services.
- Do not alter production evidence. Work from copies.
- Apply legal hold when advised by legal or privacy counsel.
- Retain evidence according to policy and applicable law.
- Redact personal data only when required; preserve enough to investigate.

## 9. Communications and disclosure

- Internal notification: incident commander, security lead, engineering lead,
  legal and privacy, communications, and executive owner as appropriate.
- Affected organization owners and users: notify when their data or access may
  be affected, with clear facts and required actions.
- Regulators and contractual partners: notify as required by applicable law and
  agreements, with legal and privacy approval.
- Public status page: use for service impact, not speculation about cause or
  attribution.
- Single spokesperson. Engineers do not negotiate publicly.
- Do not disclose personal data, tokens, exploit details, or unverified
  attribution.
- Do not promise a timeline that has not been approved.
- Keep a record of every external communication.
- Coordinate disclosure of a vulnerability with the vendor or maintainer when
  appropriate.

## 10. Post-incident review

Hold a blameless review within five business days of containment for SEV1 and
SEV2, and within ten business days for SEV3.

The review must cover:

- Timeline of detection, response, containment, and recovery.
- Root cause and contributing factors.
- What worked and what failed in detection, tooling, and process.
- Data, organizations, and users affected.
- Whether the severity and notifications were correct.
- Whether existing controls should have prevented or detected the incident.
- Action items with an owner, due date, and verification method.
- Updates to the threat model, security requirements, tests, runbooks, and
  monitoring.
- Whether an independent review is required.

Action items are tracked to completion. A review is not complete when the
document is written; it is complete when the fixes are verified.

## 11. Testing and maintenance

- Exercise at least one incident scenario per release cycle. Include a
  credential-rotation drill and a cross-organization exposure drill.
- Test session revocation, refresh revocation, denylist propagation, and
  backchannel delivery.
- Test client-secret and resource-secret rotation in staging.
- Test encryption-key rotation and old-key decryption.
- Test evidence capture without exposing secrets.
- Review contact lists, escalation paths, and provider contacts quarterly.
- Review severity definitions and response targets annually or after a major
  architecture change.
- Verify that alerts reach an accountable person, not only a dashboard.

## 12. References

- `SETUP_GUIDE.md` sections 10.4 and 10.5 for client-secret and resource-secret
  rotation.
- `SETUP_GUIDE.md` sections 5 and 9 for backchannel behavior and the verification
  checklist.
- `docs/security/authentication.md` for session, token, refresh, logout, and
  backchannel requirements.
- `docs/security/authorization.md` and `docs/security/tenant-isolation.md` for
  cross-organization containment.
- `docs/security/file-security.md` for malicious-file containment.
- `docs/security/security-requirements.md` for release-blocking vulnerabilities
  and evidence requirements.
