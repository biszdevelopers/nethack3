# Files capability

Owns project file uploads, inspection, storage, listing, authorized downloads, deletion, and the fixed `files.v1` contract consumed by `submissions`.

## Layers

- `domain/file-inspector.ts` — pure filename sanitization, magic-byte detection, executable/HTML/SVG rejection, content-disposition building.
- `domain/zip-inspector.ts` — pure central-directory parser. Never inflates data.
- `application/file-service.ts` — authorization, upload lifecycle, download resolution, deletion, contract operations.
- `infrastructure/file-repository.ts` — `submission_files` queries, always organization-scoped.
- `http/file-routes.ts` — multipart streaming, download streaming, HTTP security headers.
- `tests/file-inspector.test.ts` — pure Vitest coverage for signatures and ZIP limits.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/projects/:projectId/files` | `multipart/form-data`, one file. Project owner/member or organizer. |
| GET | `/api/v1/projects/:projectId/files` | Approved files only. Project owner/member or organizer. |
| GET | `/api/v1/files/:fileId/download` | Project member/organizer/uploader, or anyone when the file is approved and its project is published. Always `attachment`. |
| DELETE | `/api/v1/files/:fileId` | Uploader or organizer. Marks the row deleted and removes storage. |

## Upload pipeline

1. Stream the multipart part, hashing SHA-256 while buffering. The hard cap is `min(config.storage.maxUploadBytes, 25 MiB)`; exceeding it returns 413.
2. Sanitize the filename (path components, control characters, 200 character limit).
3. Detect the real content type from magic bytes. The client-provided MIME type is ignored. Allowed: PNG, JPEG, GIF, WebP, PDF, ZIP, plain text. SVG, HTML, XML, executables, Office documents, and encrypted ZIPs are rejected.
4. ZIPs are parsed from the End of Central Directory and central directory only: at most 200 entries, at most 200 MB total uncompressed, 200:1 per-entry ratio, no absolute paths, no `..` segments, no backslashes, no encryption, and consistent local headers/data descriptors.
5. Save to quarantine under `${uuid[0..2]}/${uuid}.${ext}`, promote to approved storage, insert a `submission_files` row with `status = approved`, checksum, byte size, detected content type, and audit the upload.
6. If inspection fails, nothing is promoted and the request returns 400 with `unsupported_media_type` or `validation_error`. If promotion or persistence fails after quarantine, the quarantine object is removed.

## Contract

`getFile(organizationId, fileId)` reads within the organization transaction. `attachToSubmission(...)` only attaches an approved file owned by the same organization; composite foreign keys enforce that the submission and version also belong to the organization.

## Download security

- Authorization is resolved before any filesystem access.
- `Content-Disposition: attachment` with a sanitized filename, stored `Content-Type`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: sandbox`.
- Private files: `Cache-Control: private, no-store`. Public files: `Cache-Control: public, max-age=300`.
- Files are never executed, transformed, or served inline.
