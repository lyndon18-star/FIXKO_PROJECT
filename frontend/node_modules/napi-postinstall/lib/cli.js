#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const constants_1 = require("./constants");
const index_js_1 = require("./index.js");
function readCwdPackage(packageName, packageVersion) {
    try {
        const packageJson = JSON.parse(node_fs_1.default.readFileSync(constants_1.PACKAGE_JSON, 'utf8'));
        if (packageJson.name === packageName &&
            packageJson.version === packageVersion) {
            return packageJson;
        }
    }
    catch { }
}
const packageName = process.argv[2];
const packageVersion = process.argv[3];
const checkVersion = ['1', 'check', 'true', 'yes'].includes(process.argv[4]);
const packageJson = readCwdPackage(packageName, packageVersion);
const promise = packageJson
    ? (0, index_js_1.checkAndPreparePackage)(packageJson, checkVersion)
    : (0, index_js_1.checkAndPreparePackage)(packageName, packageVersion, checkVersion);
void promise.catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map