FROM python:3.11-slim

# CACHE BUST: 2026-07-30 - Render deployment, SQL echo fix

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better caching)
COPY bargain-api/requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY bargain-api ./bargain-api

# Force rebuild timestamp: 2026-07-30T00:00:00Z
RUN echo "Force rebuild for Render deployment - SQL echo fix"

ENV PYTHONUNBUFFERED=1
ENV PORT=4040

# Change to app directory before starting
WORKDIR /app/bargain-api

EXPOSE 4040

CMD ["sh", "-c", "cd /app/bargain-api && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-4040}"]
