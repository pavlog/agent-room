# Fork development rules

- Write repository content, documentation, code comments, commit messages, and pull requests in English. Respond to the maintainer in Russian.
- Keep a separate "Fork changes" section in README.md current. Record only significant changes: user-facing features, meaningful behavior or security fixes, breaking changes, and major setup or deployment changes. Briefly explain the outcome and include attribution for adapted features. Omit routine refactoring, formatting, minor cleanup, and internal tooling or test-only changes unless they materially affect users or maintainers. Consolidate related entries instead of listing every commit.
- Before every commit, inspect the staged diff for credentials, tokens, personal data, machine-specific paths, logs, and session contents. Exclude secrets and replace private examples with placeholders. Report any secret already committed so it can be rotated.
- Do not restart or modify the active server without an explicit request. While it serves live work, develop in a separate worktree. Work in the primary checkout is allowed after the maintainer authorizes the transition and the server is stopped. Validate with isolated test data and ports; preserve existing room data.
- Preserve upstream attribution and distinguish inherited features from changes introduced in this fork.
