# Lightweight Dockerfile for HF Spaces
# Frontend is pre-built in CI, only Python runtime needed
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY servers/ servers/
COPY cli/ cli/
COPY schemas/ schemas/
COPY templates/ templates/
COPY examples/ examples/
COPY caiao_hub.py .
COPY pyproject.toml .

# Pre-built frontend (from CI)
COPY frontend/dist/ frontend/dist/

RUN mkdir -p output projects

EXPOSE 7860

CMD ["python", "servers/web_api_server.py"]
