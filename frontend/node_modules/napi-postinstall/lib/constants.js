"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPM_PINNED_VERSION = exports.NPM_PACKAGE_NAME = exports.NPMRC = exports.PACKAGE_JSON = exports.EABI = exports.WASM32_WASI = exports.WASI = exports.WASM32 = exports.LOG_PREFIX = exports.meta = exports.DEFAULT_NPM_REGISTRY = void 0;
const node_path_1 = __importDefault(require("node:path"));
exports.DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/';
exports.meta = require(node_path_1.default.resolve(__dirname, '../package.json'));
const { name, version } = exports.meta;
exports.LOG_PREFIX = `[${name}@${version}] `;
exports.WASM32 = 'wasm32';
exports.WASI = 'wasi';
exports.WASM32_WASI = `${exports.WASM32}-${exports.WASI}`;
exports.EABI = 'eabi';
exports.PACKAGE_JSON = 'package.json';
exports.NPMRC = '.npmrc';
exports.NPM_PACKAGE_NAME = /^(?:@[a-z0-9-][\w.-]*\/)?[a-z0-9-][\w.-]*$/i;
exports.NPM_PINNED_VERSION = /^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i;
//# sourceMappingURL=constants.js.map