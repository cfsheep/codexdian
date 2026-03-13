/**
 * CodexService manages communication with the Codex CLI directly.
 *
 * We avoid relying on the SDK's packaged binary lookup so release installs can
 * work with a normal system-level `codex` installation.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { ModelReasoningEffort, ThreadItem, Usage } from "@openai/codex-sdk";

import type { CodexdianSettings } from "./types";

export type UIEventType =
  | "thread.started"
  | "turn.started"
  | "turn.completed"
  | "item.started"
  | "item.updated"
  | "item.completed"
  | "error"
  | "done";

export interface UIEvent {
  type: UIEventType;
  threadId?: string;
  item?: ThreadItem;
  usage?: Usage;
  error?: string;
}

export type StreamCallback = (event: UIEvent) => void;

type ApprovalPolicy = "never" | "on-failure" | "untrusted";

type CodexThreadEvent =
  | { type: "thread.started"; thread_id: string }
  | { type: "turn.started" }
  | { type: "turn.completed"; usage: Usage }
  | { type: "turn.failed"; error: { message: string } }
  | { type: "item.started"; item: ThreadItem }
  | { type: "item.updated"; item: ThreadItem }
  | { type: "item.completed"; item: ThreadItem }
  | { type: "error"; message: string };

interface ResolvedCodexCommand {
  executable: string;
  preArgs: string[];
  useShell: boolean;
  displayPath: string;
}

const INTERNAL_ORIGINATOR_ENV = "CODEX_INTERNAL_ORIGINATOR_OVERRIDE";
const CODEXDIAN_ORIGINATOR = "codexdian_obsidian";

function parseEnvVars(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return env;
}

function mapReasoningEffort(level: string): ModelReasoningEffort | undefined {
  const map: Record<string, ModelReasoningEffort> = {
    off: "minimal",
    low: "low",
    medium: "medium",
    high: "high",
  };
  return map[level];
}

function mapApprovalPolicy(mode: string): ApprovalPolicy {
  switch (mode) {
    case "full-auto":
      return "never";
    case "auto-edit":
      return "on-failure";
    case "suggest":
    default:
      return "untrusted";
  }
}

function buildInstructionBlock(settings: CodexdianSettings): string {
  const lines: string[] = [];
  const locale = settings.locale.trim();
  const systemPrompt = settings.systemPrompt.trim();

  if (locale) {
    lines.push(`Respond using locale "${locale}" unless the user explicitly asks for another language.`);
  }

  lines.push(
    "If a prompt includes <current_note>path</current_note>, treat that file as the default reference document for the conversation and read it when relevant.",
  );

  if (systemPrompt) {
    lines.push(systemPrompt);
  }

  if (lines.length === 0) {
    return "";
  }

  return ["<codexdian_instructions>", ...lines, "</codexdian_instructions>"].join("\n");
}

function normalizeCliPath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  return trimmed ? trimmed : null;
}

function toResolvedCodexCommand(command: string): ResolvedCodexCommand {
  if (process.platform !== "win32") {
    return {
      executable: command,
      preArgs: [],
      useShell: false,
      displayPath: command,
    };
  }

  const lower = command.toLowerCase();
  if (lower.endsWith(".exe")) {
    return {
      executable: command,
      preArgs: [],
      useShell: false,
      displayPath: command,
    };
  }

  return {
    executable: command,
    preArgs: [],
    useShell: true,
    displayPath: command,
  };
}

function findExecutableInPath(...names: string[]): string | null {
  const envPath = process.env.PATH;
  if (!envPath) return null;

  const pathEntries = envPath
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    for (const name of names) {
      const candidate = path.join(entry, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function detectWindowsNpmCodexScript(): ResolvedCodexCommand | null {
  const appData = process.env.APPDATA;
  if (!appData) return null;

  const codexScript = path.join(appData, "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
  if (!existsSync(codexScript)) {
    return null;
  }

  const nodeExecutable = findExecutableInPath("node.exe", "node");
  if (!nodeExecutable) {
    return null;
  }

  return {
    executable: nodeExecutable,
    preArgs: [codexScript],
    useShell: false,
    displayPath: `${nodeExecutable} ${codexScript}`,
  };
}

function detectCodexCommandFromEnv(): ResolvedCodexCommand | null {
  const envPath = process.env.PATH;
  if (!envPath) return null;

  const pathEntries = envPath
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (process.platform === "win32") {
    for (const entry of pathEntries) {
      const exePath = path.join(entry, "codex.exe");
      if (existsSync(exePath)) {
        return toResolvedCodexCommand(exePath);
      }
    }

    const npmCodex = detectWindowsNpmCodexScript();
    if (npmCodex) {
      return npmCodex;
    }

    for (const entry of pathEntries) {
      for (const candidate of ["codex.cmd", "codex.bat", "codex.ps1", "codex"]) {
        if (existsSync(path.join(entry, candidate))) {
          return toResolvedCodexCommand("codex");
        }
      }
    }

    return null;
  }

  for (const entry of pathEntries) {
    const candidate = path.join(entry, "codex");
    if (existsSync(candidate)) {
      return toResolvedCodexCommand(candidate);
    }
  }

  return null;
}

function resolveCodexCommand(rawPath: string): ResolvedCodexCommand | null {
  const customPath = normalizeCliPath(rawPath);
  if (customPath) {
    return toResolvedCodexCommand(customPath);
  }

  return detectCodexCommandFromEnv();
}

export class CodexService {
  private readonly vaultPath: string;
  private settings: CodexdianSettings;
  private command: ResolvedCodexCommand | null = null;
  private _isStreaming = false;
  private abortController: AbortController | null = null;
  private threadId: string | null = null;
  private instructionsInjected = false;

  constructor(vaultPath: string, settings: CodexdianSettings) {
    this.vaultPath = vaultPath;
    this.settings = settings;
    this.initCodex();
  }

  get isStreaming(): boolean {
    return this._isStreaming;
  }

  get currentThreadId(): string | null {
    return this.threadId;
  }

  updateSettings(settings: CodexdianSettings) {
    this.settings = settings;
    this.initCodex();
  }

  private initCodex() {
    this.command = resolveCodexCommand(this.settings.codexCliPath);
    this.threadId = null;
    this.instructionsInjected = false;
  }

  private ensureCodexCommand(): ResolvedCodexCommand {
    if (!this.command) {
      this.command = resolveCodexCommand(this.settings.codexCliPath);
    }

    if (!this.command) {
      throw new Error(
        'Unable to find a usable Codex CLI. Make sure `codex` works in your terminal, or set "Codex CLI path" in plugin settings.',
      );
    }

    return this.command;
  }

  private buildCommandArgs(): string[] {
    const args: string[] = ["exec", "--experimental-json"];

    if (this.settings.model) {
      args.push("--model", this.settings.model);
    }

    args.push("--cd", this.vaultPath);
    args.push("--skip-git-repo-check");

    const effort = mapReasoningEffort(this.settings.thinkingLevel);
    if (effort) {
      args.push("--config", `model_reasoning_effort="${effort}"`);
    }

    args.push("--config", `approval_policy="${mapApprovalPolicy(this.settings.permissionMode)}"`);

    if (this.threadId) {
      args.push("resume", this.threadId);
    }

    return args;
  }

  private preparePrompt(prompt: string): string {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return "";
    }

    if (this.instructionsInjected) {
      return trimmedPrompt;
    }

    const instructionBlock = buildInstructionBlock(this.settings);
    this.instructionsInjected = true;

    if (!instructionBlock) {
      return trimmedPrompt;
    }

    return `${instructionBlock}\n\n${trimmedPrompt}`;
  }

  newConversation() {
    this.threadId = null;
    this.instructionsInjected = false;
  }

  resumeThread(threadId: string) {
    this.threadId = threadId;
    this.instructionsInjected = true;
  }

  async query(prompt: string, onEvent: StreamCallback): Promise<void> {
    if (this._isStreaming) {
      onEvent({ type: "error", error: "A query is already in progress" });
      return;
    }

    const preparedPrompt = this.preparePrompt(prompt);
    if (!preparedPrompt) {
      onEvent({ type: "error", error: "Prompt is empty" });
      return;
    }

    this._isStreaming = true;
    this.abortController = new AbortController();

    try {
      const resolvedCommand = this.ensureCodexCommand();
      const env = {
        ...(process.env as Record<string, string | undefined>),
        ...parseEnvVars(this.settings.environmentVariables),
      };

      env[INTERNAL_ORIGINATOR_ENV] = CODEXDIAN_ORIGINATOR;

      const executable = resolvedCommand.executable;
      const commandArgs = [...resolvedCommand.preArgs, ...this.buildCommandArgs()];

      const child = spawn(executable, commandArgs, {
        env: env as Record<string, string>,
        signal: this.abortController.signal,
        windowsHide: true,
        shell: resolvedCommand.useShell,
      });

      let spawnError: unknown | null = null;
      child.once("error", (error) => {
        spawnError = error;
      });

      if (!child.stdin) {
        child.kill();
        throw new Error("Child process has no stdin");
      }

      child.stdin.write(preparedPrompt);
      child.stdin.end();

      if (!child.stdout) {
        child.kill();
        throw new Error("Child process has no stdout");
      }

      const stderrChunks: Buffer[] = [];
      if (child.stderr) {
        child.stderr.on("data", (chunk) => {
          stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        });
      }

      const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });

      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      try {
        for await (const line of rl) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as CodexThreadEvent;

          switch (event.type) {
            case "thread.started":
              this.threadId = event.thread_id;
              onEvent({ type: "thread.started", threadId: event.thread_id });
              break;

            case "turn.started":
              onEvent({ type: "turn.started" });
              break;

            case "turn.completed":
              onEvent({ type: "turn.completed", usage: event.usage });
              break;

            case "turn.failed":
              onEvent({ type: "error", error: event.error.message });
              break;

            case "item.started":
              onEvent({ type: "item.started", item: event.item });
              break;

            case "item.updated":
              onEvent({ type: "item.updated", item: event.item });
              break;

            case "item.completed":
              onEvent({ type: "item.completed", item: event.item });
              break;

            case "error":
              onEvent({ type: "error", error: event.message });
              break;
          }
        }

        if (spawnError) {
          throw spawnError;
        }

        const { code, signal } = await exitPromise;
        if (code !== 0 || signal) {
          const stderrOutput = Buffer.concat(stderrChunks).toString("utf8").trim();
          const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
          throw new Error(stderrOutput ? `Codex CLI exited with ${detail}: ${stderrOutput}` : `Codex CLI exited with ${detail}.`);
        }

        const stderrOutput = Buffer.concat(stderrChunks).toString("utf8").trim();
        if (stderrOutput) {
          console.warn("Codexdian stderr", stderrOutput);
        }
      } finally {
        rl.close();
        child.removeAllListeners();
        if (!child.killed) {
          try {
            child.kill();
          } catch {
            // ignore cleanup failures
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        onEvent({
          type: "error",
          error: err?.message || String(err),
        });
      }
    } finally {
      this._isStreaming = false;
      this.abortController = null;
      onEvent({ type: "done" });
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this._isStreaming = false;
  }

  destroy() {
    this.abort();
    this.command = null;
    this.threadId = null;
    this.instructionsInjected = false;
  }
}
