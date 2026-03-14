# Core Architecture

Harness core is reusable and global.

- Source: repository `tools/harness-core`
- Install target: user-scoped `.agents/harness-core`
- Repo layer: `.harness/profile.yaml` and docs under `docs/harness`
- Runtime scripts: `scripts/harness/*`

This split keeps reusable logic global and repository behavior profile-driven.
