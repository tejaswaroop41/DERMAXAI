# DERMAXAI AWS production deployment

This directory contains the production Docker Compose configuration for running DERMAXAI on one EC2 application host with PostgreSQL on Amazon RDS.

## Target architecture

```text
Internet
   |
 HTTPS :443
   |
 EC2 public subnet
   |
   +-- DERMAXAI frontend/Nginx :80 (container)
   |        |
   |        +--> /api/* --> FastAPI backend :8000 (private Docker network)
   |
   +-------------------------------> RDS PostgreSQL :5432
                                      private subnet
```

RDS should be **private / not publicly accessible**. Allow inbound TCP 5432 on the RDS security group only from the EC2 application security group. Do not expose PostgreSQL to `0.0.0.0/0`.

## 1. AWS resources

Create these resources before deploying the application:

- VPC with public subnet(s) for the EC2 host and private subnet(s) for RDS.
- Internet Gateway and routing for the public EC2 subnet.
- EC2 security group: allow TCP 80 and 443 from the internet; restrict administrative access (prefer AWS Systems Manager Session Manager instead of opening SSH broadly).
- RDS security group: allow TCP 5432 **only from the EC2 security group**.
- RDS PostgreSQL instance with automated backups enabled and a suitable backup retention period.
- An EC2 IAM instance profile with least-privilege permissions if the application will use S3 or other AWS APIs. Do not put long-lived AWS access keys in `.env.production`.
- DNS record pointing the application domain to the EC2 public IP or, preferably, an Elastic IP / load balancer endpoint.

AWS documents private RDS connectivity and security-group based access here:
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.Connect.ScenariosForAccess.html
- https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/rds-gsg.pdf

## 2. Prepare EC2

Use a current supported Linux AMI and install Docker Engine + Compose plugin using the distribution's supported installation method.

Create the deployment directories:

```bash
sudo mkdir -p /opt/dermaxai/models
sudo mkdir -p /opt/dermaxai
sudo chown -R "$USER":"$USER" /opt/dermaxai
```

Copy the trained model to:

```text
/opt/dermaxai/models/best.pth
```

The production Compose file mounts this directory read-only into the backend container as `/data/models`.

## 3. Deploy the repository

On EC2:

```bash
cd /opt
sudo rm -rf dermaxai-src
git clone https://github.com/tejaswaroop41/DERMAXAI.git dermaxai-src
cd dermaxai-src
```

Check out a reviewed release commit or tag rather than deploying arbitrary development code:

```bash
git checkout <RELEASE_COMMIT_OR_TAG>
```

Create the production environment file outside Git:

```bash
sudo cp deploy/aws/.env.production.example /opt/dermaxai/.env.production
sudo chmod 600 /opt/dermaxai/.env.production
sudoedit /opt/dermaxai/.env.production
```

At minimum set:

- `SECRET_KEY` to a unique high-entropy value.
- `DATABASE_URL` to the private RDS endpoint with `sslmode=require`.
- `CORS_ORIGINS` and `FRONTEND_URL` to the exact HTTPS application origin.
- SMTP credentials for password-reset email delivery.
- `ALLOW_RANDOM_WEIGHTS=false`.
- Keep `STORAGE_BACKEND=local` until the S3 integration phase is merged and verified.

## 4. Initialize PostgreSQL schema

The backend container runs Alembic before starting FastAPI. The production entrypoint therefore applies the checked-in schema migrations automatically on startup.

Before the first production launch, verify the RDS connection from EC2 and take a database snapshot/backup plan.

If an existing SQLite database contains production data, **do not start the application against a fresh RDS instance and assume the data is present**. Use the SQLite-to-PostgreSQL migration utility from `backend/scripts/migrate_sqlite_to_postgres.py`:

```bash
python backend/scripts/migrate_sqlite_to_postgres.py \
  --source sqlite:////absolute/path/dermaxai.db \
  --target "$DATABASE_URL" \
  --dry-run
```

Then perform the real migration only after reviewing the dry-run output. The migration runbook is in `docs/SQLITE_TO_POSTGRES.md`.

## 5. Start the application

```bash
cd /opt/dermaxai-src
set -a
. /opt/dermaxai/.env.production
set +a

docker compose -f deploy/aws/docker-compose.prod.yml up -d --build
```

Verify:

```bash
docker compose -f deploy/aws/docker-compose.prod.yml ps
curl --fail http://127.0.0.1/api/health
```

The backend is intentionally not published on an EC2 host port. Only the frontend/Nginx container publishes port 80.

## 6. HTTPS

The application container serves HTTP on port 80. Put TLS termination in front of it using a supported reverse proxy/load balancer, for example:

```text
Internet -> HTTPS 443 -> TLS terminator -> EC2:80 -> frontend/Nginx -> backend
```

For a single EC2 deployment, a host-level Nginx or Caddy reverse proxy can terminate TLS and proxy to `127.0.0.1:80`. Alternatively use an AWS Application Load Balancer with an ACM certificate and forward to the EC2 target.

Do not store private TLS keys in the Git repository.

## 7. Persistent application files

The current production Compose file keeps uploads, Grad-CAM heatmaps and generated reports in the Docker `backend_data` volume. This is suitable for a single-instance first deployment but is **not** durable across loss/replacement of the EC2 host.

The repository now contains the S3 storage foundation in `backend/core/storage.py`, production environment variables, and the least-privilege IAM/storage setup in `deploy/aws/S3_STORAGE.md`. The API integration that changes database artifact references from local paths to private S3 objects is intentionally a separate phase so it can be tested independently.

For the current release, keep `STORAGE_BACKEND=local` and back up `/var/lib/docker/volumes/.../backend_data/_data` or attach a dedicated EBS volume and include it in the recovery plan.

## 8. Operational checks

After deployment verify all of the following:

```bash
# containers
docker compose -f deploy/aws/docker-compose.prod.yml ps

# application health
curl --fail https://YOUR_DOMAIN/api/health

# recent logs
docker compose -f deploy/aws/docker-compose.prod.yml logs --tail=200 backend
docker compose -f deploy/aws/docker-compose.prod.yml logs --tail=200 frontend
```

Also verify:

- Login and JWT authentication.
- Image diagnosis and Grad-CAM generation.
- PDF report generation.
- Doctor review workflow.
- Password-reset email delivery.
- RDS connectivity after an EC2/container restart.
- Upload/report persistence after a container recreation.
- Security groups do not expose RDS publicly.
- HTTPS redirects/headers are correct at the TLS terminator.

## 9. Rollback

Keep the previous known-good application commit available on the EC2 host.

```bash
git checkout <PREVIOUS_RELEASE_COMMIT_OR_TAG>
docker compose -f deploy/aws/docker-compose.prod.yml up -d --build
```

Do **not** roll back an application release by manually reversing an Alembic migration unless the migration has an explicit, tested downgrade path. Take an RDS snapshot before destructive schema changes.

## 10. What this PR does not do

This change prepares the repository for durable S3 artifact storage; it does not provision AWS resources or switch the live application to S3. No AWS account/credentials are connected to this development workflow. The actual VPC, EC2, RDS, security groups, DNS, TLS, backups, bucket and IAM resources must be created in the AWS account.
