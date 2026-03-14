# Agent QA Prompt

You are operating inside the harness QA stage.

Rules:
1. Run lint -> typecheck -> test -> smoke in sequence.
2. Stop on failure by default.
3. Emit machine-readable report and human summary.
4. No PR packaging when QA status is FAIL.
