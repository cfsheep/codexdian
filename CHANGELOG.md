# Changelog

All notable project-facing changes should be documented in this file.

## Unreleased

## 1.3.67 - 2026-03-14

- fixed release builds on Windows by launching Codex CLI directly instead of relying on vendored `@openai/codex` binaries
- fixed the empty `Codex CLI path` behavior so startup no longer fails for normal users who already have `codex` installed
- fixed assistant replies not rendering when Codex CLI emits completed items without earlier incremental item events
- clarified the Codex CLI setting copy to reflect actual auto-detection behavior

## 1.3.66 - 2026-03-14

- clarified that regular Obsidian users do not need to build the plugin
- rewrote English and Simplified Chinese setup guides
- added support guidance and GitHub issue / PR templates
- improved package and manifest descriptions for clearer discovery
- added `versions.json` and a GitHub Actions release workflow for packaged plugin downloads
