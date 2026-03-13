import {
  App,
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";

import { CodexService, UIEvent } from "./service";
import type {
  AgentMessageItem,
  CommandExecutionItem,
  ErrorItem,
  FileChangeItem,
  McpToolCallItem,
  ReasoningItem,
  ThreadItem,
  TodoListItem,
} from "@openai/codex-sdk";

import {
  AVAILABLE_MODELS,
  ChatMessage,
  CodexdianData,
  CodexdianSettings,
  Conversation,
  DEFAULT_SETTINGS,
  PERMISSION_MODES,
  PersistedTab,
  THINKING_LEVELS,
  WorkspaceState,
} from "./types";

const VIEW_TYPE_CODEXDIAN = "codexdian-view";

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDefaultWorkspaceState(): WorkspaceState {
  return { tabs: [], activeTabId: "" };
}

function createDefaultData(): CodexdianData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    workspaceState: createDefaultWorkspaceState(),
    tabManagerState: { openTabs: [], activeTabId: "" },
  };
}

function createConversation(model: string, referenceFilePath: string | null = null): Conversation {
  return {
    id: genId("conv"),
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
    model,
    referenceFilePath,
    referenceRemoved: false,
  };
}

function normalizeConversation(conversation: Partial<Conversation> | undefined, model: string): Conversation {
  return {
    id: conversation?.id || genId("conv"),
    title: conversation?.title || "New chat",
    messages: Array.isArray(conversation?.messages) ? conversation.messages : [],
    createdAt: conversation?.createdAt || Date.now(),
    model: conversation?.model || model,
    referenceFilePath: conversation?.referenceFilePath ?? null,
    referenceRemoved: conversation?.referenceRemoved ?? false,
    sessionId: conversation?.sessionId,
  };
}

function normalizeWorkspaceState(data: Partial<CodexdianData> | null | undefined, model: string): WorkspaceState {
  const tabs = Array.isArray(data?.workspaceState?.tabs)
    ? data!.workspaceState.tabs
        .filter((tab): tab is PersistedTab => Boolean(tab?.tabId && tab?.conversation))
        .map((tab) => ({
          tabId: tab.tabId,
          conversation: normalizeConversation(tab.conversation, model),
        }))
    : [];

  const restoredActiveTabId = data?.workspaceState?.activeTabId;
  const activeTabId =
    restoredActiveTabId && tabs.some((tab) => tab.tabId === restoredActiveTabId)
      ? restoredActiveTabId
      : tabs[0]?.tabId || "";

  return { tabs, activeTabId };
}

const CODEX_LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

interface ViewTabState {
  tabId: string;
  conversation: Conversation;
  service: CodexService | null;
}

interface StatusMenuOption {
  label: string;
  selected: boolean;
  onSelect: () => void;
  iconText?: string;
}

const THINKING_LEVEL_LABELS: Record<string, string> = {
  off: "低",
  low: "中",
  medium: "高",
  high: "超高",
};

const THINKING_LEVEL_LABELS_SAFE: Record<string, string> = {
  off: "\u5173\u95ed",
  low: "\u4f4e",
  medium: "\u4e2d",
  high: "\u9ad8",
};

function formatModelLabel(model: string): string {
  return model
    .replace(/^gpt-/i, "GPT-")
    .replace(/-codex/gi, "-Codex")
    .replace(/-mini/gi, "-Mini")
    .replace(/-max/gi, "-Max");
}

function formatThinkingLevelLabel(level: string): string {
  return THINKING_LEVEL_LABELS_SAFE[level] || THINKING_LEVEL_LABELS[level] || level;
}

function formatYoloStateLabel(enabled: boolean): string {
  return enabled ? "\u5f00" : "\u5173";
}

function formatCurrentReference(notePath: string): string {
  return `<current_note>\n${notePath}\n</current_note>`;
}

function appendCurrentReference(prompt: string, notePath: string): string {
  return `${prompt}\n\n${formatCurrentReference(notePath)}`;
}

