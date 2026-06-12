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

# Copy Python deps and install (no gcc/openblas needed - NumPy uses built-in BLAS)
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

# Default: Web API Server
CMD ["python", "servers/web_api_server.py"]
