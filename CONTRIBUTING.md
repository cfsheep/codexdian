# Contributing to Codexdian

Thanks for considering contributing.

If you only want to use the plugin in Obsidian, follow the user install steps in [README.md](./README.md). You do not need to run `npm install` or `npm run build` just to use Codexdian.

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

If Obsidian is already open, you can also reload the plugin after rebuilding instead of restarting the app.

## Before Opening a PR

- keep changes focused
- run `npm run check`
- run `npm run build`
- include a short summary of user-facing changes
- include screenshots for UI changes when possible
- mention any Codex CLI setup assumptions when relevant

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
- if you change installation or onboarding behavior, update both READMEs
