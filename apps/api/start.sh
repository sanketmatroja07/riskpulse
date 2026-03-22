#!/bin/sh
# Railway / Docker: seed demo data once, then start API
set -e
cd "$(dirname "$0")"
python seed/seed_data.py
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
