# ========== Stage 1: Build Frontend ==========
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ========== Stage 2: Python Runtime ==========
FROM python:3.11-slim
WORKDIR /app

# Install system deps (minimal: for OpenSeesPy if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc gfortran libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Python deps and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY servers/ servers/
COPY cli/ cli/
COPY schemas/ schemas/
COPY templates/ templates/
COPY examples/ examples/
COPY caiao_hub.py .
COPY pyproject.toml .

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist/ frontend/dist/

# Create runtime directories
RUN mkdir -p output projects

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/api/health').read().decode())" || exit 1

# Default: Web API Server
CMD ["python", "servers/web_api_server.py"]
