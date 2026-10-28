#!/usr/bin/env node
export interface PatchOptions {
    entry?: string;
    name: string;
    append?: string;
}
export declare function patch({ entry, name, append }: PatchOptions): void;
