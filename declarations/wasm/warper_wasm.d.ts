export function init(): void;
/**
 * Benchmark Fenwick tree - returns ops/second
 * @param {number} count
 * @param {number} iterations
 * @returns {number}
 */
export function bench_fenwick(count: number, iterations: number): number;
/**
 * @returns {string}
 */
export function get_version(): string;
/**
 * Run full benchmark suite - returns formatted results
 * @returns {string}
 */
export function run_benchmarks(): string;
/**
 * Benchmark variable virtualizer - returns ops/second
 * @param {number} count
 * @param {number} iterations
 * @returns {number}
 */
export function bench_variable(count: number, iterations: number): number;
/**
 * Benchmark uniform virtualizer - returns ops/second
 * @param {number} count
 * @param {number} iterations
 * @returns {number}
 */
export function bench_uniform(count: number, iterations: number): number;
/**
 * Ultra-optimized Fenwick Tree (Binary Indexed Tree)
 * Features:
 * - Branchless bit manipulation
 * - Cache-friendly sequential updates
 * - O(1) total query via cached sum
 * - O(log n) prefix sum and point update
 */
export class QuantumFenwick {
    static __wrap(ptr: any): any;
    /**
     * Create with uniform sizes
     * @param {number} count
     * @param {number} size
     * @returns {QuantumFenwick}
     */
    static new_uniform(count: number, size: number): QuantumFenwick;
    /**
     * Construct Fenwick tree in O(n) time
     * @param {Float64Array} sizes
     */
    constructor(sizes: Float64Array);
    __destroy_into_raw(): number;
    __wbg_ptr: number;
    free(): void;
    /**
     * Find index at offset using branchless binary search - O(log n)
     * This is the CRITICAL hot path for variable-size virtualization
     * @param {number} offset
     * @returns {number}
     */
    find_index(offset: number): number;
    /**
     * Query prefix sum [0, idx) - O(log n)
     * Uses branchless bit manipulation
     * @param {number} idx
     * @returns {number}
     */
    prefix_sum(idx: number): number;
    /**
     * Batch update multiple sizes - optimized for bulk ops
     * @param {Uint32Array} indices
     * @param {Float64Array} new_sizes
     */
    batch_update(indices: Uint32Array, new_sizes: Float64Array): void;
    /**
     * Get number of items
     * @returns {number}
     */
    len(): number;
    /**
     * Get total height - O(1) cached
     * @returns {number}
     */
    total(): number;
    /**
     * Update size at index - O(log n)
     * @param {number} idx
     * @param {number} new_size
     */
    update(idx: number, new_size: number): void;
    /**
     * Get size at specific index - O(1)
     * @param {number} idx
     * @returns {number}
     */
    get_size(idx: number): number;
    /**
     * Check if empty
     * @returns {boolean}
     */
    is_empty(): boolean;
}
/**
 * High-performance profiler with O(1) running statistics
 */
export class QuantumProfiler {
    /**
     * @param {number} capacity
     */
    constructor(capacity: number);
    __destroy_into_raw(): number;
    __wbg_ptr: number;
    free(): void;
    /**
     * Add sample with O(1) ring buffer insert
     * @param {number} value
     */
    add(value: number): void;
    /**
     * Get average - O(1)
     * @returns {number}
     */
    avg(): number;
    /**
     * Get FPS from frame times - O(1)
     * @returns {number}
     */
    fps(): number;
    /**
     * Get max - O(1)
     * @returns {number}
     */
    max(): number;
    /**
     * Get min - O(1)
     * @returns {number}
     */
    min(): number;
    /**
     * Reset statistics
     */
    reset(): void;
}
/**
 * Ultimate O(1) virtualizer for fixed-height items
 * Every single operation completes in constant time
 * Zero allocations in hot path - uses pre-allocated pools
 */
export class QuantumUniform {
    /**
     * Create new uniform virtualizer - O(1)
     * @param {number} count
     * @param {number} item_size
     */
    constructor(count: number, item_size: number);
    __destroy_into_raw(): number;
    __wbg_ptr: number;
    free(): void;
    /**
     * Free resources
     */
    free(): void;
    /**
     * Calculate visible range with ADAPTIVE OVERSCAN
     * Returns packed: [start, end, total_height, velocity]
     * @param {number} scroll
     * @param {number} viewport
     * @param {number} overscan
     * @returns {Float64Array}
     */
    calc_range(scroll: number, viewport: number, overscan: number): Float64Array;
    /**
     * Get offset for index - O(1) BRANCHLESS
     * @param {number} index
     * @returns {number}
     */
    get_offset(index: number): number;
    /**
     * Get item count - O(1)
     * @returns {number}
     */
    item_count(): number;
    /**
     * Get visible indices as zero-copy typed array
     * @param {number} start
     * @param {number} end
     * @returns {Uint32Array}
     */
    get_indices(start: number, end: number): Uint32Array;
    /**
     * Get visible offsets as zero-copy typed array
     * @param {number} start
     * @param {number} end
     * @returns {Float64Array}
     */
    get_offsets(start: number, end: number): Float64Array;
    /**
     * Update scroll velocity for adaptive overscan
     * @param {number} v
     */
    set_velocity(v: number): void;
    /**
     * Get total scrollable height - O(1)
     * @returns {number}
     */
    total_height(): number;
    /**
     * Check if range has changed (for skip-render)
     * @param {number} scroll
     * @param {number} viewport
     * @param {number} overscan
     * @returns {boolean}
     */
    range_changed(scroll: number, viewport: number, overscan: number): boolean;
    /**
     * Update item size - O(1)
     * @param {number} size
     */
    set_item_size(size: number): void;
    /**
     * Get index at offset - O(1) BRANCHLESS
     * @param {number} offset
     * @returns {number}
     */
    get_index(offset: number): number;
    /**
     * Get visible sizes as zero-copy typed array
     * @param {number} count
     * @returns {Float64Array}
     */
    get_sizes(count: number): Float64Array;
    /**
     * Get item size - O(1)
     * @returns {number}
     */
    item_size(): number;
    /**
     * Update item count - O(1)
     * @param {number} count
     */
    set_count(count: number): void;
}
/**
 * High-performance virtualizer for variable item heights
 * Uses Fenwick tree for O(log n) prefix sums and binary search
 */
