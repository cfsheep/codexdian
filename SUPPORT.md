# Support

Codexdian works best when the plugin install is correct and the local `codex` CLI already works outside Obsidian.

## Before Opening An Issue

Check these first:

1. Make sure you are using Obsidian desktop. Codexdian is desktop-only.
2. Confirm the plugin folder is exactly `.obsidian/plugins/codexdian`.
3. Confirm the folder contains `manifest.json`, `main.js`, and `styles.css`.
4. Run `codex` in a normal terminal and make sure it starts successfully.
5. If the CLI is installed in a custom location, paste that full path into the `Codex CLI path` setting.
6. If you are on Windows, verify that Obsidian can access the same Codex installation that works in your terminal.

## Common Problems

### Messages do not send

This usually means Codexdian could not start the local `codex` CLI or the CLI still needs authentication.

Try:

- running `codex` once outside Obsidian
- completing sign-in there first
- restarting Obsidian after fixing the CLI environment
- setting an explicit CLI path in plugin settings

### The plugin does not appear in Obsidian

Check:

- Community Plugins are enabled
- Safe Mode is off
- the folder name is `codexdian`
- the built files are in the plugin root, not buried inside an extra ZIP subfolder

### The wrong note is attached as reference

The reference note is tracked per conversation.

- Before the first message, switching notes can update the reference chip.
- Clicking the chip close button removes the reference for that conversation.
- Starting a new session creates a fresh conversation with a fresh reference state.

## What To Include In A Bug Report

Please include:

- Obsidian version
- Codexdian version
- operating system
- whether `codex` works in your terminal
- exact steps to reproduce
- what you expected
- what actually happened
- screenshots or console errors if available

## Links

- [English README](./README.md)
- [简体中文 README](./README.zh-CN.md)
- [Contributing guide](./CONTRIBUTING.md)
