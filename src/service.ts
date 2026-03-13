/**
 * CodexService manages communication with the Codex agent via the official SDK.
 *
 * It uses @openai/codex-sdk, which spawns the codex CLI and streams JSONL
 * events over stdin/stdout.
 */

import {
  Codex,
  Thread,
  type ThreadItem,
  type ThreadOptions,
  type CodexOptions,
  type Usage,
  type ModelReasoningEffort,
} from "@openai/codex-sdk";

import type { CodexdianSettings } from "./types";

// ---------------------------------------------------------------------------
// Public event types emitted to the UI
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse user env-var text (KEY=VALUE lines) into a record. */
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

/** Map settings thinking level to SDK ModelReasoningEffort. */
function mapReasoningEffort(level: string): ModelReasoningEffort | undefined {
  const map: Record<string, ModelReasoningEffort> = {
    off: "minimal",
    low: "low",
    medium: "medium",
    high: "high",
  };
  return map[level];
}

/** Map settings permission mode to SDK ApprovalMode. */
function mapApprovalPolicy(mode: string): "never" | "on-failure" | "untrusted" {
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

// ---------------------------------------------------------------------------
// CodexService
// ---------------------------------------------------------------------------

export class CodexService {
  private codex: Codex | null = null;
  private thread: Thread | null = null;
  private readonly vaultPath: string;
  private settings: CodexdianSettings;
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
    const customEnv = parseEnvVars(this.settings.environmentVariables);
    const options: CodexOptions = {};

    if (this.settings.codexCliPath) {
      options.codexPathOverride = this.settings.codexCliPath;
    }

    if (Object.keys(customEnv).length > 0) {
      options.env = {
        ...(process.env as Record<string, string>),
        ...customEnv,
      };
    }

    this.codex = new Codex(options);
    this.thread = null;
    this.threadId = null;
    this.instructionsInjected = false;
  }

  /** Build thread options from current settings. */
  private buildThreadOptions(): ThreadOptions {
    const opts: ThreadOptions = {
      model: this.settings.model,
      workingDirectory: this.vaultPath,
      skipGitRepoCheck: true,
      approvalPolicy: mapApprovalPolicy(this.settings.permissionMode),
    };

    const effort = mapReasoningEffort(this.settings.thinkingLevel);
    if (effort) {
      opts.modelReasoningEffort = effort;
    }

    return opts;
  }

  /** Ensure we have an active thread, creating one if needed. */
  private ensureThread(): Thread {
    if (!this.codex) {
      this.initCodex();
    }

    if (!this.thread) {
      this.thread = this.codex!.startThread(this.buildThreadOptions());
    }

    return this.thread;
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

  /** Start a new conversation (reset the thread). */
  newConversation() {
    this.thread = null;
    this.threadId = null;
    this.instructionsInjected = false;
  }

  /** Resume a thread by ID. */
  resumeThread(threadId: string) {
    if (!this.codex) this.initCodex();
    this.thread = this.codex!.resumeThread(threadId, this.buildThreadOptions());
    this.threadId = threadId;
    this.instructionsInjected = true;
  }

  /** Send a user message and stream back events. */
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
      const thread = this.ensureThread();
      const { events } = await thread.runStreamed(preparedPrompt, {
        signal: this.abortController.signal,
      });

      for await (const event of events) {
        if (this.abortController?.signal.aborted) break;

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

  /** Interrupt / abort the current query. */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this._isStreaming = false;
  }

  destroy() {
    this.abort();
    this.codex = null;
    this.thread = null;
    this.threadId = null;
    this.instructionsInjected = false;
  }
}
