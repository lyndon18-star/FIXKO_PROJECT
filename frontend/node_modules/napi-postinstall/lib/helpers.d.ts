import type { NapiInfo, PackageJson } from './types.js';
export declare function getProjectDir(cwd?: string): string;
export declare function prepareNpmPrefix(dir: string, projectDir?: string): void;
export declare function getNpmRegistry(pkg?: string, projectDir?: string): string;
export declare function movePath(from: string, to: string): void;
export declare function removeRecursive(dir: string, isDir?: boolean): void;
export declare function resolveFrom(specifier: string): string;
export declare function downloadedNodePath(name: string, subpath: string): string;
export declare function getNapiInfoFromPackageJson(packageJson: PackageJson, checkVersion: true): NapiInfo & {
    version: string;
};
export declare function getNapiInfoFromPackageJson(packageJson: PackageJson, checkVersion?: boolean): NapiInfo;
export declare function getNapiNativeTarget(): string[] | string;
export declare function getNapiNativeTargets(): string[];
export declare function hasWasiTarget(targets?: string[]): boolean | undefined;
export declare function getSkipFallbackEnv(name: string): string;
export declare function getErrorMessage(err: unknown): string;
export declare function errorLog(message: string, ...args: unknown[]): void;
export declare function errorMessage(message: string, extra?: string): string;
