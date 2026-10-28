"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const constants_js_1 = require("./constants.js");
const helpers_js_1 = require("./helpers.js");
function fallback(packageJsonPath, checkVersion) {
    const packageJson = require(packageJsonPath);
    const { name, version: pkgVersion, optionalDependencies } = packageJson;
    const { napi, version = pkgVersion } = (0, helpers_js_1.getNapiInfoFromPackageJson)(packageJson, checkVersion);
    if (checkVersion && pkgVersion !== version) {
        throw new Error((0, helpers_js_1.errorMessage)(`Inconsistent package versions found for \`${name}\` v${pkgVersion} vs \`${napi.packageName}\` v${version}.`));
    }
    if (process.versions.webcontainer) {
        const bindingPkgName = `${napi.packageName}-${constants_js_1.WASM32_WASI}`;
        if (!optionalDependencies?.[bindingPkgName] &&
            !(0, helpers_js_1.hasWasiTarget)(napi.targets)) {
            throw new Error((0, helpers_js_1.errorMessage)(`\`${constants_js_1.WASM32_WASI}\` target is unavailable for \`${name}\` v${version}`));
        }
        const baseDir = node_path_1.default.resolve(node_os_1.default.tmpdir(), `${name}-${version}`);
        const bindingEntry = node_path_1.default.resolve(baseDir, `node_modules/${bindingPkgName}/${napi.binaryName}.wasi.cjs`);
        if (!node_fs_1.default.existsSync(bindingEntry)) {
            node_fs_1.default.rmSync(baseDir, { recursive: true, force: true });
            node_fs_1.default.mkdirSync(baseDir, { recursive: true });
            const bindingPkg = `${bindingPkgName}@${version}`;
            console.log((0, helpers_js_1.errorMessage)(`Downloading \`${bindingPkg}\` on WebContainer...`));
            (0, node_child_process_1.execFileSync)('pnpm', ['i', bindingPkg], {
                cwd: baseDir,
                stdio: 'inherit',
            });
        }
        return require(bindingEntry);
    }
    const cliPath = require.resolve('napi-postinstall/cli');
    const pkgDir = node_path_1.default.dirname(packageJsonPath);
    (0, node_child_process_1.execFileSync)(process.execPath, [cliPath, name, pkgVersion, checkVersion ? '1' : '0'], {
        cwd: pkgDir,
        stdio: 'inherit',
    });
    process.env[(0, helpers_js_1.getSkipFallbackEnv)(name)] = '1';
    const PKG_RESOLVED_PATH = require.resolve(pkgDir);
    delete require.cache[PKG_RESOLVED_PATH];
    return require(pkgDir);
}
module.exports = fallback;
//# sourceMappingURL=fallback.js.map