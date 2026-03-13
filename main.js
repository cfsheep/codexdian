var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CodexdianPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// node_modules/@openai/codex-sdk/dist/index.js
var import_fs = require("fs");
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_path2 = __toESM(require("path"), 1);
var import_readline = __toESM(require("readline"), 1);
var import_module = require("module");
var import_meta = { url: typeof __filename !== "undefined" ? require("url").pathToFileURL(__filename).href : "file:///dummy" };
async function createOutputSchemaFile(schema) {
  if (schema === void 0) {
    return { cleanup: async () => {
    } };
  }
  if (!isJsonObject(schema)) {
    throw new Error("outputSchema must be a plain JSON object");
  }
  const schemaDir = await import_fs.promises.mkdtemp(import_path.default.join(import_os.default.tmpdir(), "codex-output-schema-"));
  const schemaPath = import_path.default.join(schemaDir, "schema.json");
  const cleanup = async () => {
    try {
      await import_fs.promises.rm(schemaDir, { recursive: true, force: true });
    } catch {
    }
  };
  try {
    await import_fs.promises.writeFile(schemaPath, JSON.stringify(schema), "utf8");
    return { schemaPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var Thread = class {
  _exec;
  _options;
  _id;
  _threadOptions;
  /** Returns the ID of the thread. Populated after the first turn starts. */
  get id() {
    return this._id;
  }
  /* @internal */
  constructor(exec, options, threadOptions, id = null) {
    this._exec = exec;
    this._options = options;
    this._id = id;
    this._threadOptions = threadOptions;
  }
  /** Provides the input to the agent and streams events as they are produced during the turn. */
  async runStreamed(input, turnOptions = {}) {
    return { events: this.runStreamedInternal(input, turnOptions) };
  }
  async *runStreamedInternal(input, turnOptions = {}) {
    const { schemaPath, cleanup } = await createOutputSchemaFile(turnOptions.outputSchema);
    const options = this._threadOptions;
    const { prompt, images } = normalizeInput(input);
    const generator = this._exec.run({
      input: prompt,
      baseUrl: this._options.baseUrl,
      apiKey: this._options.apiKey,
      threadId: this._id,
      images,
      model: options?.model,
      sandboxMode: options?.sandboxMode,
      workingDirectory: options?.workingDirectory,
      skipGitRepoCheck: options?.skipGitRepoCheck,
      outputSchemaFile: schemaPath,
      modelReasoningEffort: options?.modelReasoningEffort,
      signal: turnOptions.signal,
      networkAccessEnabled: options?.networkAccessEnabled,
      webSearchMode: options?.webSearchMode,
      webSearchEnabled: options?.webSearchEnabled,
      approvalPolicy: options?.approvalPolicy,
      additionalDirectories: options?.additionalDirectories
    });
    try {
      for await (const item of generator) {
        let parsed;
        try {
          parsed = JSON.parse(item);
        } catch (error) {
          throw new Error(`Failed to parse item: ${item}`, { cause: error });
        }
        if (parsed.type === "thread.started") {
          this._id = parsed.thread_id;
        }
        yield parsed;
      }
    } finally {
      await cleanup();
    }
  }
  /** Provides the input to the agent and returns the completed turn. */
  async run(input, turnOptions = {}) {
    const generator = this.runStreamedInternal(input, turnOptions);
    const items = [];
    let finalResponse = "";
    let usage = null;
    let turnFailure = null;
    for await (const event of generator) {
      if (event.type === "item.completed") {
        if (event.item.type === "agent_message") {
          finalResponse = event.item.text;
        }
        items.push(event.item);
      } else if (event.type === "turn.completed") {
        usage = event.usage;
      } else if (event.type === "turn.failed") {
        turnFailure = event.error;
        break;
      }
    }
    if (turnFailure) {
      throw new Error(turnFailure.message);
    }
    return { items, finalResponse, usage };
  }
};
function normalizeInput(input) {
  if (typeof input === "string") {
    return { prompt: input, images: [] };
  }
  const promptParts = [];
  const images = [];
  for (const item of input) {
    if (item.type === "text") {
      promptParts.push(item.text);
    } else if (item.type === "local_image") {
      images.push(item.path);
    }
  }
  return { prompt: promptParts.join("\n\n"), images };
}
var INTERNAL_ORIGINATOR_ENV = "CODEX_INTERNAL_ORIGINATOR_OVERRIDE";
var TYPESCRIPT_SDK_ORIGINATOR = "codex_sdk_ts";
var CODEX_NPM_NAME = "@openai/codex";
var PLATFORM_PACKAGE_BY_TARGET = {
  "x86_64-unknown-linux-musl": "@openai/codex-linux-x64",
  "aarch64-unknown-linux-musl": "@openai/codex-linux-arm64",
  "x86_64-apple-darwin": "@openai/codex-darwin-x64",
  "aarch64-apple-darwin": "@openai/codex-darwin-arm64",
  "x86_64-pc-windows-msvc": "@openai/codex-win32-x64",
  "aarch64-pc-windows-msvc": "@openai/codex-win32-arm64"
};
var moduleRequire = (0, import_module.createRequire)(import_meta.url);
var CodexExec = class {
  executablePath;
  envOverride;
  configOverrides;
  constructor(executablePath = null, env, configOverrides) {
    this.executablePath = executablePath || findCodexPath();
    this.envOverride = env;
    this.configOverrides = configOverrides;
  }
  async *run(args) {
    const commandArgs = ["exec", "--experimental-json"];
    if (this.configOverrides) {
      for (const override of serializeConfigOverrides(this.configOverrides)) {
        commandArgs.push("--config", override);
      }
    }
    if (args.model) {
      commandArgs.push("--model", args.model);
    }
    if (args.sandboxMode) {
      commandArgs.push("--sandbox", args.sandboxMode);
    }
    if (args.workingDirectory) {
      commandArgs.push("--cd", args.workingDirectory);
    }
    if (args.additionalDirectories?.length) {
      for (const dir of args.additionalDirectories) {
        commandArgs.push("--add-dir", dir);
      }
    }
    if (args.skipGitRepoCheck) {
      commandArgs.push("--skip-git-repo-check");
    }
    if (args.outputSchemaFile) {
      commandArgs.push("--output-schema", args.outputSchemaFile);
    }
    if (args.modelReasoningEffort) {
      commandArgs.push("--config", `model_reasoning_effort="${args.modelReasoningEffort}"`);
    }
    if (args.networkAccessEnabled !== void 0) {
      commandArgs.push(
        "--config",
        `sandbox_workspace_write.network_access=${args.networkAccessEnabled}`
      );
    }
    if (args.webSearchMode) {
      commandArgs.push("--config", `web_search="${args.webSearchMode}"`);
    } else if (args.webSearchEnabled === true) {
      commandArgs.push("--config", `web_search="live"`);
    } else if (args.webSearchEnabled === false) {
      commandArgs.push("--config", `web_search="disabled"`);
    }
    if (args.approvalPolicy) {
      commandArgs.push("--config", `approval_policy="${args.approvalPolicy}"`);
    }
    if (args.threadId) {
      commandArgs.push("resume", args.threadId);
    }
    if (args.images?.length) {
      for (const image of args.images) {
        commandArgs.push("--image", image);
      }
    }
    const env = {};
    if (this.envOverride) {
      Object.assign(env, this.envOverride);
    } else {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== void 0) {
          env[key] = value;
        }
      }
    }
    if (!env[INTERNAL_ORIGINATOR_ENV]) {
      env[INTERNAL_ORIGINATOR_ENV] = TYPESCRIPT_SDK_ORIGINATOR;
    }
    if (args.baseUrl) {
      env.OPENAI_BASE_URL = args.baseUrl;
    }
    if (args.apiKey) {
      env.CODEX_API_KEY = args.apiKey;
    }
    const child = (0, import_child_process.spawn)(this.executablePath, commandArgs, {
      env,
      signal: args.signal
    });
    let spawnError = null;
    child.once("error", (err) => spawnError = err);
    if (!child.stdin) {
      child.kill();
      throw new Error("Child process has no stdin");
    }
    child.stdin.write(args.input);
    child.stdin.end();
    if (!child.stdout) {
      child.kill();
      throw new Error("Child process has no stdout");
    }
    const stderrChunks = [];
    if (child.stderr) {
      child.stderr.on("data", (data) => {
        stderrChunks.push(data);
      });
    }
    const exitPromise = new Promise(
      (resolve) => {
        child.once("exit", (code, signal) => {
          resolve({ code, signal });
        });
      }
    );
    const rl = import_readline.default.createInterface({
      input: child.stdout,
      crlfDelay: Infinity
    });
    try {
      for await (const line of rl) {
        yield line;
      }
      if (spawnError) throw spawnError;
      const { code, signal } = await exitPromise;
      if (code !== 0 || signal) {
        const stderrBuffer = Buffer.concat(stderrChunks);
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        throw new Error(`Codex Exec exited with ${detail}: ${stderrBuffer.toString("utf8")}`);
      }
    } finally {
      rl.close();
      child.removeAllListeners();
      try {
        if (!child.killed) child.kill();
      } catch {
      }
    }
  }
};
function serializeConfigOverrides(configOverrides) {
  const overrides = [];
  flattenConfigOverrides(configOverrides, "", overrides);
  return overrides;
}
function flattenConfigOverrides(value, prefix, overrides) {
  if (!isPlainObject(value)) {
    if (prefix) {
      overrides.push(`${prefix}=${toTomlValue(value, prefix)}`);
      return;
    } else {
      throw new Error("Codex config overrides must be a plain object");
    }
  }
  const entries = Object.entries(value);
  if (!prefix && entries.length === 0) {
    return;
  }
  if (prefix && entries.length === 0) {
    overrides.push(`${prefix}={}`);
    return;
  }
  for (const [key, child] of entries) {
    if (!key) {
      throw new Error("Codex config override keys must be non-empty strings");
    }
    if (child === void 0) {
      continue;
    }
    const path3 = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) {
      flattenConfigOverrides(child, path3, overrides);
    } else {
      overrides.push(`${path3}=${toTomlValue(child, path3)}`);
    }
  }
}
function toTomlValue(value, path3) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  } else if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Codex config override at ${path3} must be a finite number`);
    }
    return `${value}`;
  } else if (typeof value === "boolean") {
    return value ? "true" : "false";
  } else if (Array.isArray(value)) {
    const rendered = value.map((item, index) => toTomlValue(item, `${path3}[${index}]`));
    return `[${rendered.join(", ")}]`;
  } else if (isPlainObject(value)) {
    const parts = [];
    for (const [key, child] of Object.entries(value)) {
      if (!key) {
        throw new Error("Codex config override keys must be non-empty strings");
      }
      if (child === void 0) {
        continue;
      }
      parts.push(`${formatTomlKey(key)} = ${toTomlValue(child, `${path3}.${key}`)}`);
    }
    return `{${parts.join(", ")}}`;
  } else if (value === null) {
    throw new Error(`Codex config override at ${path3} cannot be null`);
  } else {
    const typeName = typeof value;
    throw new Error(`Unsupported Codex config override value at ${path3}: ${typeName}`);
  }
}
var TOML_BARE_KEY = /^[A-Za-z0-9_-]+$/;
function formatTomlKey(key) {
  return TOML_BARE_KEY.test(key) ? key : JSON.stringify(key);
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function findCodexPath() {
  const { platform, arch } = process;
  let targetTriple = null;
  switch (platform) {
    case "linux":
    case "android":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-unknown-linux-musl";
          break;
        case "arm64":
          targetTriple = "aarch64-unknown-linux-musl";
          break;
        default:
          break;
      }
      break;
    case "darwin":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-apple-darwin";
          break;
        case "arm64":
          targetTriple = "aarch64-apple-darwin";
          break;
        default:
          break;
      }
      break;
    case "win32":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-pc-windows-msvc";
          break;
        case "arm64":
          targetTriple = "aarch64-pc-windows-msvc";
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }
  if (!targetTriple) {
    throw new Error(`Unsupported platform: ${platform} (${arch})`);
  }
  const platformPackage = PLATFORM_PACKAGE_BY_TARGET[targetTriple];
  if (!platformPackage) {
    throw new Error(`Unsupported target triple: ${targetTriple}`);
  }
  let vendorRoot;
  try {
    const codexPackageJsonPath = moduleRequire.resolve(`${CODEX_NPM_NAME}/package.json`);
    const codexRequire = (0, import_module.createRequire)(codexPackageJsonPath);
    const platformPackageJsonPath = codexRequire.resolve(`${platformPackage}/package.json`);
    vendorRoot = import_path2.default.join(import_path2.default.dirname(platformPackageJsonPath), "vendor");
  } catch {
    throw new Error(
      `Unable to locate Codex CLI binaries. Ensure ${CODEX_NPM_NAME} is installed with optional dependencies.`
    );
  }
  const archRoot = import_path2.default.join(vendorRoot, targetTriple);
  const codexBinaryName = process.platform === "win32" ? "codex.exe" : "codex";
  const binaryPath = import_path2.default.join(archRoot, "codex", codexBinaryName);
  return binaryPath;
}
var Codex = class {
  exec;
  options;
  constructor(options = {}) {
    const { codexPathOverride, env, config } = options;
    this.exec = new CodexExec(codexPathOverride, env, config);
    this.options = options;
  }
  /**
   * Starts a new conversation with an agent.
   * @returns A new thread instance.
   */
  startThread(options = {}) {
    return new Thread(this.exec, this.options, options);
  }
  /**
   * Resumes a conversation with an agent based on the thread id.
   * Threads are persisted in ~/.codex/sessions.
   *
   * @param id The id of the thread to resume.
   * @returns A new thread instance.
   */
  resumeThread(id, options = {}) {
    return new Thread(this.exec, this.options, options, id);
  }
};

// src/service.ts
function parseEnvVars(text) {
  const env = {};
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
function mapReasoningEffort(level) {
  const map = {
    off: "minimal",
    low: "low",
    medium: "medium",
    high: "high"
  };
  return map[level];
}
function mapApprovalPolicy(mode) {
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
function buildInstructionBlock(settings) {
  const lines = [];
  const locale = settings.locale.trim();
  const systemPrompt = settings.systemPrompt.trim();
  if (locale) {
    lines.push(`Respond using locale "${locale}" unless the user explicitly asks for another language.`);
  }
  lines.push(
    "If a prompt includes <current_note>path</current_note>, treat that file as the default reference document for the conversation and read it when relevant."
  );
  if (systemPrompt) {
    lines.push(systemPrompt);
  }
  if (lines.length === 0) {
    return "";
  }
  return ["<codexdian_instructions>", ...lines, "</codexdian_instructions>"].join("\n");
}
var CodexService = class {
  codex = null;
  thread = null;
  vaultPath;
  settings;
  _isStreaming = false;
  abortController = null;
  threadId = null;
  instructionsInjected = false;
  constructor(vaultPath, settings) {
    this.vaultPath = vaultPath;
    this.settings = settings;
    this.initCodex();
  }
  get isStreaming() {
    return this._isStreaming;
  }
  get currentThreadId() {
    return this.threadId;
  }
  updateSettings(settings) {
    this.settings = settings;
    this.initCodex();
  }
  initCodex() {
    const customEnv = parseEnvVars(this.settings.environmentVariables);
    const options = {};
    if (this.settings.codexCliPath) {
      options.codexPathOverride = this.settings.codexCliPath;
    }
    if (Object.keys(customEnv).length > 0) {
      options.env = {
        ...process.env,
        ...customEnv
      };
    }
    this.codex = new Codex(options);
    this.thread = null;
    this.threadId = null;
    this.instructionsInjected = false;
  }
  /** Build thread options from current settings. */
  buildThreadOptions() {
    const opts = {
      model: this.settings.model,
      workingDirectory: this.vaultPath,
      skipGitRepoCheck: true,
      approvalPolicy: mapApprovalPolicy(this.settings.permissionMode)
    };
    const effort = mapReasoningEffort(this.settings.thinkingLevel);
    if (effort) {
      opts.modelReasoningEffort = effort;
    }
    return opts;
  }
  /** Ensure we have an active thread, creating one if needed. */
  ensureThread() {
    if (!this.codex) {
      this.initCodex();
    }
    if (!this.thread) {
      this.thread = this.codex.startThread(this.buildThreadOptions());
    }
    return this.thread;
  }
  preparePrompt(prompt) {
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
    return `${instructionBlock}

