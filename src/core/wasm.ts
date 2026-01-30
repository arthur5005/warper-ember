/**
 * Warper WASM Integration for Ember
 *
 * Adapted from the warper library's core/wasm.ts
 * Framework-agnostic WASM wrapper for virtualization
 */

// WASM module interface (runtime types)
interface WasmModule {
  default: () => Promise<void>;
  get_version: () => string;
  bench_uniform: (count: number, iterations: number) => number;
  QuantumVariable: new (sizes: Float64Array) => QuantumVariable;
  QuantumUniform: new (count: number, size: number) => QuantumUniform;
}

export interface QuantumVariable {
  free(): void;
  calc_range(
    scrollOffset: number,
    viewportSize: number,
    overscan: number,
  ): Float64Array;
  get_offset(index: number): number;
  get_size(index: number): number;
  getRangeAndTotalHeight(
    scrollOffset: number,
    viewportSize: number,
    overscan: number,
  ): unknown;
}

export interface QuantumUniform {
  free(): void;
  calc_range(
    scrollOffset: number,
    viewportSize: number,
    overscan: number,
  ): Float64Array;
  set_count(count: number): void;
  get_indices(start: number, end: number): Uint32Array;
  get_offsets(start: number, end: number): Float64Array;
}

let wasmModule: WasmModule | null = null;

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

let wasmStatus: WasmStatus = 'idle';
let wasmError: Error | null = null;
let initializationPromise: Promise<void> | null = null;
const performanceStats: WasmPerformanceStats = {
  initTime: 0,
  memoryUsage: 0,
  isOptimized: false,
  version: '0.0.0',
  opsPerSecond: 0,
};

const setStatus = (status: WasmStatus, error: Error | null = null) => {
  wasmStatus = status;
  wasmError = error;
};

/**
 * Initialize the WASM module.
 * Safe to call multiple times - will only initialize once.
 */
export const initializeWasm = (): Promise<void> => {
  if (initializationPromise) {
    return initializationPromise;
  }

  if (wasmStatus === 'ready') {
    return Promise.resolve();
  }

  setStatus('initializing');
  const startTime = performance.now();

  initializationPromise = (async () => {
    try {
      const wasmBindings =
        (await import('../wasm/warper_wasm.js')) as WasmModule;

      wasmModule = wasmBindings;
      const wasmInit = wasmBindings.default;

      await wasmInit();

      const endTime = performance.now();
      performanceStats.initTime = endTime - startTime;
      performanceStats.isOptimized = true;
      performanceStats.version = wasmModule.get_version();

      try {
        performanceStats.opsPerSecond = wasmModule.bench_uniform(10000, 1000);
      } catch {
        performanceStats.opsPerSecond = 0;
      }

      setStatus('ready');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[Warper] WASM initialization failed:', error);
      setStatus('error', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

const getWasmModule = (): WasmModule => {
  if (wasmStatus !== 'ready' || !wasmModule) {
    throw new Error('WASM not initialized. Call initializeWasm() first.');
  }
  return wasmModule;
};

export const createVirtualizer = (sizes: number[]): QuantumVariable => {
  const wasm = getWasmModule();
  const sizesArray = new Float64Array(sizes);
  return new wasm.QuantumVariable(sizesArray);
};

export const createUniformVirtualizer = (
  count: number,
  size: number,
): QuantumUniform => {
  const wasm = getWasmModule();
  return new wasm.QuantumUniform(count, size);
};

export const getWasmStatus = (): WasmStatusInfo => ({
  status: wasmStatus,
  error: wasmError,
  ...performanceStats,
});

export const get_version = (): string => {
  const wasm = getWasmModule();
  return wasm.get_version();
};
