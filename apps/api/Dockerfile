FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-production.txt .
RUN pip install --no-cache-dir -r requirements-production.txt

COPY . .

EXPOSE 8000

# Railway sets PORT; start.sh seeds DB then runs uvicorn
CMD ["sh", "start.sh"]