function renderThreadItem(item: ThreadItem, containerEl: HTMLElement, app: App, component: CodexdianView) {
  switch (item.type) {
    case "agent_message": {
      const msg = item as AgentMessageItem;
      const contentEl = containerEl.createDiv({ cls: "codexdian-message-content" });
      void MarkdownRenderer.render(app, msg.text, contentEl, "", component);
      break;
    }
    case "reasoning": {
      const msg = item as ReasoningItem;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-thinking" });
      const label = el.createDiv({ cls: "codexdian-thinking-label" });
      label.createSpan({ text: "Thinking", cls: "codexdian-thinking-text" });
      const body = el.createDiv({ cls: "codexdian-thinking-content" });
      body.textContent = msg.text;
      break;
    }
    case "command_execution": {
      const cmd = item as CommandExecutionItem;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      setIcon(iconSpan, "terminal");
      header.createSpan({ text: ` ${cmd.command}` });
      header.createSpan({
        cls: `codexdian-status-badge codexdian-status-${cmd.status}`,
        text: cmd.status,
      });
      if (cmd.aggregated_output) {
        const outputBlock = el.createEl("pre", { cls: "codexdian-tool-output" });
        outputBlock.createEl("code", { text: cmd.aggregated_output });
      }
      if (cmd.exit_code !== undefined && cmd.exit_code !== 0) {
        el.createDiv({ cls: "codexdian-exit-code", text: `Exit code: ${cmd.exit_code}` });
      }
      break;
    }
    case "file_change": {
      const fc = item as FileChangeItem;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      setIcon(iconSpan, "file-edit");
      header.createSpan({ text: ` File changes (${fc.status})` });
      const list = el.createEl("ul", { cls: "codexdian-file-changes" });
      for (const change of fc.changes) {
        const li = list.createEl("li");
        const kindIcon = change.kind === "add" ? "+" : change.kind === "delete" ? "-" : "~";
        li.createSpan({ text: `${kindIcon} ${change.path}`, cls: `codexdian-change-${change.kind}` });
      }
      break;
    }
    case "mcp_tool_call": {
      const mcp = item as McpToolCallItem;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call codexdian-mcp-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      setIcon(iconSpan, "puzzle");
      header.createSpan({ text: ` ${mcp.server}/${mcp.tool}` });
      if (mcp.arguments) {
        const inputBlock = el.createEl("pre", { cls: "codexdian-tool-input" });
        inputBlock.createEl("code", {
          text: typeof mcp.arguments === "string" ? mcp.arguments : JSON.stringify(mcp.arguments, null, 2),
        });
      }
      if (mcp.error) {
        el.createDiv({ cls: "codexdian-error-text", text: mcp.error.message });
      }
      break;
    }
    case "todo_list": {
      const todo = item as TodoListItem;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-todo-list" });
      el.createDiv({ cls: "codexdian-todo-header", text: "To-do list" });
      const list = el.createEl("ul", { cls: "codexdian-todo-items" });
      for (const ti of todo.items) {
        const li = list.createEl("li", { cls: ti.completed ? "codexdian-todo-done" : "" });
        li.createSpan({ text: ti.completed ? "[x]" : "[ ]" });
        li.createSpan({ text: ti.text });
      }
      break;
    }
    case "error": {
      const err = item as ErrorItem;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-error-msg" });
      el.createSpan({ text: `Error: ${err.message}` });
      break;
    }
    case "web_search": {
      const ws = item as { query?: string };
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      setIcon(iconSpan, "search");
      header.createSpan({ text: ` Web search: ${ws.query || ""}` });
      break;
    }
  }
}

class CodexdianView extends ItemView {
  plugin: CodexdianPlugin;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private statusBarEl: HTMLElement | null = null;
  private tabBarEl: HTMLElement | null = null;
  private contextRowEl: HTMLElement | null = null;
  private referenceDocEl: HTMLElement | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private tabs: ViewTabState[] = [];
  private activeTabId = "";
  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private statusMenuEl: HTMLElement | null = null;
  private statusMenuAnchorEl: HTMLElement | null = null;
  private statusMenuCloseHandler: ((event: MouseEvent) => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: CodexdianPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CODEXDIAN;
  }

  getDisplayText(): string {
    return "Codexdian";
  }

