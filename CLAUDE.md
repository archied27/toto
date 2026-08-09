# Toto

## Project

Toto is a local-first personal assistant / media dashboard.

## Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS + shadcn/ui
- Backend: Python + FastAPI
- Database: SQLite
- Communication: WebSockets
- Media: mpv
- Package manager: npm / uv

## Architecture

- `frontend/` contains the React application.
- `backend/` contains the FastAPI application.
- Backend plugins own their own database tables.
- Backend maintains global application state.
- Frontend receives state changes over WebSockets.
- Do not introduce global state libraries unless explicitly requested.

## Coding conventions

- Prefer small, composable functions.
- Use TypeScript types rather than `any`.
- Prefer existing components/utilities over creating duplicates.
- Follow the existing project structure.
- Don't introduce dependencies unless necessary.
- Don't rewrite working code unnecessarily.

## Important

Before making significant architectural changes:
1. Inspect the existing implementation.
2. Explain the proposed approach.
3. Wait for confirmation.

Don't install dependencies without asking me.

Don't modify package.json unless necessary.

Don't modify unrelated files.

Don't rewrite existing components just to improve them.

Don't use `any`.

Don't change the architecture without discussing it first.

Don't delete code unless you've explained why.

Don't commit changes to git.

When fixing bugs:
- Find the root cause rather than applying a superficial workaround.
- Don't modify unrelated code.
