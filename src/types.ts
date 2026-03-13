/** Codexdian plugin settings */
export interface CodexdianSettings {
  /** Custom path to the codex CLI binary */
  codexCliPath: string;
  /** Default model */
  model: string;
  /** Thinking / reasoning level: off | low | medium | high */
  thinkingLevel: string;
  /** Permission / approval mode */
  permissionMode: "suggest" | "auto-edit" | "full-auto";
  /** Custom system prompt appended to default */
  systemPrompt: string;
  /** Max tabs */
  maxTabs: number;
  /** Environment variables (KEY=VALUE per line) */
  environmentVariables: string;
  /** Auto-scroll to bottom on new messages */
  enableAutoScroll: boolean;
  /** Preferred response locale */
  locale: string;
}

export const DEFAULT_SETTINGS: CodexdianSettings = {
  codexCliPath: "",
  model: "gpt-5.4",
  thinkingLevel: "medium",
  permissionMode: "full-auto",
  systemPrompt: "",
  maxTabs: 3,
  environmentVariables: "",
  enableAutoScroll: true,
  locale: "en",
};

export const AVAILABLE_MODELS = [
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.3",
  "o4-mini",
  "o3",
  "codex-mini",
];

export const THINKING_LEVELS = ["off", "low", "medium", "high"];

export const PERMISSION_MODES = [
  { value: "suggest", label: "Suggest - read-only, no writes" },
  { value: "auto-edit", label: "Auto Edit - file edits auto-approved" },
  { value: "full-auto", label: "Full Auto - all actions auto-approved (YOLO)" },
];

/** A single chat message */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  /** Whether this is a thinking/reasoning block */
  isThinking?: boolean;
  /** Tokens used */
  tokens?: { input?: number; output?: number };
  /** Raw ThreadItem from the Codex SDK */
  threadItem?: any;
}

/** A conversation (tab) state */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  model: string;
  /** Default reference document for this conversation, if any */
  referenceFilePath?: string | null;
  /** Whether the user explicitly removed the reference document for this conversation */
  referenceRemoved?: boolean;
  /** Codex session ID for resume */
  sessionId?: string;
}

/** Legacy tab state kept for backward-compatible persistence */
export interface TabState {
  tabId: string;
  conversationId: string;
}

export interface PersistedTab {
  tabId: string;
  conversation: Conversation;
}

export interface WorkspaceState {
  tabs: PersistedTab[];
  activeTabId: string;
}

/** Persisted data.json */
export interface CodexdianData {
  settings: CodexdianSettings;
  workspaceState: WorkspaceState;
  tabManagerState?: {
    openTabs: TabState[];
    activeTabId: string;
  };
}
