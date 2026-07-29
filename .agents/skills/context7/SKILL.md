---
name: context7
description: >
  Fetch live, version-specific documentation and code examples from official sources via Context7.
  Use whenever working with external libraries, APIs, or frameworks (React, Vite, TailwindCSS, Firebase, Expo, etc.),
  or when checking modern API references, upgrade guides, or usage examples.
---

# Context7 Documentation Skill

Use Context7 CLI to query up-to-date, live documentation for external libraries and packages.

## Commands

1. **Resolve Library Name to Context7 ID:**
   ```bash
   npx -y ctx7 library <library_name> "<query>"
   ```

2. **Query Live Documentation:**
   ```bash
   npx -y ctx7 docs <libraryId> "<query>"
   ```

## Rules & Usage

- Trigger whenever dealing with third-party library integrations, deprecation checks, or new framework APIs.
- Avoid guessing third-party library signatures when live docs can be fetched via Context7.
