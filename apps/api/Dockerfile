# Build context must be the **repository root** (monorepo), e.g.
#   docker build -f apps/api/Dockerfile .
# Railway and docker-compose use this layout so Railpack/Railway see the API + start.sh.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements-production.txt ./requirements-production.txt
RUN pip install --no-cache-dir -r requirements-production.txt

COPY apps/api/ ./

EXPOSE 8000

CMD ["sh", "start.sh"]
