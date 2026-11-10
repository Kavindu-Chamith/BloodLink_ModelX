# Contributing to BloodLink

## Branching strategy

- `main` is the shared integration branch.
- Create a short-lived `feature/<name>` or `fix/<name>` branch from `main`.
- Open a pull request to `main` and request review before merging.

## Workflow

1. Make a focused change and keep unrelated files out of the branch.
2. Use clear commit messages and actual commit dates. Do not rewrite dates to imply earlier work.
3. Run the relevant checks and record any checks that could not be run.
4. Ask a teammate to review before merging.

## Rules

- Never commit `.env` files, API keys, credentials, or real verification documents.
- Preserve data-source licenses and attribution.
- Credit contributors and disclose AI assistance accurately.
