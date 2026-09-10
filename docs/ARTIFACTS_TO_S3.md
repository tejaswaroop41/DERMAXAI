# Historical diagnosis artifacts → private S3

This runbook covers the one-time migration of existing diagnosis artifacts from the local filesystem to the private S3 bucket used by DERMAXAI.

## Safety model

The migration utility is deliberately conservative:

1. `STORAGE_BACKEND=s3` and `S3_BUCKET` are required.
2. `--dry-run` performs no uploads and no database writes.
3. Existing `s3://...` database values are skipped, so rerunning the command is safe for already-migrated rows.
4. A diagnosis field is changed to an S3 URI only after its local file uploads successfully.
5. Local files are retained by default.
6. Local deletion is allowed only with `--verify --delete-local-after-verify`, and only after every S3-backed artifact in the database verifies with `HeadObject`.
7. If an upload fails, the database pointer remains local and the local file is retained for retry.

The utility does **not** delete local files during a normal migration.

## Prerequisites

Run these commands from the `backend/` directory on the deployment host or another host that has access to the same database and artifact filesystem.

Set production-like environment variables without committing secrets:

```bash
export STORAGE_BACKEND=s3
export S3_BUCKET=your-private-bucket
export S3_PREFIX=dermaxai
export AWS_REGION=ap-south-1
export DATABASE_URL='...'
export SECRET_KEY='...'
```

Use the EC2 instance role (or another short-lived AWS credential mechanism) for S3 access. Do not put long-lived AWS access keys in `.env`, Git, Docker images, or this repository.

## Step 1 — Dry run

First inventory the work without changing anything:

```bash
python scripts/migrate_artifacts_to_s3.py --dry-run
```

Review the `SUMMARY` line:

- `rows_seen`: diagnosis rows inspected.
- `files_seen`: local artifact references that need migration.
- `already_s3`: artifact references already stored in S3.
- `missing`: local paths recorded in the database that are not present on disk.
- `failed`: migration errors. A non-zero exit code is returned if failures or missing files exist.

Resolve missing files or configuration issues before performing the real migration.

## Step 2 — Migrate, but retain local files

Run:

```bash
python scripts/migrate_artifacts_to_s3.py
```

For each successful upload, the database field is changed from the local path to a canonical URI such as:

```text
s3://your-private-bucket/dermaxai/diagnoses/42/image.jpg
```

If one artifact fails, the successful uploads are not pointed to from the database until their diagnosis transaction commits; local files remain available for retry.

## Step 3 — Verify S3 objects

After migration completes, verify all S3-backed diagnosis artifacts:

```bash
python scripts/migrate_artifacts_to_s3.py --verify
```

Verification uses S3 `HeadObject` and does not download the artifacts. The command fails if any S3-backed database pointer cannot be verified.

Recommended operational check: compare the migration summary with the number of local files identified by the dry run, and investigate every `MISSING`, `FAILED`, or `VERIFY FAILED` line before considering the migration complete.

## Optional Step 4 — Delete local copies

Only after the database and S3 objects have been independently reviewed, local copies can be removed:

```bash
python scripts/migrate_artifacts_to_s3.py --verify --delete-local-after-verify
```

This flag is intentionally explicit. If verification reports any missing S3 object, **no migrated local files are deleted**.

If local deletion is skipped, keep the local files until the retention/backup policy says they can be removed. They provide a straightforward recovery source.

## Recovery / rollback

The migration is designed for forward recovery rather than destructive rollback:

- **Upload failed:** rerun the migration after fixing S3/IAM/network issues. The database still points at the local file.
- **Database commit failed after upload:** the local file is retained. The next run can upload/replace the same deterministic S3 object and retry the database update.
- **Verification failed:** do not delete local files. Fix the S3/IAM/object issue and rerun `--verify`.
- **After local deletion:** recovery requires the verified S3 object or an independent filesystem/backup copy. Do not delete the only recovery copy until S3 restore has been validated.

The database migration is intentionally reversible at the application level while local copies exist: restoring a local path requires a controlled database update and the corresponding file copy. Do not perform ad-hoc SQL edits against production without a backup and change record.

## IAM and bucket expectations

The S3 bucket should remain private. The application host should have only the permissions required for this migration and normal artifact operation, typically `s3:PutObject`, `s3:GetObject`, and `s3:HeadObject`/the corresponding read permission on the DERMAXAI artifact prefix. Bucket administration should remain outside the application role.

Do not make the bucket or objects public to make migration or downloads easier. The application already streams private S3 artifacts through authenticated API endpoints.

## Completion criteria

Consider the migration complete only when all of the following are true:

- dry-run inventory was reviewed;
- `missing=0` and `failed=0`;
- every migrated database artifact points to the configured private bucket;
- `--verify` reports `verification_failed=0`;
- application diagnosis/Grad-CAM/report retrieval has been smoke-tested against S3;
- a database backup and S3 recovery path are available;
- local deletion, if desired, is performed only after the above checks.

After successful migration and application smoke testing, the production deployment can be switched to `STORAGE_BACKEND=s3` if it is not already enabled. Keep the production template free of real bucket names and credentials.