  getIcon(): string {
    return "code-2";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("codexdian-container");

    const header = container.createDiv({ cls: "codexdian-header" });
    const titleSlot = header.createDiv({ cls: "codexdian-title-slot" });
    const logo = titleSlot.createDiv({ cls: "codexdian-logo" });
    logo.innerHTML = CODEX_LOGO_SVG;
    titleSlot.createEl("h4", { text: "Codexdian", cls: "codexdian-title-text" });
    this.tabBarEl = titleSlot.createDiv({ cls: "codexdian-tab-bar-container" });
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.refreshReferenceDoc(Boolean(file));
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.refreshReferenceDoc(leaf?.view instanceof MarkdownView);
      }),
    );

    const actions = header.createDiv({ cls: "codexdian-header-actions" });

    const newTabBtn = actions.createDiv({ cls: "codexdian-header-btn codexdian-new-tab-btn" });
    setIcon(newTabBtn, "plus");
    newTabBtn.title = "New tab";
    newTabBtn.addEventListener("click", () => this.createTab());

    const newSessionBtn = actions.createDiv({ cls: "codexdian-header-btn" });
    setIcon(newSessionBtn, "rotate-ccw");
    newSessionBtn.title = "New session";
    newSessionBtn.addEventListener("click", () => this.newSession());

    const settingsBtn = actions.createDiv({ cls: "codexdian-header-btn" });
    setIcon(settingsBtn, "settings");
    settingsBtn.title = "Settings";
    settingsBtn.addEventListener("click", () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById("codexdian");
    });

    this.messagesEl = container.createDiv({ cls: "codexdian-messages" });

    const inputArea = container.createDiv({ cls: "codexdian-input-area" });
    this.contextRowEl = inputArea.createDiv({ cls: "codexdian-context-row" });
    this.referenceDocEl = this.contextRowEl.createDiv({ cls: "codexdian-reference-doc" });
    this.renderReferenceDoc();

    const inputRow = inputArea.createDiv({ cls: "codexdian-input-row" });
    this.inputEl = inputRow.createEl("textarea", {
      cls: "codexdian-input",
      attr: { placeholder: "Ask Codex anything...", rows: "1" },
    });

    this.inputEl.addEventListener("input", () => {
      if (!this.inputEl) return;
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 200)}px`;
    });

    this.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void this.sendMessage();
      }
      if (event.key === "c" && event.ctrlKey) {
        this.abortCurrent();
      }
    });

    const sendBtn = inputRow.createDiv({ cls: "codexdian-send-btn" });
    setIcon(sendBtn, "send");
    sendBtn.addEventListener("click", () => void this.sendMessage());

    this.statusBarEl = inputArea.createDiv({ cls: "codexdian-status-bar" });
    this.renderStatusBar();

    const restored = await this.restoreTabs();
    if (!restored) {
      this.createTab();
    } else {
      this.refreshReferenceDoc();
      this.renderTabs();
      this.renderMessages();
    }
  }

  async onClose() {
    this.closeStatusMenu();
    this.flushPersistState();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    for (const tab of this.tabs) {
      tab.service?.destroy();
    }
    this.tabs = [];
  }

  private getVaultPath(): string {
    return (this.app.vault.adapter as { basePath?: string }).basePath || "";
  }

  private getReferenceFile(): TFile | null {
    const tab = this.getActiveTab();
    const referencePath = tab?.conversation.referenceRemoved ? null : tab?.conversation.referenceFilePath ?? null;
    if (referencePath) {
      const file = this.app.vault.getAbstractFileByPath(referencePath);
      if (file instanceof TFile) {
        return file;
      }
    }

    return tab ? null : this.plugin.getCurrentReferenceFile();
  }

  private refreshReferenceDoc(allowReattach = false) {
    const tab = this.getActiveTab();
    if (tab && tab.conversation.messages.length === 0) {
      const currentFile = this.plugin.getCurrentReferenceFile();
      const nextPath = currentFile?.path ?? null;

      if (allowReattach && nextPath) {
        if (tab.conversation.referenceFilePath !== nextPath || tab.conversation.referenceRemoved) {
          tab.conversation.referenceFilePath = nextPath;
          tab.conversation.referenceRemoved = false;
          this.queuePersistState();
        }
      } else if (!tab.conversation.referenceRemoved && tab.conversation.referenceFilePath !== nextPath) {
        tab.conversation.referenceFilePath = nextPath;
        this.queuePersistState();
      }
    }

    this.renderReferenceDoc();
  }

  private clearReferenceDoc() {
    const tab = this.getActiveTab();
    if (!tab) return;

    tab.conversation.referenceFilePath = null;
    tab.conversation.referenceRemoved = true;
    this.renderReferenceDoc();
    this.queuePersistState();
  }

  private renderReferenceDoc() {
    if (!this.referenceDocEl || !this.contextRowEl) return;

    const file = this.getReferenceFile();
    this.referenceDocEl.empty();
    this.contextRowEl.classList.toggle("has-content", Boolean(file));

    if (!file) {
      this.referenceDocEl.removeAttribute("title");
      return;
    }

    this.referenceDocEl.classList.remove("is-empty");
    this.referenceDocEl.title = file.path;

    const iconEl = this.referenceDocEl.createDiv({ cls: "codexdian-reference-doc-icon" });
    setIcon(iconEl, "file-text");

    const bodyEl = this.referenceDocEl.createDiv({ cls: "codexdian-reference-doc-body" });
    bodyEl.createSpan({
      cls: "codexdian-reference-doc-label",
      text: "\u5f53\u524d\u53c2\u8003\u6587\u6863",
    });
    bodyEl.createSpan({
      cls: "codexdian-reference-doc-value",
      text: file.basename,
    });

    const removeBtn = this.referenceDocEl.createEl("button", {
      cls: "codexdian-reference-doc-remove",
      attr: {
        type: "button",
        "aria-label": "Remove reference document from this conversation",
      },
    });
    setIcon(removeBtn, "x");
    removeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearReferenceDoc();
    });
  }

  private buildService(conversation: Conversation): CodexService {
    const service = new CodexService(this.getVaultPath(), this.plugin.settings);
    if (conversation.sessionId) {
      try {
        service.resumeThread(conversation.sessionId);
      } catch (error) {
        console.error("Codexdian: failed to resume conversation", error);
        conversation.sessionId = undefined;
      }
    }
    return service;
  }

  private async restoreTabs(): Promise<boolean> {
    const workspaceState = this.plugin.getWorkspaceState();
    if (workspaceState.tabs.length === 0) {
      return false;
    }

    this.tabs = workspaceState.tabs.slice(0, this.plugin.settings.maxTabs).map((tab) => {
      const conversation = normalizeConversation(tab.conversation, this.plugin.settings.model);
      return {
        tabId: tab.tabId,
        conversation,
        service: null,
      };
    });

    this.activeTabId =
      workspaceState.activeTabId && this.tabs.some((tab) => tab.tabId === workspaceState.activeTabId)
        ? workspaceState.activeTabId
        : this.tabs[0]?.tabId || "";

    return this.tabs.length > 0;
  }

  private serializeTabs(): PersistedTab[] {
    return this.tabs.map((tab) => ({
      tabId: tab.tabId,
      conversation: cloneJson(tab.conversation),
    }));
  }

  private queuePersistState() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.plugin.saveWorkspaceState({
        tabs: this.serializeTabs(),
        activeTabId: this.activeTabId,
      });
    }, 150);
  }

  private flushPersistState() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    void this.plugin.saveWorkspaceState({
      tabs: this.serializeTabs(),
      activeTabId: this.activeTabId,
    });
  }

  createTab() {
    if (this.tabs.length >= this.plugin.settings.maxTabs) {
      new Notice(`Maximum ${this.plugin.settings.maxTabs} tabs reached`);
      return;
    }

    const tabId = genId("tab");
    const conversation = createConversation(this.plugin.settings.model, this.plugin.getCurrentReferenceFile()?.path ?? null);
    this.tabs.push({ tabId, conversation, service: null });
    this.switchTab(tabId);
    this.queuePersistState();
  }

  private switchTab(tabId: string) {
    this.activeTabId = tabId;
    this.refreshReferenceDoc();
    this.renderTabs();
    this.renderMessages();
    this.queuePersistState();
  }

  private closeTab(tabId: string) {
    const tab = this.tabs.find((candidate) => candidate.tabId === tabId);
    if (!tab) return;

    if (tab.service?.isStreaming) {
      new Notice("Cannot close a tab while it is streaming");
      return;
    }

    tab.service?.destroy();
    this.tabs = this.tabs.filter((candidate) => candidate.tabId !== tabId);

    if (this.tabs.length === 0) {
      this.createTab();
      return;
    }

    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[this.tabs.length - 1].tabId;
    }

    this.refreshReferenceDoc();
    this.renderTabs();
    this.renderMessages();
    this.queuePersistState();
  }

  private getActiveTab() {
    return this.tabs.find((tab) => tab.tabId === this.activeTabId) || null;
  }

  private ensureActiveTab() {
    const existing = this.getActiveTab();
    if (existing) {
      return existing;
    }

    if (this.tabs.length === 0) {
      this.createTab();
    } else {
      this.activeTabId = this.tabs[0]?.tabId || "";
    }

    this.renderTabs();
    this.renderMessages();
    return this.getActiveTab();
  }

  private ensureTabService(tab: ViewTabState): CodexService | null {
    if (tab.service) {
      return tab.service;
    }

    try {
      tab.service = this.buildService(tab.conversation);
      return tab.service;
    } catch (error) {
      console.error("Codexdian: failed to initialize Codex service", error);
      const message = error instanceof Error ? error.message : String(error);
      const lastMessage = tab.conversation.messages[tab.conversation.messages.length - 1];

      if (lastMessage?.role !== "system" || lastMessage.content !== `**Error:** ${message}`) {
        tab.conversation.messages.push({
          id: genId("msg"),
          role: "system",
          content: `**Error:** ${message}`,
          timestamp: Date.now(),
        });
      }

      this.renderMessages();
      this.queuePersistState();
      new Notice("Codexdian could not start Codex CLI. Check plugin settings.");
      return null;
    }
  }

  newSession() {
    const tab = this.ensureActiveTab();
    if (!tab) return;
    if (tab.service?.isStreaming) {
      new Notice("Cannot start a new session while streaming");
      return;
    }

    tab.service?.destroy();
    tab.service = null;
    tab.conversation = createConversation(this.plugin.settings.model, this.plugin.getCurrentReferenceFile()?.path ?? null);
    this.refreshReferenceDoc();
    this.renderMessages();
    this.queuePersistState();
  }

  private abortCurrent() {
    const tab = this.getActiveTab();
    if (tab?.service?.isStreaming) {
      tab.service.abort();
      new Notice("Query aborted");
    }
  }

  private renderTabs() {
    if (!this.tabBarEl) return;
    this.tabBarEl.empty();

    if (this.tabs.length <= 1) return;

    const badges = this.tabBarEl.createDiv({ cls: "codexdian-tab-badges" });
    this.tabs.forEach((tab, index) => {
      const isActive = tab.tabId === this.activeTabId;
      const isStreaming = tab.service?.isStreaming ?? false;
      let cls = "codexdian-tab-badge";
      if (isActive) cls += " codexdian-tab-badge-active";
      if (isStreaming) cls += " codexdian-tab-badge-streaming";

      const badge = badges.createDiv({ cls, text: String(index + 1) });
      badge.title = tab.conversation.title;
      badge.addEventListener("click", () => this.switchTab(tab.tabId));
      badge.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (this.tabs.length > 1) {
          this.closeTab(tab.tabId);
        }
      });
    });
  }

  private renderWelcome() {
    if (!this.messagesEl) return;
    this.messagesEl.empty();

    const welcome = this.messagesEl.createDiv({ cls: "codexdian-welcome" });
    const logoDiv = welcome.createDiv({ cls: "codexdian-welcome-logo" });
    logoDiv.innerHTML = CODEX_LOGO_SVG.replace('width="20" height="20"', 'width="48" height="48"');

    welcome.createEl("h3", { text: "Codexdian" });
    welcome.createEl("p", {
      text: "Your vault is Codex's workspace. Ask anything - it can read, write, search, and run commands.",
      cls: "codexdian-welcome-desc",
    });

    const quickActions = welcome.createDiv({ cls: "codexdian-quick-actions" });
    const suggestions = [
      "Summarize the current note",
      "Find all TODO items in the vault",
      "Create a new note from template",
    ];

    for (const suggestion of suggestions) {
      const chip = quickActions.createDiv({ cls: "codexdian-suggestion-chip", text: suggestion });
      chip.addEventListener("click", () => {
        if (!this.inputEl) return;
        this.inputEl.value = suggestion;
        void this.sendMessage();
      });
    }
  }

  private renderMessages() {
    if (!this.messagesEl) return;
    const tab = this.getActiveTab();
    if (!tab || tab.conversation.messages.length === 0) {
      this.renderWelcome();
      return;
    }

    this.messagesEl.empty();

    for (const msg of tab.conversation.messages) {
      const msgEl = this.messagesEl.createDiv({
        cls: `codexdian-message codexdian-message-${msg.role}`,
      });

      if (msg.role === "user") {
        const avatar = msgEl.createDiv({ cls: "codexdian-avatar codexdian-avatar-user" });
        setIcon(avatar, "user");
      } else if (msg.role === "assistant" || msg.role === "tool") {
        const avatar = msgEl.createDiv({ cls: "codexdian-avatar codexdian-avatar-assistant" });
        avatar.innerHTML = CODEX_LOGO_SVG.replace('width="20" height="20"', 'width="16" height="16"');
      }

      if (msg.role === "user") {
        const contentEl = msgEl.createDiv({ cls: "codexdian-message-content" });
        void MarkdownRenderer.render(this.app, msg.content, contentEl, "", this);
      } else if (msg.threadItem) {
        renderThreadItem(msg.threadItem, msgEl, this.app, this);
      } else {
        const contentEl = msgEl.createDiv({ cls: "codexdian-message-content" });
        void MarkdownRenderer.render(this.app, msg.content, contentEl, "", this);
      }
    }

    if (this.plugin.settings.enableAutoScroll) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  private async sendMessage() {
    if (!this.inputEl) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    const tab = this.ensureActiveTab();
    if (!tab) {
      new Notice("Codexdian could not create a chat tab.");
      return;
    }

    if (tab.service?.isStreaming) {
      new Notice("Codexdian is still responding in this tab.");
      return;
    }

    this.inputEl.value = "";
    this.inputEl.style.height = "auto";

    tab.conversation.messages.push({
      id: genId("msg"),
      role: "user",
      content: text,
      timestamp: Date.now(),
    });
    this.renderMessages();
    this.queuePersistState();

    const service = this.ensureTabService(tab);
    if (!service) {
      return;
    }

    const promptToSend =
      !tab.conversation.referenceRemoved && tab.conversation.referenceFilePath
        ? appendCurrentReference(text, tab.conversation.referenceFilePath)
        : text;

    this.startTimer();
    this.updateStatusStreaming(true);
    this.renderTabs();

    const itemMap = new Map<string, ChatMessage>();

    try {
      await service.query(promptToSend, (event: UIEvent) => {
        switch (event.type) {
          case "thread.started":
            tab.conversation.sessionId = event.threadId;
            this.queuePersistState();
            break;

          case "item.started":
          case "item.updated": {
            if (!event.item) break;
            const existing = itemMap.get(event.item.id);
            if (existing) {
              existing.threadItem = event.item;
              existing.content = this.itemToText(event.item);
            } else {
              const msg: ChatMessage = {
                id: genId("msg"),
                role: event.item.type === "reasoning" ? "assistant" : "tool",
                content: this.itemToText(event.item),
                timestamp: Date.now(),
                isThinking: event.item.type === "reasoning",
                threadItem: event.item,
              };
              if (event.item.type === "agent_message") {
                msg.role = "assistant";
              }
              itemMap.set(event.item.id, msg);
              tab.conversation.messages.push(msg);
            }
            this.renderMessages();
            this.queuePersistState();
            break;
          }

          case "item.completed": {
            if (!event.item) break;
            const existing = itemMap.get(event.item.id);
            if (existing) {
              existing.threadItem = event.item;
              existing.content = this.itemToText(event.item);
            } else {
              const msg: ChatMessage = {
                id: genId("msg"),
                role: event.item.type === "reasoning" ? "assistant" : "tool",
                content: this.itemToText(event.item),
                timestamp: Date.now(),
                isThinking: event.item.type === "reasoning",
                threadItem: event.item,
              };
              if (event.item.type === "agent_message") {
                msg.role = "assistant";
              }
              itemMap.set(event.item.id, msg);
              tab.conversation.messages.push(msg);
            }
            this.renderMessages();
            this.queuePersistState();
            break;
          }

          case "turn.completed": {
            if (event.usage) {
              const lastAssistant = [...tab.conversation.messages].reverse().find((msg) => msg.role === "assistant");
              if (lastAssistant) {
                lastAssistant.tokens = {
                  input: event.usage.input_tokens,
                  output: event.usage.output_tokens,
                };
              }
            }
            this.queuePersistState();
            break;
          }

          case "error":
            tab.conversation.messages.push({
              id: genId("msg"),
              role: "system",
              content: `**Error:** ${event.error}`,
              timestamp: Date.now(),
            });
            this.renderMessages();
            this.queuePersistState();
            break;

          case "turn.started":
          case "done":
            break;
        }
      });

      if (tab.conversation.title === "New chat") {
        const firstUser = tab.conversation.messages.find((msg) => msg.role === "user");
        if (firstUser) {
          tab.conversation.title =
            firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? "..." : "");
        }
      }
    } catch (error) {
      console.error("Codexdian: failed to send message", error);
      tab.conversation.messages.push({
        id: genId("msg"),
        role: "system",
        content: `**Error:** ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      });
    } finally {
      this.stopTimer();
      this.updateStatusStreaming(false);
      this.renderMessages();
      this.renderTabs();
      this.queuePersistState();
    }
  }

  private itemToText(item: ThreadItem): string {
    switch (item.type) {
      case "agent_message":
        return (item as AgentMessageItem).text;
      case "reasoning":
        return (item as ReasoningItem).text;
      case "command_execution": {
        const cmd = item as CommandExecutionItem;
        return `\`${cmd.command}\` -> ${cmd.status}`;
      }
      case "file_change": {
        const fc = item as FileChangeItem;
        return fc.changes.map((change) => `${change.kind}: ${change.path}`).join("\n");
      }
      case "error":
        return (item as ErrorItem).message;
      default:
        return "";
    }
  }

  private closeStatusMenu() {
    this.statusMenuEl?.remove();
    this.statusMenuEl = null;

    if (this.statusMenuAnchorEl && this.statusMenuAnchorEl.isConnected) {
      this.statusMenuAnchorEl.removeClass("is-open");
    }
    this.statusMenuAnchorEl = null;

    if (this.statusMenuCloseHandler) {
      document.removeEventListener("click", this.statusMenuCloseHandler);
      this.statusMenuCloseHandler = null;
    }
  }

  private showStatusMenu(anchor: HTMLElement, title: string, options: StatusMenuOption[]) {
    if (!this.statusBarEl) return;

    if (this.statusMenuEl && this.statusMenuAnchorEl === anchor) {
      this.closeStatusMenu();
      return;
    }

    this.closeStatusMenu();

    anchor.addClass("is-open");

    const menu = this.statusBarEl.createDiv({ cls: "codexdian-status-menu" });
    menu.createDiv({ cls: "codexdian-status-menu-title", text: title });

    options.forEach((option) => {
      const item = menu.createDiv({
        cls: `codexdian-status-menu-item ${option.selected ? "is-selected" : ""}`,
      });

      const leading = item.createSpan({ cls: "codexdian-status-menu-leading", text: option.iconText || "" });
      if (!option.iconText) {
        leading.addClass("is-empty");
      }

      item.createSpan({ cls: "codexdian-status-menu-label", text: option.label });

      const check = item.createSpan({ cls: "codexdian-status-menu-check" });
      if (option.selected) {
        setIcon(check, "check");
      }

      item.addEventListener("click", (event) => {
        event.stopPropagation();
        option.onSelect();
        this.closeStatusMenu();
      });
    });

    const statusRect = this.statusBarEl.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.max(0, Math.min(anchorRect.left - statusRect.left, statusRect.width - menuWidth));
    menu.style.left = `${left}px`;

    this.statusMenuEl = menu;
    this.statusMenuAnchorEl = anchor;
    this.statusMenuCloseHandler = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node) && !anchor.contains(event.target as Node)) {
        this.closeStatusMenu();
      }
    };

    setTimeout(() => {
      if (this.statusMenuCloseHandler) {
        document.addEventListener("click", this.statusMenuCloseHandler);
      }
    }, 0);
  }

  private renderStatusBar() {
    if (!this.statusBarEl) return;
    this.closeStatusMenu();
    this.statusBarEl.empty();

    const modelBtn = this.statusBarEl.createDiv({ cls: "codexdian-status-picker codexdian-status-picker-model" });
    modelBtn.createSpan({ cls: "codexdian-status-picker-value", text: formatModelLabel(this.plugin.settings.model) });
    const modelChevron = modelBtn.createSpan({ cls: "codexdian-status-picker-chevron" });
    setIcon(modelChevron, "chevron-down");
    modelBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showModelPicker(modelBtn);
    });

    const thinkingBtn = this.statusBarEl.createDiv({ cls: "codexdian-status-picker codexdian-status-picker-thinking" });
    thinkingBtn.createSpan({ cls: "codexdian-status-picker-label", text: "Thinking" });
    thinkingBtn.createSpan({
      cls: "codexdian-status-picker-value",
      text: formatThinkingLevelLabel(this.plugin.settings.thinkingLevel),
    });
    const thinkingChevron = thinkingBtn.createSpan({ cls: "codexdian-status-picker-chevron" });
    setIcon(thinkingChevron, "chevron-down");
    thinkingBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showThinkingPicker(thinkingBtn);
    });

    this.statusBarEl.createDiv({ cls: "codexdian-status-spacer" });
    this.statusBarEl.createDiv({ cls: "codexdian-status-meta codexdian-timer", text: "0s" });

    const isYolo = this.plugin.settings.permissionMode === "full-auto";
    const yoloControl = this.statusBarEl.createDiv({
      cls: `codexdian-yolo-control ${isYolo ? "is-active" : "is-inactive"}`,
    });
    const yoloLabel = yoloControl.createDiv({ cls: "codexdian-yolo-label" });
    yoloLabel.createSpan({ cls: "codexdian-yolo-text", text: "YOLO" });
    yoloLabel.createSpan({
      cls: `codexdian-yolo-state ${isYolo ? "is-on" : "is-off"}`,
      text: isYolo ? "开" : "关",
    });

    const yoloStateEl = yoloLabel.querySelector(".codexdian-yolo-state");
    if (yoloStateEl) {
      yoloStateEl.textContent = formatYoloStateLabel(isYolo);
    }

    const toggleEl = yoloControl.createDiv({
      cls: `codexdian-toggle-switch ${isYolo ? "active" : ""}`,
    });

    const toggleAction = () => {
      this.plugin.settings.permissionMode =
        this.plugin.settings.permissionMode === "full-auto" ? "auto-edit" : "full-auto";
      void this.plugin.saveSettings();
      for (const tab of this.tabs) {
        tab.service?.updateSettings(this.plugin.settings);
      }
      this.renderStatusBar();
      this.queuePersistState();
    };

    yoloControl.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleAction();
    });
  }

  private showModelPicker(anchor: HTMLElement) {
    this.showStatusMenu(
      anchor,
      "选择模型",
      AVAILABLE_MODELS.map((model) => ({
        label: formatModelLabel(model),
        selected: model === this.plugin.settings.model,
        onSelect: () => {
          this.plugin.settings.model = model;
          for (const tab of this.tabs) {
            tab.conversation.model = model;
            tab.service?.updateSettings(this.plugin.settings);
          }
          void this.plugin.saveSettings();
          this.renderStatusBar();
          this.queuePersistState();
        },
      })),
    );
  }

  private showThinkingPicker(anchor: HTMLElement) {
    this.showStatusMenu(
      anchor,
      "选择推理功能",
      THINKING_LEVELS.map((level) => ({
        label: formatThinkingLevelLabel(level),
        selected: level === this.plugin.settings.thinkingLevel,
        iconText: "◌",
        onSelect: () => {
          this.plugin.settings.thinkingLevel = level;
          void this.plugin.saveSettings();
          for (const tab of this.tabs) {
            tab.service?.updateSettings(this.plugin.settings);
          }
          this.renderStatusBar();
          this.queuePersistState();
        },
      })),
    );
  }

  private startTimer() {
    this.startTime = Date.now();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const timerEl = this.statusBarEl?.querySelector(".codexdian-timer");
      if (timerEl) {
        timerEl.textContent = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const timerEl = this.statusBarEl?.querySelector(".codexdian-timer");
    if (timerEl) {
      timerEl.textContent = "0s";
    }
  }

  private updateStatusStreaming(streaming: boolean) {
    if (streaming) {
      this.statusBarEl?.addClass("codexdian-streaming");
    } else {
      this.statusBarEl?.removeClass("codexdian-streaming");
    }
  }
}

