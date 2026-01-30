/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type declarations for warper_wasm.js
 * This file allows TypeScript to understand the WASM module before build.
 */

export function init(): void;
export function bench_fenwick(count: number, iterations: number): number;
export function get_version(): string;
export function run_benchmarks(): string;
export function bench_variable(count: number, iterations: number): number;
export function bench_uniform(count: number, iterations: number): number;

export class QuantumFenwick {
  static new_uniform(count: number, size: number): QuantumFenwick;
  constructor(sizes: Float64Array);
  free(): void;
  find_index(offset: number): number;
  prefix_sum(idx: number): number;
  batch_update(indices: Uint32Array, new_sizes: Float64Array): void;
  len(): number;
  total(): number;
  update(idx: number, new_size: number): void;
  get_size(idx: number): number;
  is_empty(): boolean;
}

export class QuantumProfiler {
  constructor(capacity: number);
  free(): void;
  add(value: number): void;
  avg(): number;
  fps(): number;
  max(): number;
  min(): number;
  reset(): void;
}

export class QuantumUniform {
  constructor(count: number, item_size: number);
  free(): void;
  calc_range(scroll: number, viewport: number, overscan: number): Float64Array;
  get_offset(index: number): number;
  item_count(): number;
  get_indices(start: number, end: number): Uint32Array;
  get_offsets(start: number, end: number): Float64Array;
  set_velocity(v: number): void;
  total_height(): number;
  range_changed(scroll: number, viewport: number, overscan: number): boolean;
  set_item_size(size: number): void;
  get_index(offset: number): number;
  get_sizes(count: number): Float64Array;
  item_size(): number;
  set_count(count: number): void;
}

export class QuantumVariable {
  static new_uniform(count: number, size: number): QuantumVariable;
  constructor(sizes: Float64Array);
  free(): void;
  calc_range(scroll: number, viewport: number, overscan: number): Float64Array;
  get_offset(index: number): number;
  item_count(): number;
  get_indices(start: number, end: number): Uint32Array;
  get_offsets(start: number, end: number): Float64Array;
  update_size(index: number, new_size: number): void;
  batch_update(indices: Uint32Array, new_sizes: Float64Array): void;
  set_velocity(v: number): void;
  total_height(): number;
  getRangeAndTotalHeight(
    scroll: number,
    viewport: number,
    overscan: number,
  ): VirtualRangeResult;
  get_size(index: number): number;
  get_index(offset: number): number;
  get_sizes(start: number, end: number): Float64Array;
}

export class VirtualItem {
  constructor(index: number, offset_top: number, size: number);
  free(): void;
  index: number;
  offset_top: number;
  size: number;
}

export class VirtualRangeResult {
  free(): void;
  get_indices(): Uint32Array;
  get_offsets(): Float64Array;
  items_count(): number;
  get_item(idx: number): VirtualItem | undefined;
  get_sizes(): Float64Array;
  total_height: number;
  start_index: number;
  end_index: number;
}

declare function __wbg_init(module_or_path?: any): Promise<any>;
export default __wbg_init;
export function initSync(module: any): any;
