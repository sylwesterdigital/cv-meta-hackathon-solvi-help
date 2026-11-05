# SOLVI.help v0.2.195 — Public Documentation and In-App About

## Problem

The `app/README.md` file had become a ~156 KB chronological development diary, obscuring what SOLVI.help is. The separately maintained repository-root README did not flow into complete application release ZIPs. The in-app Dev log offered release notes and diagnostics, but no accessible project About section.

## Change contract

- `app/README.md`: readable, up-to-date project overview, setup, Meta integration and limitations; no release-history dump.
- Repository-root `README.md`: companion file delivered separately, adjusted for relative links from GitHub root. Release ZIP still contains **only** `manifest.json` plus `app/**` for watcher compatibility; no extra root Markdown inside ZIP.
- `app/CHANGELOG.md`: original full development diary from v0.2.194 retained byte-for-byte, with a v0.2.195 entry added at the top.
- `app/ABOUT.md`: user-facing rationale, project scope, limitations and links.
- In-app Dev log dialog: third **About** tab, built from static local HTML; no fetch, permissions, credential exposure, or blocking network dependency.
- Preserve the existing release notes and Live diagnostics tabs and their automatic release visibility behaviour.
- Update versioned source and release metadata, full SHA-256 manifest and handover. Original binary models remain unchanged.

## Acceptance

1. GitHub-root README shows the project immediately, with working links to `app/` documents.
2. App README introduces SOLVI; release history lives in `CHANGELOG.md` and deep technical details remain in `docs/LLM_HANDOVER.md`.
3. In the browser, opening the Dev log reveals About, Release notes, and Live diagnostics tabs; tab selection shows exactly one panel and updates `aria-pressed`.
4. In-app About works with no Meta key and no connection to external URLs.
5. Full JavaScript test suite passes; backend source syntax passes; original GLBs are unchanged; manifest lists all and only `app/` files with correct SHA-256.

## Deployment

Upload the standard complete ZIP through the existing Mac `updates/` watcher. GitHub repository-root README is an independent file and may require a separate `git add README.md && git commit ... && git push origin main` if the watcher only deploys `app/` and does not touch repository-root docs. Do not assume live deployment from a packaged archive.
