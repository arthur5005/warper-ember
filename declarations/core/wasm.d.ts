/**
 * Warper WASM Integration for Ember
 *
 * Adapted from the warper library's core/wasm.ts
 * Framework-agnostic WASM wrapper for virtualization
 */
export interface QuantumVariable {
    free(): void;
    calc_range(scrollOffset: number, viewportSize: number, overscan: number): Float64Array;
    get_offset(index: number): number;
    get_size(index: number): number;
    getRangeAndTotalHeight(scrollOffset: number, viewportSize: number, overscan: number): unknown;
}
export interface QuantumUniform {
    free(): void;
    calc_range(scrollOffset: number, viewportSize: number, overscan: number): Float64Array;
    set_count(count: number): void;
    get_indices(start: number, end: number): Uint32Array;
    get_offsets(start: number, end: number): Float64Array;
}
export type WasmStatus = 'idle' | 'initializing' | 'ready' | 'error';
export interface WasmPerformanceStats {
    initTime: number;
    memoryUsage: number;
    isOptimized: boolean;
    version: string;
    opsPerSecond: number;
}
export interface WasmStatusInfo {
    status: WasmStatus;
    error: Error | null;
    initTime: number;
    memoryUsage: number;
    isOptimized: boolean;
    version: string;
    opsPerSecond: number;
}
/**
 * Initialize the WASM module.
 * Safe to call multiple times - will only initialize once.
 */
export declare const initializeWasm: () => Promise<void>;
export declare const createVirtualizer: (sizes: number[]) => QuantumVariable;
export declare const createUniformVirtualizer: (count: number, size: number) => QuantumUniform;
export declare const getWasmStatus: () => WasmStatusInfo;
export declare const get_version: () => string;
//# sourceMappingURL=wasm.d.ts.map