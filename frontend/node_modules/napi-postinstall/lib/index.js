"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNpm = isNpm;
exports.isPnp = isPnp;
exports.checkAndPreparePackage = checkAndPreparePackage;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const node_path_1 = __importDefault(require("node:path"));
const node_zlib_1 = __importDefault(require("node:zlib"));
const constants_js_1 = require("./constants.js");
const helpers_js_1 = require("./helpers.js");
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
function fetch(url) {
    return new Promise((resolve, reject) => {
        const apiClient = url.startsWith('http://') ? node_http_1.default : node_https_1.default;
        apiClient
            .get(url, res => {
            if (REDIRECT_STATUS_CODES.has(res.statusCode) &&
                res.headers.location) {
                fetch(res.headers.location).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Server responded with ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        })
            .on('error', reject);
    });
}
const redact = (url) => url.replace(/\/\/[^/]+@/g, '//***@');
async function fetchPackageJson(registry, pkg, version) {
    try {
        return await fetch(`${registry}${pkg}/${version}`);
    }
    catch (error) {
        (0, helpers_js_1.errorLog)(`Failed to read ${JSON.stringify(pkg)} from ${JSON.stringify(redact(registry))}: this lookup cannot send credentials`, (0, helpers_js_1.getErrorMessage)(error));
        throw error;
    }
}
function extractFileFromTarGzip(buffer, subpath) {
    try {
        buffer = node_zlib_1.default.unzipSync(buffer);
    }
    catch (err) {
        throw new Error((0, helpers_js_1.errorMessage)(`Invalid gzip data in archive`, (0, helpers_js_1.getErrorMessage)(err)), { cause: err });
    }
    const str = (i, n) => String.fromCodePoint(...buffer.subarray(i, i + n)).replace(/\0.*$/, '');
    let offset = 0;
    subpath = `package/${subpath}`;
    while (offset < buffer.length) {
        const name = str(offset, 100);
        const size = Number.parseInt(str(offset + 124, 12), 8);
        offset += 512;
        if (!Number.isNaN(size)) {
            if (name === subpath) {
                return buffer.subarray(offset, offset + size);
            }
            offset += (size + 511) & ~511;
        }
    }
    throw new Error((0, helpers_js_1.errorMessage)(`Could not find \`${subpath}\` in archive`));
}
function isNpm() {
    return process.env.npm_config_user_agent?.startsWith('npm/');
}
function isPnp() {
    return !!process.versions.pnp;
}
function installUsingNPM(hostPkg, pkg, version, target, subpath, nodePath) {
    const isWasm32Wasi = target === constants_js_1.WASM32_WASI;
    const env = { ...process.env, npm_config_global: undefined };
    const pkgDir = node_path_1.default.dirname((0, helpers_js_1.resolveFrom)(hostPkg + `/${constants_js_1.PACKAGE_JSON}`));
    const projectDir = (0, helpers_js_1.getProjectDir)();
    const projectNodeModules = node_path_1.default.join(projectDir, 'node_modules');
    const installParent = node_path_1.default.join(projectNodeModules, '.napi-postinstall', pkg);
    let installDir;
    try {
        node_fs_1.default.mkdirSync(installParent, { recursive: true });
        installDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(installParent, `${version}-`));
    }
    catch (err) {
        const error = err;
        if (error.code === 'EROFS') {
            (0, helpers_js_1.errorLog)(`Failed to create the temporary directory on read-only location: ${error.message}`);
            (0, helpers_js_1.errorLog)(`You have to install \`${pkg}\` manually in this case.`);
            return;
        }
        throw err;
    }
    try {
        const packageJsonPath = node_path_1.default.join(installDir, constants_js_1.PACKAGE_JSON);
        (0, helpers_js_1.prepareNpmPrefix)(installDir, projectDir);
        (0, node_child_process_1.execSync)(`npm install --prefix ${node_path_1.default.relative(projectDir, installDir)} --loglevel=error --prefer-offline --no-audit --progress=false${isWasm32Wasi ? ` --cpu=${constants_js_1.WASM32} --force` : ''} ${pkg}@${version}`, { cwd: projectDir, stdio: 'pipe', env });
        if (isWasm32Wasi) {
            node_fs_1.default.unlinkSync(packageJsonPath);
        }
        const nodeModulesDir = node_path_1.default.join(installDir, 'node_modules');
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(nodePath), { recursive: true });
        node_fs_1.default.copyFileSync(node_path_1.default.join(nodeModulesDir, pkg, subpath), nodePath);
        try {
            if (isWasm32Wasi) {
                const newNodeModulesDir = node_path_1.default.join(pkgDir, 'node_modules');
                node_fs_1.default.mkdirSync(newNodeModulesDir, { recursive: true });
                const moveOptional = (from, to) => {
                    const existed = node_fs_1.default.existsSync(to);
                    try {
                        (0, helpers_js_1.movePath)(from, to);
                    }
                    catch (error) {
                        if (!existed) {
                            (0, helpers_js_1.errorLog)(`Failed to move ${JSON.stringify(to)} into place`, (0, helpers_js_1.getErrorMessage)(error));
                        }
                    }
                };
                for (const dir of node_fs_1.default.readdirSync(nodeModulesDir)) {
                    if (dir.startsWith('@')) {
                        const newPath = node_path_1.default.join(newNodeModulesDir, dir);
                        node_fs_1.default.mkdirSync(newPath, { recursive: true });
                        const subdir = node_path_1.default.join(nodeModulesDir, dir);
                        for (const nestedDir of node_fs_1.default.readdirSync(subdir)) {
                            moveOptional(node_path_1.default.join(subdir, nestedDir), node_path_1.default.join(newPath, nestedDir));
                        }
                    }
                    else {
                        moveOptional(node_path_1.default.join(nodeModulesDir, dir), node_path_1.default.join(newNodeModulesDir, dir));
                    }
                }
            }
            else {
                const newPath = node_path_1.default.resolve(pkgDir, hostPkg
                    .split('/')
                    .map(() => '..')
                    .join('/'), pkg);
                node_fs_1.default.mkdirSync(newPath, { recursive: true });
                (0, helpers_js_1.movePath)(node_path_1.default.join(nodeModulesDir, pkg), newPath);
            }
        }
        catch {
        }
    }
    finally {
        try {
            (0, helpers_js_1.removeRecursive)(installDir, true);
        }
        catch {
        }
    }
}
async function downloadDirectlyFromNPM(registry, pkg, version, subpath, nodePath) {
    const pathname = `${pkg}/-/${pkg.startsWith('@') ? pkg.split('/')[1] : pkg}-${version}.tgz`;
    const url = `${registry}${pathname}`;
    (0, helpers_js_1.errorLog)(`Trying to download ${JSON.stringify(redact(url))}`);
    try {
        node_fs_1.default.writeFileSync(nodePath, extractFileFromTarGzip(await fetch(url), subpath));
    }
    catch (err) {
        (0, helpers_js_1.errorLog)(`Failed to download ${JSON.stringify(redact(url))}`, (0, helpers_js_1.getErrorMessage)(err));
        throw err;
    }
}
async function checkAndPreparePackage(packageNameOrPackageJson, versionOrCheckVersion, checkVersion) {
    let packageJson;
    const registries = new Map();
    const getRegistry = (pkg) => {
        const scope = pkg.startsWith('@') ? pkg.split('/')[0] : '';
        let registry = registries.get(scope);
        if (registry === undefined) {
            registry = (0, helpers_js_1.getNpmRegistry)(pkg);
            registries.set(scope, registry);
        }
        return registry;
    };
    if (typeof packageNameOrPackageJson === 'string') {
        try {
            packageJson = require((0, helpers_js_1.resolveFrom)(packageNameOrPackageJson + `/${constants_js_1.PACKAGE_JSON}`));
        }
        catch {
            if (typeof versionOrCheckVersion !== 'string') {
                throw new TypeError((0, helpers_js_1.errorMessage)(`Failed to load \`${constants_js_1.PACKAGE_JSON}\` from \`${packageNameOrPackageJson}\`, please provide a version.`));
            }
            const pkg = packageNameOrPackageJson;
            const packageJsonBuffer = await fetchPackageJson(getRegistry(pkg), pkg, versionOrCheckVersion);
            packageJson = JSON.parse(packageJsonBuffer.toString('utf8'));
        }
    }
    else {
        packageJson = packageNameOrPackageJson;
        if (checkVersion === undefined &&
            typeof versionOrCheckVersion === 'boolean') {
            checkVersion = versionOrCheckVersion;
        }
    }
    const { name, version: pkgVersion, optionalDependencies } = packageJson;
    const { napi, version = pkgVersion } = (0, helpers_js_1.getNapiInfoFromPackageJson)(packageJson, checkVersion);
    if (checkVersion && pkgVersion !== version) {
        throw new Error((0, helpers_js_1.errorMessage)(`Inconsistent package versions found for \`${name}\` v${pkgVersion} vs \`${napi.packageName}\` v${version}.`));
    }
    const targets = (0, helpers_js_1.getNapiNativeTargets)();
    for (const target of targets) {
        const pkg = `${napi.packageName}-${target}`;
        const isWasm32Wasi = target === constants_js_1.WASM32_WASI;
        if (!optionalDependencies?.[pkg] &&
            !(isWasm32Wasi && (0, helpers_js_1.hasWasiTarget)(napi.targets))) {
            continue;
        }
        const binaryPrefix = napi.binaryName ? `${napi.binaryName}.` : '';
        const subpath = `${binaryPrefix}${target}.${isWasm32Wasi ? 'wasm' : 'node'}`;
        try {
            (0, helpers_js_1.resolveFrom)(`${pkg}/${subpath}`);
            break;
        }
        catch {
            try {
                (0, helpers_js_1.resolveFrom)(`${name}/${subpath}`);
                break;
            }
            catch { }
            if (!constants_js_1.NPM_PACKAGE_NAME.test(pkg) || !constants_js_1.NPM_PINNED_VERSION.test(version)) {
                throw new Error((0, helpers_js_1.errorMessage)(`Refusing to install an unsafe package`, `${pkg}@${version}`));
            }
            if (isPnp()) {
                if (isWasm32Wasi) {
                    try {
                        (0, node_child_process_1.execSync)(`yarn add -D ${pkg}@${version}`);
                    }
                    catch (err) {
                        (0, helpers_js_1.errorLog)(`Failed to install package \`${pkg}\` automatically in the yarn P'n'P environment`, (0, helpers_js_1.getErrorMessage)(err));
                        (0, helpers_js_1.errorLog)("You'll have to install it manually in this case.");
                    }
                }
                return;
            }
            if (!isNpm()) {
                (0, helpers_js_1.errorLog)(`Failed to find package "${pkg}" on the file system

This can happen if you use the "--no-optional" flag. The "optionalDependencies"
${constants_js_1.PACKAGE_JSON} feature is used by ${name} to install the correct napi binary
for your current platform. This install script will now attempt to work around
this. If that fails, you need to remove the "--no-optional" flag to use ${name}.
`);
            }
            let nodePath;
            try {
                nodePath = (0, helpers_js_1.downloadedNodePath)(name, subpath);
            }
            catch {
                const nodeModulesDir = node_path_1.default.resolve(require.resolve(constants_js_1.meta.name + `/${constants_js_1.PACKAGE_JSON}`), '../..');
                nodePath = node_path_1.default.join(nodeModulesDir, name, subpath);
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(nodePath), { recursive: true });
            }
            try {
                (0, helpers_js_1.errorLog)(`Trying to install package "${pkg}" using npm`);
                installUsingNPM(name, pkg, version, target, subpath, nodePath);
                break;
            }
            catch (err) {
                (0, helpers_js_1.errorLog)(`Failed to install package "${pkg}" using npm`, (0, helpers_js_1.getErrorMessage)(err));
                try {
                    await downloadDirectlyFromNPM(getRegistry(pkg), pkg, version, subpath, nodePath);
                    break;
                }
                catch (err) {
                    throw new Error((0, helpers_js_1.errorMessage)(`Failed to install package "${pkg}"`, (0, helpers_js_1.getErrorMessage)(err)), { cause: err });
                }
            }
        }
    }
}
//# sourceMappingURL=index.js.map