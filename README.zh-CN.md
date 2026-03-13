# Codexdian

把 Codex 直接放进 Obsidian 里使用：围绕你的仓库和笔记对话、编辑文件、保留当前参考文档，并在一个侧边栏里完成多步任务。

[English README](./README.md)

## 这是什么

Codexdian 是一个 Obsidian 桌面插件。它把 Codex 聊天与代理工作流放进 Obsidian 侧边栏里，让你的整个 vault 变成可操作的工作目录。

它不是独立 AI 服务。插件本身只提供界面，真正执行任务的还是你本机上已经能运行的 `codex` CLI。

## 能做什么

- 在 Obsidian 侧边栏里直接打开 Codex
- 让 Codex 以当前 vault 作为工作目录读写文件
- 多标签管理不同对话
- 在每个对话里附带“当前参考文档”
- 在首条消息发送前移除参考文档，开始一个不依赖当前笔记的新对话
- 在底部输入区切换模型、Thinking 和 `YOLO`
- 在同一个界面里看到流式回复、工具调用、文件修改和错误信息

## 安装前先确认

你需要准备好：

- Obsidian 桌面版
- 本机可用的 Codex CLI
- 该 CLI 对应的有效登录或 API 凭据

如果你在系统终端里能正常运行 `codex`，Codexdian 通常就能调用它。若 `codex` 不在默认 `PATH` 中，可以在插件设置里填入自定义路径。

## 重点说明：普通 Obsidian 用户不需要自己编译插件

如果你只是想使用 Codexdian，不需要执行 `npm install`，也不需要执行 `npm run build`。

这两个命令只给想改源码、参与开发的人用。

## 普通用户安装方法

1. 从 GitHub 下载本仓库 ZIP，或者下载后续提供的 release 包。
2. 在你的 vault 中创建目录：
   `.obsidian/plugins/codexdian`
3. 把下面 3 个已构建文件放进去：
   `manifest.json`、`main.js`、`styles.css`
4. 打开 Obsidian。
5. 在 `设置 -> 第三方插件` 里启用 `Codexdian`。

如果你下载的是整个仓库 ZIP，不必自己编译，只要把上面这 3 个文件放到正确目录即可。

## 第一次配置 Codex CLI

Codexdian 依赖你先把 Codex CLI 装好并完成登录。

OpenAI 当前官方文档给出的 npm 安装流程是：

```bash
npm i -g @openai/codex
codex
```

第一次运行 `codex` 时，会提示你使用 ChatGPT 账号或 API key 完成登录。

官方文档：

- [Codex CLI 文档](https://developers.openai.com/codex/cli)
- [Codex Windows 指南](https://developers.openai.com/codex/windows)

Windows 说明：
OpenAI 官方目前把 Codex CLI 的 Windows 支持标记为实验性。实际使用时，最重要的是先确认 `codex` 能在与你的 Obsidian 相同环境里正常启动。

## 快速开始

1. 先打开一篇你准备作为上下文的笔记。
2. 在功能区按钮或命令面板中打开 `Codexdian`。
3. 看底部输入区上方的参考文档 chip。
4. 如果这次对话不想参考当前笔记，点 chip 右侧的关闭按钮。
5. 选择模型、Thinking 和 `YOLO` 状态。
6. 输入需求，按 `Enter` 发送。

## 参考文档机制

Codexdian 会为每个对话保存一个独立的“当前参考文档”。

- 在首条消息发送前，当前笔记可以自动作为参考文档附加进去。
- 点击 chip 的关闭按钮，会把它从本次对话里移除。
- 如果对话还没开始，你再切换到另一篇笔记，新的笔记可以重新成为参考文档。
- 一旦对话正式开始，这个参考文档会保持稳定，直到你新建 session。

## 权限模式与 YOLO

底部的 `YOLO` 开关用来让权限状态一眼可见。

- `Suggest`：更保守，偏只读
- `Auto Edit`：允许自动批准文件编辑
- `Full Auto`：自动批准所有动作
- `YOLO`：快速切到或切出 `Full Auto`

如果你更希望默认安全一点，可以在插件设置中把权限模式改成更保守的选项。

## 可用命令

- `Open chat view`
- `New tab`
- `New session (in current tab)`

## 输入区快捷键

- `Enter`：发送消息
- `Shift+Enter`：换行
- `Ctrl+C`：中止当前回复

## 设置项

当前支持这些设置：

- Codex CLI 自定义路径
- 默认模型
- Thinking 等级
- 权限模式
- 最大标签数
- System prompt
- 回复语言
- 环境变量
- 自动滚动

## 常见排查

如果“消息发不出去”，优先检查：

1. 在 Obsidian 外部的系统终端里运行一次 `codex`。
2. 确认 CLI 能正常启动，而且已经登录。
3. 如果 Obsidian 找不到 CLI，就在插件设置里填完整可执行文件路径。
4. 确认插件目录中确实存在 `manifest.json`、`main.js`、`styles.css`。
5. 如果你在 Windows 上使用，确认 Obsidian 调用到的是和你终端里同一套 Codex 环境。

更多帮助见 [SUPPORT.md](./SUPPORT.md)。

## 开发者安装

只有想改源码时，才需要下面这些命令：

```bash
npm install
npm run check
npm run build
```

常用脚本：

- `npm run dev`：开发时持续重建
- `npm run check`：TypeScript 检查
- `npm run build`：生成正式构建产物

更多说明见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 后续计划

- 更清晰的插件内引导
- 截图和短演示
- 更方便的 release 安装包
- 更好的启动与登录排查文档
- 比单一参考文档更丰富的上下文控制

## 许可证

MIT
