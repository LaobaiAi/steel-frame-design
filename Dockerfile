# Single stage build for HF Spaces compatibility
FROM python:3.11-slim-bookworm

WORKDIR /app

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy and build frontend
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Python backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY servers/ servers/
COPY cli/ cli/
COPY schemas/ schemas/
COPY templates/ templates/
COPY examples/ examples/
COPY caiao_hub.py .
COPY pyproject.toml .

# Runtime directories
RUN mkdir -p output projects

EXPOSE 7860

CMD ["python", "servers/web_api_server.py"]
