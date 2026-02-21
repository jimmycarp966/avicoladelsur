# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router pages and route handlers, grouped by area (`(admin)`, `(repartidor)`, `sucursal`, `api`).
- `src/actions`: server actions by domain (`ventas.actions.ts`, `rrhh.actions.ts`, `tesoreria.actions.ts`).
- `src/components`: reusable UI in `ui/` plus domain-specific components by module.
- `src/lib`, `src/types`, `src/hooks`: shared services, typing, and hooks.
- `tests`: Playwright E2E specs.
- `scripts`: operational and verification utilities (`.ts`, `.js`, `.sql`, `.ps1`).
- `supabase/migrations`: ordered SQL migrations (timestamp-prefixed files).

## Build, Test, and Development Commands
- `npm install`: install dependencies (Node `22.x`, npm `>=10`).
- `npm run dev`: run local app at `http://localhost:3000`.
- `npm run build` / `npm run start`: production build and runtime.
- `npm run lint`: run ESLint (Next.js + TypeScript config).
- `npm run type-check`: strict TypeScript check without emitting files.
- `npx playwright test`: run full E2E suite from `tests/`.
- Domain checks: `npm run test:sucursales`, `npm run test:bot:webhook`, `npm run test:bot:e2e`, `npm run verificar-bot`.

## Coding Style & Naming Conventions
- TypeScript/TSX with `strict` mode and path alias `@/*` (`tsconfig.json`).
- Follow `eslint.config.mjs`; run lint before opening PRs.
- Match existing style: 2-space indentation, semicolons, double quotes.
- Naming patterns:
  - Components: `PascalCase.tsx`
  - Server actions: `<domain>.actions.ts`
  - Tests: `<feature>.spec.ts`
  - Migrations: `YYYYMMDD[_HHMMSS]_description.sql`

## Testing Guidelines
- Playwright is the primary framework (`playwright.config.ts`, Chromium project, `testDir: ./tests`).
- Prefer deterministic, role-based E2E tests (admin/repartidor/sucursal scenarios).
- Keep one main business behavior per spec file (example: `rrhh-empleados.spec.ts`).
- For SQL/RLS changes, add or update verification SQL/scripts in `supabase/` or `scripts/`.

## Commit & Pull Request Guidelines
- History favors scoped, imperative subjects such as `feat(rrhh): ...`, `fix ...`, `RRHH: ...`, `docs: ...`, `refactor: ...`.
- Keep each commit focused on one module/domain.
- PRs should include:
  - concise summary and impacted modules
  - linked issue/task
  - screenshots/video for UI changes
  - DB migration notes (file names + execution order)
  - validation commands executed (`lint`, `type-check`, relevant tests)
