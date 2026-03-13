# Codexdian

![Obsidian](https://img.shields.io/badge/Obsidian-Desktop%20Plugin-8b5cf6?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-16a34a?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-Codex%20SDK-10a37f?style=flat-square)

Vault-aware Codex for Obsidian: chat with your notes, edit files, keep a current reference note, and run multi-step workflows without leaving your vault.

[简体中文说明](./README.zh-CN.md)

## Who This Is For

Codexdian is for Obsidian desktop users who already want Codex to work inside their vault instead of in a separate terminal window.

It is not a standalone AI plugin. Codexdian is the Obsidian interface. It still depends on a working local `codex` CLI installation.

## What You Can Do

- open Codex in an Obsidian side pane
- chat with the current vault as the working directory
- keep multiple conversations in tabs
- attach the current note as a per-conversation reference document
- remove that reference note before the first message if you want a clean conversation
- switch model and thinking level from the composer
- use the `YOLO` toggle to clearly switch between safer and more autonomous approval behavior
- watch streamed replies, tool calls, file changes, and errors in one place

## Before You Install

You need:

- Obsidian desktop
- a working Codex CLI on the same machine
- valid Codex / OpenAI authentication for that CLI

If `codex` works in your terminal, Codexdian can usually use it too. If `codex` is not on your default `PATH`, set a custom binary path in plugin settings.

## Important: Obsidian Users Do Not Need To Build The Plugin

Regular users do not need `npm install` or `npm run build` just to use Codexdian.

Those commands are only for contributors who want to modify the source code.

## Install For Obsidian Users

1. Download this repository as a ZIP, or download a packaged release if one is available.
2. Create this folder inside your vault:
   `.obsidian/plugins/codexdian`
3. Copy these built plugin files into that folder:
   `manifest.json`, `main.js`, `styles.css`
4. Open Obsidian.
5. Turn off Safe Mode if needed, then enable `Codexdian` in `Settings -> Community plugins`.

If you downloaded the whole repository ZIP, you can simply move the built files above into `.obsidian/plugins/codexdian`.

## First-Time Codex CLI Setup

Codexdian needs the CLI to already be installed and authenticated.

OpenAI's official Codex CLI docs currently show this npm install flow:

```bash
npm i -g @openai/codex
codex
```

On first run, the CLI will prompt you to sign in with ChatGPT or an API key.

Official docs:

- [Codex CLI setup](https://developers.openai.com/codex/cli)
- [Codex on Windows](https://developers.openai.com/codex/windows)

Windows note:
OpenAI currently documents Windows support for Codex CLI as experimental. In practice, Codexdian works best when the `codex` command already runs successfully in the same environment Obsidian uses.

## Quick Start

1. Open any note you want to work from.
2. Open `Codexdian` from the ribbon or Command Palette.
3. Check the composer row at the bottom.
4. Confirm the reference note chip if you want the current note included.
5. Click the `x` on that chip if this conversation should not reference a note.
6. Choose your model, thinking level, and `YOLO` state.
7. Type your request and press `Enter`.

## Reference Document Behavior

Codexdian keeps the current note as an optional per-conversation reference document.

- Before the first message, the active note can be attached automatically.
- Clicking the close button on the chip removes that note from the current conversation.
- If the conversation has not started yet, selecting another note can attach the new note again.
- After the conversation starts, the reference stays stable until you start a new session.

## Permission Modes And The YOLO Toggle

Codexdian exposes the plugin's approval behavior in a way that is easy to see while chatting.

- `Suggest`: read-focused and safer
- `Auto Edit`: file edits can be auto-approved
- `Full Auto`: all actions auto-approved
- `YOLO`: the composer shortcut for quickly toggling into or out of `Full Auto`

If you want a safer default, change the permission mode in plugin settings.

## Commands

- `Open chat view`
- `New tab`
- `New session (in current tab)`

## Composer Shortcuts

- `Enter` sends the message
- `Shift+Enter` inserts a newline
- `Ctrl+C` aborts the current response

## Settings

Current settings include:

- custom Codex CLI path
- default model
- thinking level
- permission mode
- maximum tabs
- system prompt
- response locale
- environment variables
- auto scroll

## Troubleshooting

If messages do not send, check these first:

1. Run `codex` in a normal terminal outside Obsidian.
2. Make sure the CLI can start and is already authenticated.
3. If needed, set the full Codex binary path in plugin settings.
4. Confirm the plugin folder contains `manifest.json`, `main.js`, and `styles.css`.
5. On Windows, verify that Obsidian can access the same Codex installation you tested in the terminal.

More help: [SUPPORT.md](./SUPPORT.md)

## For Developers

Only contributors need this section.

```bash
npm install
npm run check
npm run build
```

Useful scripts:

- `npm run dev` for rebuilds while iterating
- `npm run check` for TypeScript validation
- `npm run build` for production output

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Roadmap

- clearer in-plugin onboarding
- screenshots and short demo media
- packaged releases for easier installs
- better startup and authentication troubleshooting
- richer context controls beyond a single reference note

## Contributing

Issues and pull requests are welcome, especially for:

- onboarding and installation clarity
- UI polish
- Codex CLI startup reliability
- reference-note and context workflow improvements

## License

MIT
