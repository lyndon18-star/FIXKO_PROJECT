#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patch = patch;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const helpers_js_1 = require("./helpers.js");
const ANCHOR = '\nif (!nativeBinding) {\n';
const FALLBACK_MARKER = `
    nativeBinding = require('napi-postinstall/fallback')(
      require.resolve('./package.json'),
      true,
    )`;
function patch({ entry = 'index.js', name, append }) {
    if (!name) {
        throw new Error('name is required');
    }
    const entryPath = node_path_1.default.resolve(entry);
    let code = node_fs_1.default.readFileSync(entryPath, 'utf8');
    if (code.includes(FALLBACK_MARKER)) {
        return;
    }
    if (!code.includes(ANCHOR)) {
        throw new Error(`cannot find ${JSON.stringify(ANCHOR)} in ${entry}`);
    }
    code = code.replace(ANCHOR, `
if (!nativeBinding && process.env[${JSON.stringify((0, helpers_js_1.getSkipFallbackEnv)(name))}] !== '1') {
  try {${FALLBACK_MARKER}
    if (
      typeof __napiLoadedBindingTarget !== 'undefined' &&
      typeof nativeBinding.__napiBindingTarget === 'string'
    ) {
      __napiLoadedBindingTarget = nativeBinding.__napiBindingTarget
    }
  } catch (err) {
    loadErrors.push(err)
  }
}
` + ANCHOR);
    if (append) {
        code += `${code.endsWith('\n') ? '' : '\n'}\n${append}\n`;
    }
    node_fs_1.default.writeFileSync(entryPath, code);
}
if (require.main === module) {
    let [entry = 'index.js', name = ''] = process.argv.slice(2);
    if (!name) {
        if (entry.includes('.')) {
            name = JSON.parse(node_fs_1.default.readFileSync('package.json', 'utf8')).name;
        }
        else {
            name = entry;
            entry = 'index.js';
        }
    }
    patch({ entry, name });
}
//# sourceMappingURL=patch.js.map