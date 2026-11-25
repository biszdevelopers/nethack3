# Backups

## Requirements

- Automated, encrypted backups of the nethack database.
- A retention policy appropriate to the competition calendar.
- Regular restoration tests against a non-production database.
- Separate credentials: backups use the migration/owner credential, never the runtime role.

Basis Auth keeps its own database and backup process. Nethack never backs up or queries provider tables.

## Scripts

```
DATABASE_MIGRATION_URL=... BACKUP_DIR=./backups bun run scripts/backup-database.ts
DATABASE_MIGRATION_URL=... BACKUP_DIR=./backups bun run scripts/restore-database.ts <dump> --force
```

The backup script writes a timestamped custom-format dump using `pg_dump`. The restore script requires `--force` for a non-empty target and uses `pg_restore --clean --if-exists`.

`PG_BIN` overrides the PostgreSQL binary directory.

## Encryption

Encrypt dumps before leaving the host with the organization's standard tooling (for example `age` with a recipient key held outside the database host). Restrict backup directory permissions and never commit dumps.

## Restoration test

1. Create an empty database on a non-production server.
2. Restore the most recent dump.
3. Run the migrations check and start the API against the restored database.
4. Verify organization isolation, sign-in, and a representative read/write workflow.
5. Record the date, dump, duration, and result.

A backup that has never been restored is not verified.
