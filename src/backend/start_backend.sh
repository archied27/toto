#!/usr/bin/env bash

trap "kill 0" EXIT

echo "Starting Toto Backend..."
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 \
  --ssl-keyfile ../certs/archie-mini-pc.tail802449.ts.net.key \
  --ssl-certfile ../certs/archie-mini-pc.tail802449.ts.net.crt &

wait