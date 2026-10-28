"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectDir = getProjectDir;
exports.prepareNpmPrefix = prepareNpmPrefix;
exports.getNpmRegistry = getNpmRegistry;
exports.movePath = movePath;
exports.removeRecursive = removeRecursive;
exports.resolveFrom = resolveFrom;
exports.downloadedNodePath = downloadedNodePath;
exports.getNapiInfoFromPackageJson = getNapiInfoFromPackageJson;
exports.getNapiNativeTarget = getNapiNativeTarget;
exports.getNapiNativeTargets = getNapiNativeTargets;
exports.hasWasiTarget = hasWasiTarget;
exports.getSkipFallbackEnv = getSkipFallbackEnv;
exports.getErrorMessage = getErrorMessage;
exports.errorLog = errorLog;
exports.errorMessage = errorMessage;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const constants_js_1 = require("./constants.js");
const target_js_1 = require("./target.js");
const NODE_MODULES_SEGMENT = /([\\/])node_modules(?:\1|$)/;
function stripNodeModules(dir) {
    const index = dir.search(NODE_MODULES_SEGMENT);
    return index === -1 ? dir : dir.slice(0, index);
}
function getProjectDir(cwd = process.cwd()) {
    const localPrefix = process.env.npm_config_local_prefix;
    const dir = node_path_1.default.resolve(localPrefix ?? cwd);
    const root = node_path_1.default.parse(dir).root;
    const stripped = stripNodeModules(dir);
    return stripped.length < root.length ? root : stripped;
}
function prepareNpmPrefix(dir, projectDir = getProjectDir()) {
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    node_fs_1.default.writeFileSync(node_path_1.default.join(dir, constants_js_1.PACKAGE_JSON), '{}');
    const npmrc = node_path_1.default.join(dir, constants_js_1.NPMRC);
    try {
        const content = node_fs_1.default.readFileSync(node_path_1.default.join(projectDir, constants_js_1.NPMRC));
        node_fs_1.default.writeFileSync(npmrc, content, { mode: 0o600 });
    }
    catch {
        try {
            node_fs_1.default.unlinkSync(npmrc);
        }
        catch { }
    }
}
function getNpmRegistry(pkg, projectDir = getProjectDir()) {
    let tempDir;
    try {
        tempDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'napi-postinstall-'));
    }
    catch (error) {
        errorLog(`Failed to read the registry, assuming ${constants_js_1.DEFAULT_NPM_REGISTRY}`, getErrorMessage(error));
        return constants_js_1.DEFAULT_NPM_REGISTRY;
    }
    try {
        prepareNpmPrefix(tempDir, projectDir);
        const config = JSON.parse((0, node_child_process_1.execSync)('npm config ls --json', {
            cwd: tempDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }));
        const scope = pkg?.startsWith('@') ? pkg.split('/')[0] : undefined;
        const registry = (scope && config[`${scope}:registry`]) ||
            config.registry ||
            constants_js_1.DEFAULT_NPM_REGISTRY;
        return registry.endsWith('/') ? registry : `${registry}/`;
    }
    catch (error) {
        errorLog(`Failed to read the npm config of \`${projectDir}\`, assuming ${constants_js_1.DEFAULT_NPM_REGISTRY}`, getErrorMessage(error));
        return constants_js_1.DEFAULT_NPM_REGISTRY;
    }
    finally {
        try {
            removeRecursive(tempDir, true);
        }
        catch { }
    }
}
function movePath(from, to) {
    try {
        node_fs_1.default.renameSync(from, to);
    }
    catch (error) {
        if (error.code !== 'EXDEV' ||
            typeof node_fs_1.default.cpSync !== 'function') {
            throw error;
        }
        const isDir = node_fs_1.default.lstatSync(from).isDirectory();
        if (isDir && node_fs_1.default.existsSync(to) && node_fs_1.default.readdirSync(to).length > 0) {
            throw error;
        }
        node_fs_1.default.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
        removeRecursive(from, isDir);
    }
}
function removeRecursive(dir, isDir = node_fs_1.default.lstatSync(dir).isDirectory()) {
    if (!isDir) {
        node_fs_1.default.unlinkSync(dir);
        return;
    }
    for (const entry of node_fs_1.default.readdirSync(dir)) {
        const entryPath = node_path_1.default.join(dir, entry);
        let stats;
        try {
            stats = node_fs_1.default.lstatSync(entryPath);
        }
        catch {
            continue;
        }
        if (stats.isDirectory()) {
            removeRecursive(entryPath, true);
        }
        else {
            node_fs_1.default.unlinkSync(entryPath);
        }
    }
    node_fs_1.default.rmdirSync(dir);
}
function resolveFrom(specifier) {
    return require.resolve(specifier, { paths: [process.cwd()] });
}
function downloadedNodePath(name, subpath) {
    const pkgLibDir = node_path_1.default.dirname(resolveFrom(name + '/package.json'));
    return node_path_1.default.join(pkgLibDir, node_path_1.default.basename(subpath));
}
function getNapiInfoFromPackageJson(packageJson, checkVersion) {
    const { name, napi: napi_, optionalDependencies } = packageJson;
    const targets = napi_?.targets ?? napi_?.triples?.additional;
    if (!targets?.length) {
        throw new Error(errorMessage(`No \`napi.targets\` nor \`napi.triples.additional\` field found in \`${name}\`'s \`package.json\`. Please ensure the package is built with NAPI support.`));
    }
    const napi = napi_;
    napi.binaryName ?? (napi.binaryName = napi.name);
    napi.packageName ?? (napi.packageName = napi.package?.name ?? name);
    napi.targets = targets;
    if (!optionalDependencies) {
        return { napi };
    }
    let version;
    for (const target of targets) {
        const { platformArchABI } = (0, target_js_1.parseTriple)(target);
        const pkg = `${napi.packageName}-${platformArchABI}`;
        const packageVersion = optionalDependencies[pkg];
        if (!packageVersion) {
            continue;
        }
        if (version) {
            if (checkVersion && version !== packageVersion) {
                throw new Error(errorMessage(`Inconsistent package versions found for \`${name}\` with \`${pkg}\` v${packageVersion} vs v${version}.`));
            }
        }
        else if (packageVersion) {
            version = packageVersion;
            if (!checkVersion) {
                break;
            }
        }
    }
    return { napi, version };
}
function isMusl() {
    let musl = false;
    if (process.platform === 'linux') {
        musl = isMuslFromFilesystem();
        if (musl === null) {
            musl = isMuslFromReport();
        }
        if (musl === null) {
            musl = isMuslFromChildProcess();
        }
    }
    return musl;
}
const isFileMusl = (f) => f.includes('libc.musl-') || f.includes('ld-musl-');
function isMuslFromFilesystem() {
    try {
        return node_fs_1.default.readFileSync('/usr/bin/ldd', 'utf8').includes('musl');
    }
    catch {
        return null;
    }
}
function isMuslFromReport() {
    let report = null;
    if (typeof process.report.getReport === 'function') {
        process.report.excludeNetwork = true;
        report = process.report.getReport();
    }
    if (!report) {
        return null;
    }
    if ('header' in report &&
        report.header != null &&
        typeof report.header === 'object' &&
        'glibcVersionRuntime' in report.header &&
        report.header.glibcVersionRuntime) {
        return false;
    }
    return ('sharedObjects' in report &&
        Array.isArray(report.sharedObjects) &&
        report.sharedObjects.some(isFileMusl));
}
function isMuslFromChildProcess() {
    try {
        return (0, node_child_process_1.execSync)('ldd --version', { encoding: 'utf8' }).includes('musl');
    }
    catch {
        return false;
    }
}
function getNapiNativeTarget() {
    switch (process.platform) {
        case 'android': {
            if (process.arch === 'arm64') {
                return 'android-arm64';
            }
            if (process.arch === 'arm') {
                return 'android-arm-eabi';
            }
            break;
        }
        case 'win32': {
            if (process.arch === 'x64') {
                const targets = [];
                if (process.report.getReport().header?.osName?.startsWith('MINGW')) {
                    targets.push('win32-x64-gnu');
                }
                targets.push('win32-x64-msvc');
                return targets;
            }
            if (process.arch === 'ia32') {
                return 'win32-ia32-msvc';
            }
            if (process.arch === 'arm64') {
                return 'win32-arm64-msvc';
            }
            break;
        }
        case 'darwin': {
            const targets = ['darwin-universal'];
            if (process.arch === 'x64') {
                targets.push('darwin-x64');
            }
            else if (process.arch === 'arm64') {
                targets.push('darwin-arm64');
            }
            return targets;
        }
        case 'freebsd': {
            if (process.arch === 'x64') {
                return 'freebsd-x64';
            }
            if (process.arch === 'arm64') {
                return 'freebsd-arm64';
            }
            break;
        }
        case 'linux': {
            if (process.arch === 'x64') {
                if (isMusl()) {
                    return 'linux-x64-musl';
                }
                return 'linux-x64-gnu';
            }
            if (process.arch === 'arm64') {
                if (isMusl()) {
                    return 'linux-arm64-musl';
                }
                return 'linux-arm64-gnu';
            }
            if (process.arch === 'arm') {
                if (isMusl()) {
                    return 'linux-arm-musleabihf';
                }
                return 'linux-arm-gnueabihf';
            }
            if (process.arch === 'loong64') {
                if (isMusl()) {
                    return 'linux-loong64-musl';
                }
                return 'linux-loong64-gnu';
            }
            if (process.arch === 'riscv64') {
                if (isMusl()) {
                    return 'linux-riscv64-musl';
                }
                return 'linux-riscv64-gnu';
            }
            if (process.arch === 'ppc64') {
                return 'linux-ppc64-gnu';
            }
            if (process.arch === 's390x') {
                return 'linux-s390x-gnu';
            }
            break;
        }
        case 'openharmony': {
            if (process.arch === 'arm64') {
                return 'openharmony-arm64';
            }
            if (process.arch === 'x64') {
                return 'openharmony-x64';
            }
            if (process.arch === 'arm') {
                return 'openharmony-arm';
            }
            break;
        }
    }
    return [];
}
const WASI_TARGET = 'wasm32-wasi';
function getNapiNativeTargets() {
    if (process.versions.webcontainer) {
        return [WASI_TARGET];
    }
    const targets = getNapiNativeTarget();
    if (Array.isArray(targets)) {
        return [...targets, WASI_TARGET];
    }
    return [targets, WASI_TARGET];
}
function hasWasiTarget(targets) {
    return targets?.some(target => (0, target_js_1.parseTriple)(target).platformArchABI === constants_js_1.WASM32_WASI);
}
function getSkipFallbackEnv(name) {
    const normalized = name
        .replace(/^@/, '')
        .replace(/[^a-z0-9]+/gi, '_')
        .toUpperCase();
    return `SKIP_${normalized}_FALLBACK`;
}
function getErrorMessage(err) {
    return err?.message || String(err);
}
function errorLog(message, ...args) {
    console.error(`${constants_js_1.LOG_PREFIX}${message}`, ...args);
}
function errorMessage(message, extra) {
    return `${constants_js_1.LOG_PREFIX}${message}` + (extra ? ': ' + extra : '');
}
//# sourceMappingURL=helpers.js.map