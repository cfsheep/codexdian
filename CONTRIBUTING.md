# Contributing to Codexdian

Thanks for considering contributing.

## Good First Contributions

- improve onboarding copy
- polish the composer UI
- fix edge cases around Codex CLI startup
- improve error messages
- expand installation and troubleshooting docs

## Local Setup

```bash
npm install
npm run check
npm run build
```

Place the plugin in:

```text
.obsidian/plugins/codexdian
```

Then reload the plugin in Obsidian after rebuilding.

## Before Opening a PR

- keep changes focused
- run `npm run check`
- run `npm run build`
- include a short summary of user-facing changes
- include screenshots for UI changes when possible

## Issue Reports

Helpful bug reports usually include:

- Obsidian version
- plugin version
- OS
- exact reproduction steps
- expected behavior
- actual behavior
- relevant console or startup errors

## Style Notes

- prefer clear names over clever ones
- keep UI copy concise
- preserve existing plugin behavior unless there is a strong reason to change it
- if you change the composer UI, test desktop layout carefully
