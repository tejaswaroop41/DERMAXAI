# Private S3 artifact storage

DERMAXAI supports durable artifact storage in a private Amazon S3 bucket. New diagnosis artifacts can be uploaded to S3 and historical local artifacts can be migrated with the controlled migration utility.

## Target layout

```text
s3://<private-bucket>/dermaxai/
  diagnoses/<diagnosis-id>/image.<ext>
  diagnoses/<diagnosis-id>/gradcam.jpg
  diagnoses/<diagnosis-id>/report.pdf
```

Keep the bucket private. Do not enable public-read access, static website hosting, or browser-direct public object URLs.

## IAM

Attach an EC2 instance role, not static AWS credentials. The repository includes `deploy/aws/iam-s3-policy.example.json`, which limits the application to the configured bucket and `dermaxai/` prefix.

If the application does not need object deletion, remove `s3:DeleteObject` from that policy. Enable S3 Block Public Access, default encryption, and preferably versioning for production recovery.

## Lifecycle

`deploy/aws/s3-lifecycle.example.json` provides a conservative baseline that aborts incomplete multipart uploads after seven days and cleans expired delete markers. Do not add automatic object expiration without first confirming the application's approved data-retention requirements.

## Production configuration

Set these in `/opt/dermaxai/.env.production` only after the bucket and IAM role are ready:

```dotenv
STORAGE_BACKEND=s3
S3_BUCKET=REPLACE_WITH_PRIVATE_BUCKET
S3_PREFIX=dermaxai
AWS_REGION=ap-south-1
```

Do not put `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in the application environment on EC2. The AWS SDK should obtain temporary credentials from the EC2 instance profile.

## Application behavior

`backend/core/storage.py` provides local and S3 backends, canonical `s3://bucket/key` references, private S3 reads, and an optional S3-compatible endpoint for tests.

The production application integration uploads newly generated diagnosis images, Grad-CAM heatmaps, and PDF reports when `STORAGE_BACKEND=s3`, then serves migrated S3 artifacts through the existing authenticated API routes. Local mode remains the default repository configuration.

## Historical migration

Use `backend/scripts/migrate_artifacts_to_s3.py` for existing local artifacts. Start with:

```bash
python backend/scripts/migrate_artifacts_to_s3.py --dry-run
```

Then migrate with verification while retaining local files:

```bash
python backend/scripts/migrate_artifacts_to_s3.py --verify
```

The utility is idempotent for existing S3 references and does not permit local deletion unless verification is explicitly enabled.

## Safe production sequence

1. Create the private bucket with Block Public Access, encryption, and versioning as appropriate.
2. Attach the least-privilege EC2 instance role.
3. Validate bucket access from EC2 using the instance role.
4. Run the historical migration in dry-run mode.
5. Migrate with S3 verification and keep local artifacts.
6. Validate authenticated diagnosis, Grad-CAM, and PDF retrieval.
7. Perform restore/recovery validation.
8. Switch `STORAGE_BACKEND=s3` for production.
9. Validate newly created artifacts after the switch.
10. Only after successful recovery validation consider removing local historical copies according to the approved retention policy.

See `docs/S3_PRODUCTION_CUTOVER.md` for the detailed cutover, restore, and rollback procedure.
