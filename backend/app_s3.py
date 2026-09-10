"""Production entrypoint that enables the S3 artifact middleware when configured."""

from app import app
from core.s3_integration import install_storage_integration

install_storage_integration(app)
