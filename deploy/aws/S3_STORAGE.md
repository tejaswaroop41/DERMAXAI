# Private S3 artifact storage

This document prepares DERMAXAI for durable artifact storage on AWS. The application currently uses local filesystem paths for inference and report generation, so this change adds the storage abstraction and production configuration without changing the existing local behavior.

## Why S3

The EC2 Docker volume in the production Compose stack is persistent only for that EC2 host. Replacing the host can lose uploaded images, Grad-CAM heatmaps, and generated PDF reports. A private S3 bucket removes that single-host dependency.

## Target layout

```text
s3://<private-bucket>/dermaxai/
  diagnoses/<diagnosis-id>/image.<ext>
  diagnoses/<diagnosis-id>/gradcam.jpg
  diagnoses/<diagnosis-id>/report.pdf
```

Keep the bucket private. Do not add `public-read`, website hosting, or browser-direct public object URLs.

## EC2 IAM policy

Attach an EC2 instance role rather than static AWS keys. Scope the application role to the single bucket and the `dermaxai/*` prefix.

Example policy (replace the bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListApplicationPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::REPLACE_WITH_PRIVATE_BUCKET",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["dermaxai", "dermaxai/*"]
        }
      }
    },
    {
      "Sid": "ApplicationObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::REPLACE_WITH_PRIVATE_BUCKET/dermaxai/*"
    }
  ]
}
```

If the application never deletes objects, remove `s3:DeleteObject` from the role. Enable S3 server-side encryption and block all public access on the bucket.

## Production configuration

Set these in `/opt/dermaxai/.env.production`:

```dotenv
STORAGE_BACKEND=s3
S3_BUCKET=REPLACE_WITH_PRIVATE_BUCKET
S3_PREFIX=dermaxai
AWS_REGION=ap-south-1
```

Do not put `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in the application environment on EC2. The AWS SDK should obtain temporary credentials from the EC2 instance profile.

## Current implementation boundary

`backend/core/storage.py` provides:

- local filesystem mode for development and existing deployments;
- S3 object upload using the EC2 role credentials;
- canonical `s3://bucket/key` artifact references;
- S3 object reads for the future API download path;
- optional `S3_ENDPOINT_URL` for S3-compatible test environments.

The existing API still records and serves local filesystem paths. The next integration step should update the diagnosis pipeline to upload the image, Grad-CAM, and report after local generation, store the returned `s3://...` URI in the database, and stream private S3 objects through authenticated API endpoints. Until that integration is merged, leave `STORAGE_BACKEND=local` in production.

## Migration sequence

1. Create the private S3 bucket with public access blocked and encryption enabled.
2. Create the least-privilege EC2 instance role above.
3. Test the role from the EC2 host with a scoped `aws s3` operation.
4. Deploy the storage integration with `STORAGE_BACKEND=s3` only after its CI and runtime checks are green.
5. Migrate existing artifact files into the documented key layout.
6. Verify diagnosis history, Grad-CAM, and PDF report downloads through authenticated API routes.
7. Only then remove the dependency on the EC2 `backend_data` artifact directories.

Never delete the existing EC2 artifacts until migration and restore validation are complete.
