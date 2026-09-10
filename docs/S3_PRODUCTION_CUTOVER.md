# S3 production cutover and restore validation

This runbook describes the controlled switch from local artifact storage to private Amazon S3. It is intentionally separate from application deployment so the storage migration can be verified before local copies are removed.

## Preconditions

- RDS PostgreSQL backup/snapshot and recovery procedure are confirmed.
- A private S3 bucket exists in the deployment region.
- S3 Block Public Access is enabled.
- Default encryption is enabled on the bucket.
- Versioning is recommended for production artifact recovery.
- The EC2 instance has an IAM instance profile with only the required bucket/prefix permissions.
- No AWS access keys are stored in `.env.production`.
- The application release containing S3 integration and the historical migration utility has passed CI.

## 1. Validate the bucket and role

From the EC2 host, use the instance role credentials and the configured bucket. Verify that the role can list only the application prefix and can read/write objects under `dermaxai/`.

Do not grant `s3:*` or bucket-wide object permissions to the application role.

Before migration, run the repository's S3 access check from the backend environment:

```bash
python backend/scripts/validate_s3_access.py
```

A successful check creates one temporary object under `dermaxai/_healthcheck/`, verifies its metadata and contents, and removes it again. Treat any failure as a cutover blocker; do not make the bucket public to troubleshoot it.

## 2. Inventory first

Keep production on `STORAGE_BACKEND=local` initially. Run the migration utility in dry-run mode against the production database/filesystem:

```bash
python backend/scripts/migrate_artifacts_to_s3.py --dry-run
```

Record the number of database rows, artifact files, missing files, and already-migrated S3 URIs. Investigate unexpected missing files before proceeding.

## 3. Migrate without deleting local files

Run the migration with S3 verification enabled but without local deletion:

```bash
python backend/scripts/migrate_artifacts_to_s3.py --verify
```

The utility updates a diagnosis row only after successful upload. Keep all local files at this stage.

Re-run the command if necessary; existing `s3://` references are skipped so the operation is idempotent.

## 4. Verify application retrieval

For representative patient and doctor accounts:

1. Open diagnosis history.
2. Open the Grad-CAM artifact.
3. Download/open the PDF report.
4. Confirm an unauthorized account cannot retrieve another patient's artifact.
5. Confirm the API returns the expected content type.
6. Confirm the S3 bucket itself remains private and there are no public object URLs.

Also restart/recreate the backend container and repeat artifact retrieval. This confirms the application no longer depends on the local artifact path for migrated rows.

## 5. Switch production to S3

Edit `/opt/dermaxai/.env.production`:

```dotenv
STORAGE_BACKEND=s3
S3_BUCKET=YOUR_PRIVATE_BUCKET
S3_PREFIX=dermaxai
AWS_REGION=ap-south-1
```

Do not commit this populated environment file. Restart the production stack using the reviewed release:

```bash
docker compose -f deploy/aws/docker-compose.prod.yml up -d --build
```

Verify `/api/health`, login, a new diagnosis, Grad-CAM retrieval, and PDF retrieval.

## 6. New-artifact verification

Create one new diagnosis after the switch and verify:

- the database contains `s3://<bucket>/dermaxai/diagnoses/<id>/...` references;
- the three expected objects exist in the private bucket;
- Grad-CAM and report downloads work through the authenticated API;
- local artifact generation does not become the durable source of truth.

## 7. Local cleanup — only after recovery validation

Do **not** delete local artifacts merely because migration succeeded.

First perform a restore validation: choose representative migrated diagnoses, verify their S3 objects exist, and confirm the application can serve them after the local artifact files are unavailable. If the deployment uses S3 versioning, verify that a test object can be recovered from a previous version according to the account's retention policy.

Only after successful restore validation should local historical artifacts be considered removable. Retain a backup/snapshot or other approved recovery copy according to the project's data-retention requirements.

## 8. Rollback

If S3 access fails after the switch:

1. Keep the S3 objects intact.
2. Check EC2 IAM role, bucket name/prefix, region, and bucket policy.
3. Review backend logs for S3 errors.
4. If service restoration requires it, temporarily set `STORAGE_BACKEND=local` and deploy the previous known-good release while preserving the S3 data.
5. Do not delete or overwrite migrated database references as an emergency rollback step.

After the incident, repair the S3/IAM/configuration issue and repeat the verification sequence before switching back to S3.

## Safety rules

- Never make the bucket public to simplify debugging.
- Never place long-lived AWS credentials in the application environment.
- Never bulk-delete local artifacts immediately after upload.
- Never treat a successful upload alone as proof of application recoverability.
- Keep the production bucket name and credentials out of Git.