export class QuantumVariable {
    static __wrap(ptr: any): any;
    /**
     * Create with uniform sizes (variable-ready)
     * @param {number} count
     * @param {number} size
     * @returns {QuantumVariable}
     */
    static new_uniform(count: number, size: number): QuantumVariable;
    /**
     * Create variable virtualizer from sizes array
     * @param {Float64Array} sizes
     */
    constructor(sizes: Float64Array);
    __destroy_into_raw(): number;
    __wbg_ptr: number;
    free(): void;
    /**
     * Free resources
     */
    free(): void;
    /**
     * Calculate visible range with adaptive overscan - O(log n)
     * @param {number} scroll
     * @param {number} viewport
     * @param {number} overscan
     * @returns {Float64Array}
     */
    calc_range(scroll: number, viewport: number, overscan: number): Float64Array;
    /**
     * Get offset for index - O(log n)
     * @param {number} index
     * @returns {number}
     */
    get_offset(index: number): number;
    /**
     * Get item count - O(1)
     * @returns {number}
     */
    item_count(): number;
    /**
     * Get visible indices as zero-copy typed array
     * @param {number} start
     * @param {number} end
     * @returns {Uint32Array}
     */
    get_indices(start: number, end: number): Uint32Array;
    /**
     * Get visible offsets as zero-copy typed array - O(k)
     * @param {number} start
     * @param {number} end
     * @returns {Float64Array}
     */
    get_offsets(start: number, end: number): Float64Array;
    /**
     * Update item size - O(log n)
     * @param {number} index
     * @param {number} new_size
     */
    update_size(index: number, new_size: number): void;
    /**
     * Batch update sizes - optimized for bulk ops
     * @param {Uint32Array} indices
     * @param {Float64Array} new_sizes
     */
    batch_update(indices: Uint32Array, new_sizes: Float64Array): void;
    /**
     * Update velocity
     * @param {number} v
     */
    set_velocity(v: number): void;
    /**
     * Get total height - O(1)
     * @returns {number}
     */
    total_height(): number;
    /**
     * @param {number} scroll
     * @param {number} viewport
     * @param {number} overscan
     * @returns {VirtualRangeResult}
     */
    getRangeAndTotalHeight(scroll: number, viewport: number, overscan: number): VirtualRangeResult;
    /**
     * Get size at index - O(1)
     * @param {number} index
     * @returns {number}
     */
    get_size(index: number): number;
    /**
     * Get index at offset - O(log n) branchless
     * @param {number} offset
     * @returns {number}
     */
    get_index(offset: number): number;
    /**
     * Get visible sizes as zero-copy typed array - O(k)
     * @param {number} start
     * @param {number} end
     * @returns {Float64Array}
     */
    get_sizes(start: number, end: number): Float64Array;
}
/**
 * Legacy virtual item struct
 */
export class VirtualItem {
    static __wrap(ptr: any): any;
    /**
     * @param {number} index
     * @param {number} offset_top
     * @param {number} size
     */
    constructor(index: number, offset_top: number, size: number);
    __destroy_into_raw(): number;
    __wbg_ptr: number;
    free(): void;
    free(): void;
    /**
     * @param {number} arg0
     */
    set index(arg0: number);
    /**
     * @returns {number}
     */
    get index(): number;
    /**
     * @param {number} arg0
     */
    set offset_top(arg0: number);
    /**
     * @returns {number}
     */
    get offset_top(): number;
    /**
     * @param {number} arg0
     */
    set size(arg0: number);
    /**
     * @returns {number}
     */
    get size(): number;
}
/**
 * Legacy range result struct
 */
export class VirtualRangeResult {
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number | undefined;
    __wbg_ptr: number | undefined;
    free(): void;
    free(): void;
    /**
     * @returns {Uint32Array}
     */
    get_indices(): Uint32Array;
    /**
     * @returns {Float64Array}
     */
    get_offsets(): Float64Array;
    /**
     * @returns {number}
     */
    items_count(): number;
    /**
     * @param {number} idx
     * @returns {VirtualItem | undefined}
     */
    get_item(idx: number): VirtualItem | undefined;
    /**
     * @returns {Float64Array}
     */
    get_sizes(): Float64Array;
    /**
     * @param {number} arg0
     */
    set total_height(arg0: number);
    /**
     * @returns {number}
     */
    get total_height(): number;
    /**
     * @param {number} arg0
     */
    set start_index(arg0: number);
    /**
     * @returns {number}
     */
    get start_index(): number;
    /**
     * @param {number} arg0
     */
    set end_index(arg0: number);
    /**
     * @returns {number}
     */
    get end_index(): number;
}
export default __wbg_init;
export function initSync(module: any): any;
declare function __wbg_init(module_or_path: any): Promise<any>;
//# sourceMappingURL=warper_wasm.d.ts.map