#!/bin/sh
set -eu

python -m alembic upgrade head
exec uvicorn app_s3:app --host 0.0.0.0 --port "${PORT:-8000}"
