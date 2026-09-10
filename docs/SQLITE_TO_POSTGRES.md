# SQLite → PostgreSQL migration runbook

DERMAXAI now treats Alembic as the PostgreSQL schema manager. The application data can be moved from the existing SQLite database with `backend/scripts/migrate_sqlite_to_postgres.py`.

## 1. Back up the SQLite database

Stop the application before copying the database so the backup is consistent.

```bash
cp /path/to/dermaxai.db /path/to/dermaxai.db.backup
```

Keep the original backup until the PostgreSQL deployment has been validated.

## 2. Create the PostgreSQL database

For AWS, use an RDS PostgreSQL instance in the same VPC as the application host. Do not expose PostgreSQL publicly unless there is a documented operational requirement.

Set the PostgreSQL connection string through the deployment secret/environment configuration; do not commit credentials.

## 3. Create the PostgreSQL schema

Run the repository migration before copying application rows:

```bash
cd backend
python -m alembic upgrade head
```

The migration utility deliberately refuses a target whose required tables are absent.

## 4. Dry-run the data migration

```bash
python backend/scripts/migrate_sqlite_to_postgres.py \
  --source sqlite:////absolute/path/dermaxai.db \
  --target "$DATABASE_URL" \
  --dry-run
```

The dry run checks:

- required source tables and columns
- duplicate user emails after lowercase/trim normalization
- duplicate patient rows per user
- orphan patients, diagnoses, and reviews
- duplicate reviews for a diagnosis
- source and target row counts
- presence of the PostgreSQL schema

The target must be empty by default.

## 5. Perform the migration

After reviewing the dry-run output and taking a PostgreSQL backup/snapshot:

```bash
python backend/scripts/migrate_sqlite_to_postgres.py \
  --source sqlite:////absolute/path/dermaxai.db \
  --target "$DATABASE_URL"
```

The PostgreSQL writes run in one transaction. If a foreign-key, uniqueness, or type constraint fails, the transaction is rolled back rather than leaving a partially migrated database.

Explicit primary keys are preserved and PostgreSQL `id` sequences are advanced to the migrated maximum.

Do **not** use `--allow-nonempty-target` for a normal first migration. It is an explicit escape hatch for a separately planned merge/reconciliation operation.

## 6. Validate the application

Run the full backend test suite against PostgreSQL, then exercise:

1. patient login
2. patient profile access
3. diagnosis creation/history
4. doctor review workflow
5. password reset
6. admin user management

Also verify that migrated row counts match the source.

## 7. Migrate filesystem assets separately

The database stores paths such as `image_path`, `gradcam_path`, and `report_path`; it does not contain the referenced files. Copy those assets separately and preserve the paths expected by the application.

For AWS production, object storage such as S3 is preferable to relying on ephemeral EC2/container filesystems. That storage migration is intentionally separate from the relational-data migration.

## Rollback

If validation fails, keep the SQLite database untouched, stop application traffic, restore/recreate the PostgreSQL database from its pre-migration snapshot, and investigate before retrying. Never delete the source SQLite backup as part of a successful migration step.