class CodexdianSettingTab extends PluginSettingTab {
  plugin: CodexdianPlugin;

  constructor(app: App, plugin: CodexdianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Codexdian Settings" });

    new Setting(containerEl)
      .setName("Codex CLI path")
      .setDesc('Custom path or command for Codex CLI. Leave empty to auto-detect "codex" from PATH.')
      .addText((text) =>
        text
          .setPlaceholder("codex")
          .setValue(this.plugin.settings.codexCliPath)
          .onChange(async (value) => {
            this.plugin.settings.codexCliPath = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default model")
      .setDesc("Model for new conversations.")
      .addDropdown((dropdown) => {
        for (const model of AVAILABLE_MODELS) {
          dropdown.addOption(model, model);
        }
        dropdown.setValue(this.plugin.settings.model);
        dropdown.onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Thinking level")
      .setDesc("Reasoning effort.")
      .addDropdown((dropdown) => {
        for (const level of THINKING_LEVELS) {
          dropdown.addOption(level, level.charAt(0).toUpperCase() + level.slice(1));
        }
        dropdown.setValue(this.plugin.settings.thinkingLevel);
        dropdown.onChange(async (value) => {
          this.plugin.settings.thinkingLevel = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Permission mode")
      .setDesc("Controls auto-approval of actions.")
      .addDropdown((dropdown) => {
        for (const mode of PERMISSION_MODES) {
          dropdown.addOption(mode.value, mode.label);
        }
        dropdown.setValue(this.plugin.settings.permissionMode);
        dropdown.onChange(async (value: CodexdianSettings["permissionMode"]) => {
          this.plugin.settings.permissionMode = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Maximum tabs")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxTabs)).onChange(async (value) => {
          const maxTabs = Number.parseInt(value, 10);
          if (!Number.isNaN(maxTabs) && maxTabs >= 1 && maxTabs <= 10) {
            this.plugin.settings.maxTabs = maxTabs;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName("System prompt")
      .setDesc("Additional instructions injected at the start of a conversation.")
      .addTextArea((textArea) =>
        textArea
          .setPlaceholder("Extra instructions...")
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Response locale")
      .setDesc('Preferred reply locale, for example "en" or "zh-CN".')
      .addText((text) =>
        text
          .setPlaceholder("en")
          .setValue(this.plugin.settings.locale)
          .onChange(async (value) => {
            this.plugin.settings.locale = value.trim() || DEFAULT_SETTINGS.locale;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Environment variables")
      .setDesc("KEY=VALUE per line.")
      .addTextArea((textArea) =>
        textArea
          .setPlaceholder("OPENAI_API_KEY=sk-...")
          .setValue(this.plugin.settings.environmentVariables)
          .onChange(async (value) => {
            this.plugin.settings.environmentVariables = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto scroll")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableAutoScroll).onChange(async (value) => {
          this.plugin.settings.enableAutoScroll = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}

export default class CodexdianPlugin extends Plugin {
  settings: CodexdianSettings = { ...DEFAULT_SETTINGS };
  private pluginData: CodexdianData = createDefaultData();
  private currentReferenceFilePath: string | null = null;

  async onload() {
    await this.loadSettings();

    this.app.workspace.onLayoutReady(() => {
      const file = this.resolveReferenceFile();
      this.currentReferenceFilePath = file?.path ?? this.currentReferenceFilePath;
    });

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          this.currentReferenceFilePath = file.path;
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const view = leaf?.view;
        if (view instanceof MarkdownView && view.file) {
          this.currentReferenceFilePath = view.file.path;
        }
      }),
    );

    this.registerView(VIEW_TYPE_CODEXDIAN, (leaf) => new CodexdianView(leaf, this));

    this.addRibbonIcon("code-2", "Open Codexdian", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-view",
      name: "Open chat view",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "new-tab",
      name: "New tab",
      callback: () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CODEXDIAN)[0];
        (leaf?.view as CodexdianView | undefined)?.createTab?.();
      },
    });

    this.addCommand({
      id: "new-session",
      name: "New session (in current tab)",
      callback: () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CODEXDIAN)[0];
        (leaf?.view as CodexdianView | undefined)?.newSession?.();
      },
    });

    this.addSettingTab(new CodexdianSettingTab(this.app, this));
  }

  async activateView() {
    const workspace = this.app.workspace;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CODEXDIAN)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: VIEW_TYPE_CODEXDIAN, active: true });
        leaf = rightLeaf;
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  getWorkspaceState(): WorkspaceState {
    return cloneJson(this.pluginData.workspaceState);
  }

  getCurrentReferenceFile(): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.currentReferenceFilePath = activeFile.path;
      return activeFile;
    }

    if (this.currentReferenceFilePath) {
      const remembered = this.app.vault.getAbstractFileByPath(this.currentReferenceFilePath);
      if (remembered instanceof TFile) {
        return remembered;
      }
      this.currentReferenceFilePath = null;
    }

    const fallback = this.resolveReferenceFile();
    if (fallback) {
      this.currentReferenceFilePath = fallback.path;
    }
    return fallback;
  }

  async saveWorkspaceState(workspaceState: WorkspaceState) {
    this.pluginData.workspaceState = cloneJson(workspaceState);
    this.pluginData.tabManagerState = {
      openTabs: workspaceState.tabs.map((tab) => ({
        tabId: tab.tabId,
        conversationId: tab.conversation.id,
      })),
      activeTabId: workspaceState.activeTabId,
    };
    await this.savePluginData();
  }

  async loadSettings() {
    const rawData = ((await this.loadData()) as Partial<CodexdianData> | null) || null;
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...(rawData?.settings || {}),
    };

    this.settings = mergedSettings;
    this.pluginData = {
      ...createDefaultData(),
      ...rawData,
      settings: mergedSettings,
      workspaceState: normalizeWorkspaceState(rawData, mergedSettings.model),
    };
    this.pluginData.tabManagerState = {
      openTabs: this.pluginData.workspaceState.tabs.map((tab) => ({
        tabId: tab.tabId,
        conversationId: tab.conversation.id,
      })),
      activeTabId: this.pluginData.workspaceState.activeTabId,
    };
  }

  async saveSettings() {
    this.pluginData.settings = { ...this.settings };
    await this.savePluginData();
  }

  private resolveReferenceFile(): TFile | null {
    const recentLeaf = this.app.workspace.getMostRecentLeaf();
    if (recentLeaf?.view instanceof MarkdownView && recentLeaf.view.file) {
      return recentLeaf.view.file;
    }

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.file) {
        return leaf.view.file;
      }
    }

    return null;
  }

  private async savePluginData() {
    await this.saveData(this.pluginData);
  }
}
