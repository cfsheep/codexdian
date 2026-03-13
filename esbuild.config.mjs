import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import process from "process";

const prod = process.argv[2] === "production";

/**
 * Post-process: fix `import.meta.url` which esbuild converts to an empty
 * object `{}` when targeting CJS. The Codex SDK needs a real file URL
 * for `createRequire()`.
 */
function fixImportMeta() {
  let code = readFileSync("main.js", "utf8");
  code = code.replace(
    "var import_meta = {};",
    'var import_meta = { url: typeof __filename !== "undefined" ? require("url").pathToFileURL(__filename).href : "file:///dummy" };'
  );
  writeFileSync("main.js", code);
}

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  platform: "node",
  define: {
    "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development"),
  },
});

if (prod) {
  await context.rebuild();
  fixImportMeta();
  process.exit(0);
} else {
  // In watch mode, fix after initial build
  await context.rebuild();
  fixImportMeta();
  await context.watch();
}
