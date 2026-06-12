FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build frontend if not pre-built (CI pre-builds for HF Spaces)
RUN if [ ! -d frontend/dist ]; then \
        apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
        && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
        && apt-get install -y nodejs \
        && apt-get clean && rm -rf /var/lib/apt/lists/* \
        && cd frontend && npm ci && npm run build && cd ..; \
    fi

RUN mkdir -p output projects

EXPOSE 7860
CMD python servers/web_api_server.py
