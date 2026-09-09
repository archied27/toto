# start a session with two panes side by side
tmux new-session -s toto \; \
  send-keys 'cd src/frontend && npm run dev' Enter \; \
  split-window -h \; \
  send-keys 'cd src/backend && source .venv/bin/activate && 
uvicorn main:app --host 0.0.0.0 --port 8000 \
  --ssl-keyfile ../certs/archie-mini-pc.tail802449.ts.net.key \
  --ssl-certfile ../certs/archie-mini-pc.tail802449.ts.net.crt' Enter
