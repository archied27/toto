# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY src/frontend/package*.json ./
RUN npm ci
COPY src/frontend/ ./
RUN npm run build

# ---- Stage 2: Python runtime ----
FROM python:3.12-slim
WORKDIR /app/backend

COPY src/backend/requirements.txt .

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L --retry 10 --retry-delay 5 \
    -o torch-2.13.0+cpu-cp312-cp312-manylinux_2_28_x86_64.whl \
    "https://download.pytorch.org/whl/cpu/torch-2.13.0%2Bcpu-cp312-cp312-manylinux_2_28_x86_64.whl" \
    && pip install --no-cache-dir torch-2.13.0+cpu-cp312-cp312-manylinux_2_28_x86_64.whl \
    && rm torch-2.13.0+cpu-cp312-cp312-manylinux_2_28_x86_64.whl

RUN pip install --no-cache-dir --timeout 100 --retries 5 -r requirements.txt

COPY src/backend/ .
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--ssl-keyfile", "../certs/archlinux.tail802449.ts.net.key", \
     "--ssl-certfile", "../certs/archlinux.tail802449.ts.net.crt"]
