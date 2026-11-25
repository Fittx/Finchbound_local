# Finchbound: notes for coding agents

Read README.md first: it covers the product, roles, stack, local run and test commands.

- Frontend: `src/` (React 19, Vite, Tailwind v4 via `src/index.css`; no Tailwind config file).
  Put global element styles inside `@layer base` so utilities still apply.
- Backend: `server/src` (Express 5, Mongoose). Every write that touches a book runs in a
  transaction (`utils/transaction.ts`); ownership is checked on the server for every host route.
- Shared contract and limits: `shared/` (types, `constants.ts`, `enums.ts`). Change limits there.
- Run `npm run typecheck`, `npm run server:typecheck` and `npm run server:test:all` before
  finishing a change. Integration tests need MongoDB on port 27018.
- Never commit `server/.env`, `.local/` or build output (`dist/`).
