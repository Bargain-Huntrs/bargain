FROM python:3.11-slim

# CACHE BUST: 2025-06-30 - Force Railway snapshot cache invalidation

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better caching)
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Force rebuild timestamp: 2025-06-30T00:00:00Z
RUN echo "Force rebuild for FastAPI deployment"

ENV PYTHONUNBUFFERED=1
EXPOSE 4040

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-4040}"]