${trimmedPrompt}`;
  }
  /** Start a new conversation (reset the thread). */
  newConversation() {
    this.thread = null;
    this.threadId = null;
    this.instructionsInjected = false;
  }
  /** Resume a thread by ID. */
  resumeThread(threadId) {
    if (!this.codex) this.initCodex();
    this.thread = this.codex.resumeThread(threadId, this.buildThreadOptions());
    this.threadId = threadId;
    this.instructionsInjected = true;
  }
  /** Send a user message and stream back events. */
  async query(prompt, onEvent) {
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
        signal: this.abortController.signal
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
    } catch (err) {
      if (err?.name !== "AbortError") {
        onEvent({
          type: "error",
          error: err?.message || String(err)
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
};

// src/types.ts
var DEFAULT_SETTINGS = {
  codexCliPath: "",
  model: "gpt-5.4",
  thinkingLevel: "medium",
  permissionMode: "full-auto",
  systemPrompt: "",
  maxTabs: 3,
  environmentVariables: "",
  enableAutoScroll: true,
  locale: "en"
};
var AVAILABLE_MODELS = [
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.3",
  "o4-mini",
  "o3",
  "codex-mini"
];
var THINKING_LEVELS = ["off", "low", "medium", "high"];
var PERMISSION_MODES = [
  { value: "suggest", label: "Suggest - read-only, no writes" },
  { value: "auto-edit", label: "Auto Edit - file edits auto-approved" },
  { value: "full-auto", label: "Full Auto - all actions auto-approved (YOLO)" }
];

// src/main.ts
var VIEW_TYPE_CODEXDIAN = "codexdian-view";
function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function createDefaultWorkspaceState() {
  return { tabs: [], activeTabId: "" };
}
function createDefaultData() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    workspaceState: createDefaultWorkspaceState(),
    tabManagerState: { openTabs: [], activeTabId: "" }
  };
}
function createConversation(model, referenceFilePath = null) {
  return {
    id: genId("conv"),
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
    model,
    referenceFilePath,
    referenceRemoved: false
  };
}
function normalizeConversation(conversation, model) {
  return {
    id: conversation?.id || genId("conv"),
    title: conversation?.title || "New chat",
    messages: Array.isArray(conversation?.messages) ? conversation.messages : [],
    createdAt: conversation?.createdAt || Date.now(),
    model: conversation?.model || model,
    referenceFilePath: conversation?.referenceFilePath ?? null,
    referenceRemoved: conversation?.referenceRemoved ?? false,
    sessionId: conversation?.sessionId
  };
}
function normalizeWorkspaceState(data, model) {
  const tabs = Array.isArray(data?.workspaceState?.tabs) ? data.workspaceState.tabs.filter((tab) => Boolean(tab?.tabId && tab?.conversation)).map((tab) => ({
    tabId: tab.tabId,
    conversation: normalizeConversation(tab.conversation, model)
  })) : [];
  const restoredActiveTabId = data?.workspaceState?.activeTabId;
  const activeTabId = restoredActiveTabId && tabs.some((tab) => tab.tabId === restoredActiveTabId) ? restoredActiveTabId : tabs[0]?.tabId || "";
  return { tabs, activeTabId };
}
var CODEX_LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
var THINKING_LEVEL_LABELS = {
  off: "\u4F4E",
  low: "\u4E2D",
  medium: "\u9AD8",
  high: "\u8D85\u9AD8"
};
var THINKING_LEVEL_LABELS_SAFE = {
  off: "\u5173\u95ED",
  low: "\u4F4E",
  medium: "\u4E2D",
  high: "\u9AD8"
};
function formatModelLabel(model) {
  return model.replace(/^gpt-/i, "GPT-").replace(/-codex/gi, "-Codex").replace(/-mini/gi, "-Mini").replace(/-max/gi, "-Max");
}
function formatThinkingLevelLabel(level) {
  return THINKING_LEVEL_LABELS_SAFE[level] || THINKING_LEVEL_LABELS[level] || level;
}
function formatYoloStateLabel(enabled) {
  return enabled ? "\u5F00" : "\u5173";
}
function formatCurrentReference(notePath) {
  return `<current_note>
