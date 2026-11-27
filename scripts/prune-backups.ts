import { readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const directory = resolve(process.env.BACKUP_DIR ?? "./backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? "14");
const minimum = Number(process.env.BACKUP_RETENTION_MINIMUM ?? "1");
if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    console.error("BACKUP_RETENTION_DAYS must be a positive number.");
    process.exit(1);
}
if (!Number.isFinite(minimum) || minimum < 1) {
    console.error("BACKUP_RETENTION_MINIMUM must be at least 1.");
    process.exit(1);
}

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
const backups = readdirSync(directory)
    .filter((entry) => /^nethack-.*\.dump$/u.test(entry))
    .map((entry) => ({
        entry,
        path: join(directory, entry),
        modified: statSync(join(directory, entry)).mtimeMs,
    }))
    .sort((left, right) => right.modified - left.modified);

const retained = backups.slice(0, minimum);
const removable = backups
    .slice(minimum)
    .filter((backup) => backup.modified < cutoff && !retained.includes(backup));

for (const backup of removable) {
    rmSync(backup.path, { force: true });
    console.log(`removed ${backup.entry}`);
}
console.log(
    `retained ${String(backups.length - removable.length)} of ${String(backups.length)} backups (${String(retentionDays)} day retention, minimum ${String(minimum)}).`,
);
