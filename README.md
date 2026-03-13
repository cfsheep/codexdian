# Codexdian

![Obsidian](https://img.shields.io/badge/Obsidian-Desktop%20Plugin-8b5cf6?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-16a34a?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-Codex%20SDK-10a37f?style=flat-square)

Run Codex inside Obsidian and treat your vault like a real working directory.

[Simplified Chinese README](./README.zh-CN.md)

## What It Does

Codexdian embeds Codex directly into an Obsidian pane so you can:

- chat with your vault without leaving Obsidian
- let Codex read, search, edit, and reason across your notes and files
- manage multiple conversations with tabs
- switch models, reasoning depth, and approval behavior from the composer
- keep or remove a per-conversation reference document before you send the first message
- stream tool calls and intermediate output in the same conversation UI

## Why It Feels Different

Codexdian is built for people who want an agentic workflow inside a notes app, not a simple chatbot popup.

- Your vault becomes the working directory.
- Conversations can be practical and file-aware.
- The bottom composer is optimized for iterative work, not one-off prompts.
- You can decide how much autonomy Codex gets with the `YOLO` toggle.

## Highlights

- Multi-tab chat workflow
- Reference document chip per conversation
- Model picker and thinking picker in the composer
- `YOLO` approval toggle with clear on/off state
- Streaming message and tool output rendering
- Obsidian commands for opening the view, creating tabs, and starting a new session
- Desktop-first workflow for users who already work inside Obsidian all day

## Requirements

- Obsidian desktop
- A working Codex CLI environment
- Valid OpenAI / Codex authentication for the CLI you use

If Codex is not on your default `PATH`, you can set a custom CLI path in plugin settings.

## Installation

### Option 1: Manual plugin install

1. Download or clone this repository into your vault at:
   `.obsidian/plugins/codexdian`
2. Install dependencies:
   `npm install`
3. Build the plugin:
   `npm run build`
4. Open Obsidian and enable `Codexdian` in Community Plugins

### Option 2: Use built assets only

If you do not want the full source tree in your vault, copy these files into `.obsidian/plugins/codexdian`:

- `manifest.json`
- `main.js`
- `styles.css`

## Quick Start

1. Open `Codexdian` from the ribbon or Command Palette.
2. Check the composer controls at the bottom:
   model, thinking, timer, and `YOLO`.
3. Review the reference document chip in the composer.
4. Remove it with `x` if this conversation should not depend on the current note.
5. Type a request and press `Enter`.

## Reference Document Behavior

Codexdian keeps a lightweight per-conversation reference document flow:

- Before the first message, the current note can be attached as the default reference document.
- Closing the chip removes that reference for the current conversation.
- If you have not started the conversation yet and click another note, the chip can attach that note again.
- Once the conversation has started, the reference document stays stable unless you start a new session.

## Commands

- `Open chat view`
- `New tab`
- `New session (in current tab)`

## Composer Tips

- `Enter`: send message
- `Shift+Enter`: newline
- `Ctrl+C`: abort current response

## Settings

Codexdian currently supports:

- custom Codex CLI path
- default model
- thinking level
- permission mode
- maximum tabs
- system prompt
- response locale
- environment variables
- auto-scroll

## Development

```bash
npm install
npm run check
npm run build
```

Useful scripts:

- `npm run dev` for local rebuild workflow
- `npm run check` for TypeScript validation
- `npm run build` for production output

## Roadmap

Planned improvements that would make the plugin even easier to adopt:

- richer onboarding inside the plugin
- screenshots and short demo GIFs
- release packaging for easier manual installs
- more polished settings copy and troubleshooting guidance
- better context controls beyond a single reference note

## Contributing

Issues and pull requests are welcome.

If you want to help, start with:

- bug reports with reproduction steps
- UI polish
- onboarding and docs improvements
- reliability improvements around Codex CLI startup and auth

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Acknowledgements

- Obsidian
- OpenAI Codex SDK
- The broader Obsidian plugin ecosystem that makes agent workflows inside a vault practical

## License

MIT