${notePath}
</current_note>`;
}
function appendCurrentReference(prompt, notePath) {
  return `${prompt}

${formatCurrentReference(notePath)}`;
}
function renderThreadItem(item, containerEl, app, component) {
  switch (item.type) {
    case "agent_message": {
      const msg = item;
      const contentEl = containerEl.createDiv({ cls: "codexdian-message-content" });
      void import_obsidian.MarkdownRenderer.render(app, msg.text, contentEl, "", component);
      break;
    }
    case "reasoning": {
      const msg = item;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-thinking" });
      const label = el.createDiv({ cls: "codexdian-thinking-label" });
      label.createSpan({ text: "Thinking", cls: "codexdian-thinking-text" });
      const body = el.createDiv({ cls: "codexdian-thinking-content" });
      body.textContent = msg.text;
      break;
    }
    case "command_execution": {
      const cmd = item;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      (0, import_obsidian.setIcon)(iconSpan, "terminal");
      header.createSpan({ text: ` ${cmd.command}` });
      header.createSpan({
        cls: `codexdian-status-badge codexdian-status-${cmd.status}`,
        text: cmd.status
      });
      if (cmd.aggregated_output) {
        const outputBlock = el.createEl("pre", { cls: "codexdian-tool-output" });
        outputBlock.createEl("code", { text: cmd.aggregated_output });
      }
      if (cmd.exit_code !== void 0 && cmd.exit_code !== 0) {
        el.createDiv({ cls: "codexdian-exit-code", text: `Exit code: ${cmd.exit_code}` });
      }
      break;
    }
    case "file_change": {
      const fc = item;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      (0, import_obsidian.setIcon)(iconSpan, "file-edit");
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
      const mcp = item;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call codexdian-mcp-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      (0, import_obsidian.setIcon)(iconSpan, "puzzle");
      header.createSpan({ text: ` ${mcp.server}/${mcp.tool}` });
      if (mcp.arguments) {
        const inputBlock = el.createEl("pre", { cls: "codexdian-tool-input" });
        inputBlock.createEl("code", {
          text: typeof mcp.arguments === "string" ? mcp.arguments : JSON.stringify(mcp.arguments, null, 2)
        });
      }
      if (mcp.error) {
        el.createDiv({ cls: "codexdian-error-text", text: mcp.error.message });
      }
      break;
    }
    case "todo_list": {
      const todo = item;
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
      const err = item;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-error-msg" });
      el.createSpan({ text: `Error: ${err.message}` });
      break;
    }
    case "web_search": {
      const ws = item;
      const el = containerEl.createDiv({ cls: "codexdian-message-content codexdian-tool-call" });
      const header = el.createDiv({ cls: "codexdian-tool-header" });
      const iconSpan = header.createSpan();
      (0, import_obsidian.setIcon)(iconSpan, "search");
      header.createSpan({ text: ` Web search: ${ws.query || ""}` });
      break;
    }
  }
}
var CodexdianView = class extends import_obsidian.ItemView {
  plugin;
  messagesEl = null;
  inputEl = null;
  statusBarEl = null;
  tabBarEl = null;
  contextRowEl = null;
  referenceDocEl = null;
  persistTimer = null;
  tabs = [];
  activeTabId = "";
  startTime = 0;
  timerInterval = null;
  statusMenuEl = null;
  statusMenuAnchorEl = null;
  statusMenuCloseHandler = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CODEXDIAN;
  }
  getDisplayText() {
    return "Codexdian";
  }
  getIcon() {
    return "code-2";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
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
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.refreshReferenceDoc(leaf?.view instanceof import_obsidian.MarkdownView);
      })
    );
    const actions = header.createDiv({ cls: "codexdian-header-actions" });
    const newTabBtn = actions.createDiv({ cls: "codexdian-header-btn codexdian-new-tab-btn" });
    (0, import_obsidian.setIcon)(newTabBtn, "plus");
    newTabBtn.title = "New tab";
    newTabBtn.addEventListener("click", () => this.createTab());
    const newSessionBtn = actions.createDiv({ cls: "codexdian-header-btn" });
    (0, import_obsidian.setIcon)(newSessionBtn, "rotate-ccw");
    newSessionBtn.title = "New session";
    newSessionBtn.addEventListener("click", () => this.newSession());
    const settingsBtn = actions.createDiv({ cls: "codexdian-header-btn" });
    (0, import_obsidian.setIcon)(settingsBtn, "settings");
    settingsBtn.title = "Settings";
    settingsBtn.addEventListener("click", () => {
      this.app.setting.open();
      this.app.setting.openTabById("codexdian");
    });
    this.messagesEl = container.createDiv({ cls: "codexdian-messages" });
    const inputArea = container.createDiv({ cls: "codexdian-input-area" });
    this.contextRowEl = inputArea.createDiv({ cls: "codexdian-context-row" });
    this.referenceDocEl = this.contextRowEl.createDiv({ cls: "codexdian-reference-doc" });
    this.renderReferenceDoc();
    const inputRow = inputArea.createDiv({ cls: "codexdian-input-row" });
    this.inputEl = inputRow.createEl("textarea", {
      cls: "codexdian-input",
      attr: { placeholder: "Ask Codex anything...", rows: "1" }
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
    (0, import_obsidian.setIcon)(sendBtn, "send");
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
  getVaultPath() {
    return this.app.vault.adapter.basePath || "";
  }
  getReferenceFile() {
    const tab = this.getActiveTab();
    const referencePath = tab?.conversation.referenceRemoved ? null : tab?.conversation.referenceFilePath ?? null;
    if (referencePath) {
      const file = this.app.vault.getAbstractFileByPath(referencePath);
      if (file instanceof import_obsidian.TFile) {
        return file;
      }
    }
    return tab ? null : this.plugin.getCurrentReferenceFile();
  }
  refreshReferenceDoc(allowReattach = false) {
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
  clearReferenceDoc() {
    const tab = this.getActiveTab();
    if (!tab) return;
    tab.conversation.referenceFilePath = null;
    tab.conversation.referenceRemoved = true;
    this.renderReferenceDoc();
    this.queuePersistState();
  }
  renderReferenceDoc() {
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
    (0, import_obsidian.setIcon)(iconEl, "file-text");
    const bodyEl = this.referenceDocEl.createDiv({ cls: "codexdian-reference-doc-body" });
    bodyEl.createSpan({
      cls: "codexdian-reference-doc-label",
      text: "\u5F53\u524D\u53C2\u8003\u6587\u6863"
    });
    bodyEl.createSpan({
      cls: "codexdian-reference-doc-value",
      text: file.basename
    });
    const removeBtn = this.referenceDocEl.createEl("button", {
      cls: "codexdian-reference-doc-remove",
      attr: {
        type: "button",
        "aria-label": "Remove reference document from this conversation"
      }
    });
    (0, import_obsidian.setIcon)(removeBtn, "x");
    removeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearReferenceDoc();
    });
  }
  buildService(conversation) {
    const service = new CodexService(this.getVaultPath(), this.plugin.settings);
    if (conversation.sessionId) {
      try {
        service.resumeThread(conversation.sessionId);
      } catch (error) {
        console.error("Codexdian: failed to resume conversation", error);
        conversation.sessionId = void 0;
      }
    }
    return service;
  }
  async restoreTabs() {
    const workspaceState = this.plugin.getWorkspaceState();
    if (workspaceState.tabs.length === 0) {
      return false;
    }
    this.tabs = workspaceState.tabs.slice(0, this.plugin.settings.maxTabs).map((tab) => {
      const conversation = normalizeConversation(tab.conversation, this.plugin.settings.model);
      return {
        tabId: tab.tabId,
        conversation,
        service: null
      };
    });
    this.activeTabId = workspaceState.activeTabId && this.tabs.some((tab) => tab.tabId === workspaceState.activeTabId) ? workspaceState.activeTabId : this.tabs[0]?.tabId || "";
    return this.tabs.length > 0;
  }
  serializeTabs() {
    return this.tabs.map((tab) => ({
      tabId: tab.tabId,
      conversation: cloneJson(tab.conversation)
    }));
  }
  queuePersistState() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.plugin.saveWorkspaceState({
        tabs: this.serializeTabs(),
        activeTabId: this.activeTabId
      });
    }, 150);
  }
  flushPersistState() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    void this.plugin.saveWorkspaceState({
      tabs: this.serializeTabs(),
      activeTabId: this.activeTabId
    });
  }
  createTab() {
    if (this.tabs.length >= this.plugin.settings.maxTabs) {
      new import_obsidian.Notice(`Maximum ${this.plugin.settings.maxTabs} tabs reached`);
      return;
    }
    const tabId = genId("tab");
    const conversation = createConversation(this.plugin.settings.model, this.plugin.getCurrentReferenceFile()?.path ?? null);
    this.tabs.push({ tabId, conversation, service: null });
    this.switchTab(tabId);
    this.queuePersistState();
  }
  switchTab(tabId) {
    this.activeTabId = tabId;
    this.refreshReferenceDoc();
    this.renderTabs();
    this.renderMessages();
    this.queuePersistState();
  }
  closeTab(tabId) {
    const tab = this.tabs.find((candidate) => candidate.tabId === tabId);
    if (!tab) return;
    if (tab.service?.isStreaming) {
      new import_obsidian.Notice("Cannot close a tab while it is streaming");
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
  getActiveTab() {
    return this.tabs.find((tab) => tab.tabId === this.activeTabId) || null;
  }
  ensureActiveTab() {
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
  ensureTabService(tab) {
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
          timestamp: Date.now()
        });
      }
      this.renderMessages();
      this.queuePersistState();
      new import_obsidian.Notice("Codexdian could not start Codex CLI. Check plugin settings.");
      return null;
    }
  }
  newSession() {
    const tab = this.ensureActiveTab();
    if (!tab) return;
    if (tab.service?.isStreaming) {
      new import_obsidian.Notice("Cannot start a new session while streaming");
      return;
    }
    tab.service?.destroy();
    tab.service = null;
    tab.conversation = createConversation(this.plugin.settings.model, this.plugin.getCurrentReferenceFile()?.path ?? null);
    this.refreshReferenceDoc();
    this.renderMessages();
    this.queuePersistState();
  }
  abortCurrent() {
    const tab = this.getActiveTab();
    if (tab?.service?.isStreaming) {
      tab.service.abort();
      new import_obsidian.Notice("Query aborted");
    }
  }
  renderTabs() {
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
  renderWelcome() {
    if (!this.messagesEl) return;
    this.messagesEl.empty();
    const welcome = this.messagesEl.createDiv({ cls: "codexdian-welcome" });
    const logoDiv = welcome.createDiv({ cls: "codexdian-welcome-logo" });
    logoDiv.innerHTML = CODEX_LOGO_SVG.replace('width="20" height="20"', 'width="48" height="48"');
    welcome.createEl("h3", { text: "Codexdian" });
    welcome.createEl("p", {
      text: "Your vault is Codex's workspace. Ask anything - it can read, write, search, and run commands.",
      cls: "codexdian-welcome-desc"
    });
    const quickActions = welcome.createDiv({ cls: "codexdian-quick-actions" });
    const suggestions = [
      "Summarize the current note",
      "Find all TODO items in the vault",
      "Create a new note from template"
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
  renderMessages() {
    if (!this.messagesEl) return;
    const tab = this.getActiveTab();
    if (!tab || tab.conversation.messages.length === 0) {
      this.renderWelcome();
      return;
    }
    this.messagesEl.empty();
    for (const msg of tab.conversation.messages) {
      const msgEl = this.messagesEl.createDiv({
        cls: `codexdian-message codexdian-message-${msg.role}`
      });
      if (msg.role === "user") {
        const avatar = msgEl.createDiv({ cls: "codexdian-avatar codexdian-avatar-user" });
        (0, import_obsidian.setIcon)(avatar, "user");
      } else if (msg.role === "assistant" || msg.role === "tool") {
        const avatar = msgEl.createDiv({ cls: "codexdian-avatar codexdian-avatar-assistant" });
        avatar.innerHTML = CODEX_LOGO_SVG.replace('width="20" height="20"', 'width="16" height="16"');
      }
      if (msg.role === "user") {
        const contentEl = msgEl.createDiv({ cls: "codexdian-message-content" });
        void import_obsidian.MarkdownRenderer.render(this.app, msg.content, contentEl, "", this);
      } else if (msg.threadItem) {
        renderThreadItem(msg.threadItem, msgEl, this.app, this);
      } else {
        const contentEl = msgEl.createDiv({ cls: "codexdian-message-content" });
        void import_obsidian.MarkdownRenderer.render(this.app, msg.content, contentEl, "", this);
      }
    }
    if (this.plugin.settings.enableAutoScroll) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }
  async sendMessage() {
    if (!this.inputEl) return;
    const text = this.inputEl.value.trim();
    if (!text) return;
    const tab = this.ensureActiveTab();
    if (!tab) {
      new import_obsidian.Notice("Codexdian could not create a chat tab.");
      return;
    }
    if (tab.service?.isStreaming) {
      new import_obsidian.Notice("Codexdian is still responding in this tab.");
      return;
    }
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";
    tab.conversation.messages.push({
      id: genId("msg"),
      role: "user",
      content: text,
      timestamp: Date.now()
    });
    this.renderMessages();
    this.queuePersistState();
    const service = this.ensureTabService(tab);
    if (!service) {
      return;
    }
    const promptToSend = !tab.conversation.referenceRemoved && tab.conversation.referenceFilePath ? appendCurrentReference(text, tab.conversation.referenceFilePath) : text;
    this.startTimer();
    this.updateStatusStreaming(true);
    this.renderTabs();
    const itemMap = /* @__PURE__ */ new Map();
    try {
      await service.query(promptToSend, (event) => {
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
              const msg = {
                id: genId("msg"),
                role: event.item.type === "reasoning" ? "assistant" : "tool",
                content: this.itemToText(event.item),
                timestamp: Date.now(),
                isThinking: event.item.type === "reasoning",
                threadItem: event.item
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
                  output: event.usage.output_tokens
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
              timestamp: Date.now()
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
          tab.conversation.title = firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? "..." : "");
        }
      }
    } catch (error) {
      console.error("Codexdian: failed to send message", error);
      tab.conversation.messages.push({
        id: genId("msg"),
        role: "system",
        content: `**Error:** ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    } finally {
      this.stopTimer();
      this.updateStatusStreaming(false);
      this.renderMessages();
      this.renderTabs();
      this.queuePersistState();
    }
  }
  itemToText(item) {
    switch (item.type) {
      case "agent_message":
        return item.text;
      case "reasoning":
        return item.text;
      case "command_execution": {
        const cmd = item;
        return `\`${cmd.command}\` -> ${cmd.status}`;
      }
      case "file_change": {
        const fc = item;
        return fc.changes.map((change) => `${change.kind}: ${change.path}`).join("\n");
      }
      case "error":
        return item.message;
      default:
        return "";
    }
  }
  closeStatusMenu() {
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
  showStatusMenu(anchor, title, options) {
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
        cls: `codexdian-status-menu-item ${option.selected ? "is-selected" : ""}`
      });
      const leading = item.createSpan({ cls: "codexdian-status-menu-leading", text: option.iconText || "" });
      if (!option.iconText) {
        leading.addClass("is-empty");
      }
      item.createSpan({ cls: "codexdian-status-menu-label", text: option.label });
      const check = item.createSpan({ cls: "codexdian-status-menu-check" });
      if (option.selected) {
        (0, import_obsidian.setIcon)(check, "check");
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
    this.statusMenuCloseHandler = (event) => {
      if (!menu.contains(event.target) && !anchor.contains(event.target)) {
        this.closeStatusMenu();
      }
    };
    setTimeout(() => {
      if (this.statusMenuCloseHandler) {
        document.addEventListener("click", this.statusMenuCloseHandler);
      }
    }, 0);
  }
  renderStatusBar() {
    if (!this.statusBarEl) return;
    this.closeStatusMenu();
    this.statusBarEl.empty();
    const modelBtn = this.statusBarEl.createDiv({ cls: "codexdian-status-picker codexdian-status-picker-model" });
    modelBtn.createSpan({ cls: "codexdian-status-picker-value", text: formatModelLabel(this.plugin.settings.model) });
    const modelChevron = modelBtn.createSpan({ cls: "codexdian-status-picker-chevron" });
    (0, import_obsidian.setIcon)(modelChevron, "chevron-down");
    modelBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showModelPicker(modelBtn);
    });
    const thinkingBtn = this.statusBarEl.createDiv({ cls: "codexdian-status-picker codexdian-status-picker-thinking" });
    thinkingBtn.createSpan({ cls: "codexdian-status-picker-label", text: "Thinking" });
    thinkingBtn.createSpan({
      cls: "codexdian-status-picker-value",
      text: formatThinkingLevelLabel(this.plugin.settings.thinkingLevel)
    });
    const thinkingChevron = thinkingBtn.createSpan({ cls: "codexdian-status-picker-chevron" });
    (0, import_obsidian.setIcon)(thinkingChevron, "chevron-down");
    thinkingBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showThinkingPicker(thinkingBtn);
    });
    this.statusBarEl.createDiv({ cls: "codexdian-status-spacer" });
    this.statusBarEl.createDiv({ cls: "codexdian-status-meta codexdian-timer", text: "0s" });
    const isYolo = this.plugin.settings.permissionMode === "full-auto";
    const yoloControl = this.statusBarEl.createDiv({
      cls: `codexdian-yolo-control ${isYolo ? "is-active" : "is-inactive"}`
    });
    const yoloLabel = yoloControl.createDiv({ cls: "codexdian-yolo-label" });
    yoloLabel.createSpan({ cls: "codexdian-yolo-text", text: "YOLO" });
    yoloLabel.createSpan({
      cls: `codexdian-yolo-state ${isYolo ? "is-on" : "is-off"}`,
      text: isYolo ? "\u5F00" : "\u5173"
    });
    const yoloStateEl = yoloLabel.querySelector(".codexdian-yolo-state");
    if (yoloStateEl) {
      yoloStateEl.textContent = formatYoloStateLabel(isYolo);
    }
    const toggleEl = yoloControl.createDiv({
      cls: `codexdian-toggle-switch ${isYolo ? "active" : ""}`
    });
    const toggleAction = () => {
      this.plugin.settings.permissionMode = this.plugin.settings.permissionMode === "full-auto" ? "auto-edit" : "full-auto";
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
  showModelPicker(anchor) {
    this.showStatusMenu(
      anchor,
      "\u9009\u62E9\u6A21\u578B",
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
        }
      }))
    );
  }
  showThinkingPicker(anchor) {
    this.showStatusMenu(
      anchor,
      "\u9009\u62E9\u63A8\u7406\u529F\u80FD",
      THINKING_LEVELS.map((level) => ({
        label: formatThinkingLevelLabel(level),
        selected: level === this.plugin.settings.thinkingLevel,
        iconText: "\u25CC",
        onSelect: () => {
          this.plugin.settings.thinkingLevel = level;
          void this.plugin.saveSettings();
          for (const tab of this.tabs) {
            tab.service?.updateSettings(this.plugin.settings);
          }
          this.renderStatusBar();
          this.queuePersistState();
        }
      }))
    );
  }
  startTimer() {
    this.startTime = Date.now();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1e3);
      const timerEl = this.statusBarEl?.querySelector(".codexdian-timer");
      if (timerEl) {
        timerEl.textContent = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;
      }
    }, 1e3);
  }
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const timerEl = this.statusBarEl?.querySelector(".codexdian-timer");
    if (timerEl) {
      timerEl.textContent = "0s";
    }
  }
  updateStatusStreaming(streaming) {
    if (streaming) {
      this.statusBarEl?.addClass("codexdian-streaming");
    } else {
      this.statusBarEl?.removeClass("codexdian-streaming");
    }
  }
};
var CodexdianSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Codexdian Settings" });
    new import_obsidian.Setting(containerEl).setName("Codex CLI path").setDesc("Custom path to the codex binary. Leave empty for auto-detection.").addText(
      (text) => text.setPlaceholder("auto-detect").setValue(this.plugin.settings.codexCliPath).onChange(async (value) => {
        this.plugin.settings.codexCliPath = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default model").setDesc("Model for new conversations.").addDropdown((dropdown) => {
      for (const model of AVAILABLE_MODELS) {
        dropdown.addOption(model, model);
      }
      dropdown.setValue(this.plugin.settings.model);
      dropdown.onChange(async (value) => {
        this.plugin.settings.model = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Thinking level").setDesc("Reasoning effort.").addDropdown((dropdown) => {
      for (const level of THINKING_LEVELS) {
        dropdown.addOption(level, level.charAt(0).toUpperCase() + level.slice(1));
      }
      dropdown.setValue(this.plugin.settings.thinkingLevel);
      dropdown.onChange(async (value) => {
        this.plugin.settings.thinkingLevel = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Permission mode").setDesc("Controls auto-approval of actions.").addDropdown((dropdown) => {
      for (const mode of PERMISSION_MODES) {
        dropdown.addOption(mode.value, mode.label);
      }
      dropdown.setValue(this.plugin.settings.permissionMode);
      dropdown.onChange(async (value) => {
        this.plugin.settings.permissionMode = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Maximum tabs").addText(
      (text) => text.setValue(String(this.plugin.settings.maxTabs)).onChange(async (value) => {
        const maxTabs = Number.parseInt(value, 10);
        if (!Number.isNaN(maxTabs) && maxTabs >= 1 && maxTabs <= 10) {
          this.plugin.settings.maxTabs = maxTabs;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("System prompt").setDesc("Additional instructions injected at the start of a conversation.").addTextArea(
      (textArea) => textArea.setPlaceholder("Extra instructions...").setValue(this.plugin.settings.systemPrompt).onChange(async (value) => {
        this.plugin.settings.systemPrompt = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Response locale").setDesc('Preferred reply locale, for example "en" or "zh-CN".').addText(
      (text) => text.setPlaceholder("en").setValue(this.plugin.settings.locale).onChange(async (value) => {
        this.plugin.settings.locale = value.trim() || DEFAULT_SETTINGS.locale;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Environment variables").setDesc("KEY=VALUE per line.").addTextArea(
      (textArea) => textArea.setPlaceholder("OPENAI_API_KEY=sk-...").setValue(this.plugin.settings.environmentVariables).onChange(async (value) => {
        this.plugin.settings.environmentVariables = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Auto scroll").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableAutoScroll).onChange(async (value) => {
        this.plugin.settings.enableAutoScroll = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
var CodexdianPlugin = class extends import_obsidian.Plugin {
  settings = { ...DEFAULT_SETTINGS };
  pluginData = createDefaultData();
  currentReferenceFilePath = null;
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
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const view = leaf?.view;
        if (view instanceof import_obsidian.MarkdownView && view.file) {
          this.currentReferenceFilePath = view.file.path;
        }
      })
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
      }
    });
    this.addCommand({
      id: "new-tab",
      name: "New tab",
      callback: () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CODEXDIAN)[0];
        leaf?.view?.createTab?.();
      }
    });
    this.addCommand({
      id: "new-session",
      name: "New session (in current tab)",
      callback: () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CODEXDIAN)[0];
        leaf?.view?.newSession?.();
      }
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
  getWorkspaceState() {
    return cloneJson(this.pluginData.workspaceState);
  }
  getCurrentReferenceFile() {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.currentReferenceFilePath = activeFile.path;
      return activeFile;
    }
    if (this.currentReferenceFilePath) {
      const remembered = this.app.vault.getAbstractFileByPath(this.currentReferenceFilePath);
      if (remembered instanceof import_obsidian.TFile) {
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
  async saveWorkspaceState(workspaceState) {
    this.pluginData.workspaceState = cloneJson(workspaceState);
    this.pluginData.tabManagerState = {
      openTabs: workspaceState.tabs.map((tab) => ({
        tabId: tab.tabId,
        conversationId: tab.conversation.id
      })),
      activeTabId: workspaceState.activeTabId
    };
    await this.savePluginData();
  }
  async loadSettings() {
    const rawData = await this.loadData() || null;
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...rawData?.settings || {}
    };
    this.settings = mergedSettings;
    this.pluginData = {
      ...createDefaultData(),
      ...rawData,
      settings: mergedSettings,
      workspaceState: normalizeWorkspaceState(rawData, mergedSettings.model)
    };
    this.pluginData.tabManagerState = {
      openTabs: this.pluginData.workspaceState.tabs.map((tab) => ({
        tabId: tab.tabId,
        conversationId: tab.conversation.id
      })),
      activeTabId: this.pluginData.workspaceState.activeTabId
    };
  }
  async saveSettings() {
    this.pluginData.settings = { ...this.settings };
    await this.savePluginData();
  }
  resolveReferenceFile() {
    const recentLeaf = this.app.workspace.getMostRecentLeaf();
    if (recentLeaf?.view instanceof import_obsidian.MarkdownView && recentLeaf.view.file) {
      return recentLeaf.view.file;
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof import_obsidian.MarkdownView && leaf.view.file) {
        return leaf.view.file;
      }
    }
    return null;
  }
  async savePluginData() {
    await this.saveData(this.pluginData);
  }
};
