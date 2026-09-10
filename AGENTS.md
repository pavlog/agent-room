# Fork development rules

- Write repository content, documentation, code comments, commit messages, and pull requests in English. Respond to the maintainer in Russian.
- Keep a separate "Fork changes" section in README.md current, including attribution for adapted features.
- Before every commit, inspect the staged diff for credentials, tokens, personal data, machine-specific paths, logs, and session contents. Exclude secrets and replace private examples with placeholders. Report any secret already committed so it can be rotated.
- Do not restart or modify the active server without an explicit request. Develop and validate in a separate worktree, using isolated test data and ports.
- Preserve upstream attribution and distinguish inherited features from changes introduced in this fork.
