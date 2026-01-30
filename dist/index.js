import Component from '@glimmer/component';
import { tracked, cached } from '@glimmer/tracking';
import { modifier } from 'ember-modifier';
import { effect } from 'reactiveweb/effect';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import { g, i, n } from 'decorator-transforms/runtime-esm';
import { htmlSafe } from '@ember/template';

/**
 * Warper WASM Integration for Ember
 *
 * Adapted from the warper library's core/wasm.ts
 * Framework-agnostic WASM wrapper for virtualization
 */

// WASM module interface (runtime types)

let wasmModule = null;
let wasmStatus = 'idle';
let initializationPromise = null;
const performanceStats = {
  initTime: 0,
  memoryUsage: 0,
  isOptimized: false,
  version: '0.0.0',
  opsPerSecond: 0
};
const setStatus = (status, error = null) => {
  wasmStatus = status;
};

/**
 * Initialize the WASM module.
 * Safe to call multiple times - will only initialize once.
 */
const initializeWasm = () => {
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
      const wasmBindings = await import('./warper_wasm-CY6qh2sM.js');
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
const getWasmModule = () => {
  if (wasmStatus !== 'ready' || !wasmModule) {
    throw new Error('WASM not initialized. Call initializeWasm() first.');
  }
  return wasmModule;
};
const createVirtualizer = sizes => {
  const wasm = getWasmModule();
  const sizesArray = new Float64Array(sizes);
  return new wasm.QuantumVariable(sizesArray);
};
const createUniformVirtualizer = (count, size) => {
  const wasm = getWasmModule();
  return new wasm.QuantumUniform(count, size);
};

const MAX_SAFE_SCROLL_HEIGHT = 15_000_000;
class Virtualizer extends Component {
  static {
    g(this.prototype, "isLoading", [tracked], function () {
      return true;
    });
  }
  #isLoading = (i(this, "isLoading"), void 0);
  static {
    g(this.prototype, "error", [tracked], function () {
      return null;
    });
  }
  #error = (i(this, "error"), void 0);
  static {
    g(this.prototype, "range", [tracked], function () {
      return {
        startIndex: 0,
        endIndex: 0,
        items: [],
        offsets: [],
        sizes: [],
        totalHeight: 0,
        paddingTop: 0
      };
    });
  }
  #range = (i(this, "range"), void 0);
  // Non-reactive state
  element = null;
  virtualizer = null;
  uniformVirtualizer = null;
  isUniform = false;
  uniformSize = 0;
  scrollMultiplier = 1;
  lastStart = -1;
  lastEnd = -1;
  lastPaddingTop = 0;
  rafId = 0;
  rafPending = false;
  wasmReady = false;
  constructor(owner, args) {
    super(owner, args);
    void this.initialize();
  }
  willDestroy() {
    super.willDestroy();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.virtualizer?.free();
    this.uniformVirtualizer?.free();
    this.virtualizer = null;
    this.uniformVirtualizer = null;
  }
  get count() {
    return this.args.itemCount;
  }
  async initialize() {
    try {
      await initializeWasm();
      this.wasmReady = true;
      this.setupVirtualizer();
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.isLoading = false;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleItemCountChange = _itemCount => {
    if (!this.wasmReady || this.isLoading) return;
    const count = this.count;
    let virtualTotalHeight;
    if (this.isUniform && this.uniformVirtualizer) {
      // Fast path: just update count on existing uniform virtualizer
      this.uniformVirtualizer.set_count(count);
      virtualTotalHeight = count * this.uniformSize;
    } else if (this.virtualizer) {
      // Variable sizes: need to recreate virtualizer
      const sizes = new Array(count);
      for (let i = 0; i < count; i++) sizes[i] = this.args.estimateSize(i);
      this.virtualizer.free();
      this.virtualizer = createVirtualizer(sizes);
      virtualTotalHeight = sizes.reduce((a, b) => a + b, 0);
    } else {
      return;
    }
    if (virtualTotalHeight > MAX_SAFE_SCROLL_HEIGHT) {
      this.scrollMultiplier = virtualTotalHeight / MAX_SAFE_SCROLL_HEIGHT;
    } else {
      this.scrollMultiplier = 1;
    }
    // Reset range tracking and recalculate
    this.lastStart = -1;
    this.lastEnd = -1;
    this.calculateRange();
  };
  /** Initial virtualizer setup after WASM is ready */
  setupVirtualizer() {
    const count = this.count;
    const firstSize = this.args.estimateSize(0);
    // Check if all items are the same size
    let isUniform = true;
    const checkCount = Math.min(10, count);
    for (let i = 1; i < checkCount; i++) {
      if (this.args.estimateSize(i) !== firstSize) {
        isUniform = false;
        break;
      }
    }
    this.isUniform = isUniform;
    this.uniformSize = firstSize;
    let virtualTotalHeight;
    if (isUniform) {
      this.uniformVirtualizer = createUniformVirtualizer(count, firstSize);
      virtualTotalHeight = count * firstSize;
    } else {
      const sizes = new Array(count);
      for (let i = 0; i < count; i++) sizes[i] = this.args.estimateSize(i);
      this.virtualizer = createVirtualizer(sizes);
      virtualTotalHeight = sizes.reduce((a, b) => a + b, 0);
    }
    if (virtualTotalHeight > MAX_SAFE_SCROLL_HEIGHT) {
      this.scrollMultiplier = virtualTotalHeight / MAX_SAFE_SCROLL_HEIGHT;
    } else {
      this.scrollMultiplier = 1;
    }
    this.isLoading = false;
    requestAnimationFrame(() => {
      if (this.element) {
        this.calculateRange();
      }
    });
  }
  calculateRange = () => {
    const el = this.element;
    if (!el) return;
    const horizontal = this.args.horizontal ?? false;
    const overscan = this.args.overscan ?? 3;
    const scrollPos = horizontal ? el.scrollLeft : el.scrollTop;
    const viewportSize = horizontal ? el.clientWidth : el.clientHeight;
    if (viewportSize <= 0) {
      requestAnimationFrame(() => this.calculateRange());
      return;
    }
    const virtualScroll = scrollPos * this.scrollMultiplier;
    let start = 0;
    let end = 0;
    if (this.isUniform && this.uniformVirtualizer) {
      const info = this.uniformVirtualizer.calc_range(virtualScroll, viewportSize, overscan);
      start = (info[0] ?? 0) | 0;
      end = (info[1] ?? 0) | 0;
    } else if (this.virtualizer) {
      const info = this.virtualizer.calc_range(virtualScroll, viewportSize, overscan);
      start = (info[0] ?? 0) | 0;
      end = (info[1] ?? 0) | 0;
    } else {
      return;
    }
    const totalCount = this.count;
    start = Math.max(0, start);
    end = Math.min(totalCount, end);
    let firstItemVirtualOffset = 0;
    if (this.isUniform) {
      firstItemVirtualOffset = start * this.uniformSize;
    } else if (this.virtualizer) {
      firstItemVirtualOffset = this.virtualizer.get_offset(start);
    }
    const newPaddingTop = firstItemVirtualOffset / this.scrollMultiplier;
    // Skip if unchanged
    if (start === this.lastStart && end === this.lastEnd && Math.abs(newPaddingTop - this.lastPaddingTop) < 0.5) {
      return;
    }
    this.lastStart = start;
    this.lastEnd = end;
    this.lastPaddingTop = newPaddingTop;
    const visibleCount = end - start;
    const items = new Array(visibleCount);
    const offsets = new Array(visibleCount);
    const sizes = new Array(visibleCount);
    if (this.isUniform) {
      const size = this.uniformSize;
      for (let i = 0; i < visibleCount; i++) {
        items[i] = start + i;
        offsets[i] = i * size;
        sizes[i] = size;
      }
    } else if (this.virtualizer) {
      for (let i = 0; i < visibleCount; i++) {
        const idx = start + i;
        items[i] = idx;
        offsets[i] = this.virtualizer.get_offset(idx) - firstItemVirtualOffset;
        sizes[i] = this.virtualizer.get_size(idx);
      }
    }
    const totalHeight = this.isUniform ? totalCount * this.uniformSize / this.scrollMultiplier : this.virtualizer ? this.virtualizer.get_offset(totalCount) / this.scrollMultiplier : 0;
    this.range = {
      startIndex: start,
      endIndex: end,
      items,
      offsets,
      sizes,
      totalHeight: Math.min(totalHeight, MAX_SAFE_SCROLL_HEIGHT),
      paddingTop: newPaddingTop
    };
  };
  handleScroll = () => {
    if (this.rafPending) return;
    this.rafPending = true;
    // Double RAF: let browser paint current frame first, then do our work
    requestAnimationFrame(() => {
      this.rafId = requestAnimationFrame(() => {
        this.rafPending = false;
        this.calculateRange();
      });
    });
  };
  scrollElementRef = modifier(element => {
    if (this.element !== element) {
      this.element?.removeEventListener('scroll', this.handleScroll);
      this.element = element;
      element.addEventListener('scroll', this.handleScroll, {
        passive: true
      });
      if (!this.isLoading) {
        requestAnimationFrame(() => this.calculateRange());
      }
    }
    return () => {
      this.element?.removeEventListener('scroll', this.handleScroll);
      this.element = null;
    };
  });
  scrollToIndex = (index, behavior = 'auto') => {
    const el = this.element;
    if (!el) return;
    let offset = 0;
    if (this.isUniform) {
      offset = index * this.uniformSize;
    } else if (this.virtualizer) {
      offset = this.virtualizer.get_offset(index);
    }
    const scrollOffset = offset / this.scrollMultiplier;
    const horizontal = this.args.horizontal ?? false;
    el.scrollTo({
      [horizontal ? 'left' : 'top']: scrollOffset,
      behavior
    });
  };
  scrollToOffset = (offset, behavior = 'auto') => {
    const el = this.element;
    if (!el) return;
    const horizontal = this.args.horizontal ?? false;
    el.scrollTo({
      [horizontal ? 'left' : 'top']: offset,
      behavior
    });
  };
  get virtualizerState() {
    // Capture "this" for getters
    // This pattern scopes reactivity to only the needed properties
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      scrollElementRef: this.scrollElementRef,
      get range() {
        return self.range;
      },
      get error() {
        return self.error;
      },
      get isLoading() {
        return self.isLoading;
      },
      scrollToIndex: this.scrollToIndex,
      scrollToOffset: this.scrollToOffset
    };
  }
  static {
    setComponentTemplate(precompileTemplate("{{effect this.handleItemCountChange @itemCount}}\n{{yield this.virtualizerState}}", {
      strictMode: true,
      scope: () => ({
        effect
      })
    }), this);
  }
}

class WarperCoreComponent extends Component {
  get innerStyle() {
    const totalHeight = this.args.range.totalHeight || 1;
    return htmlSafe(`width:100%;position:relative;height:${totalHeight}px;pointer-events:none;`);
  }
  get viewportStyle() {
    const paddingTop = this.args.range.paddingTop;
    return htmlSafe(`position:absolute;top:0;left:0;width:100%;transform:translateY(${paddingTop}px);will-change:transform;`);
  }
  rowStyleAt = i => {
    const offset = this.args.range.offsets[i] ?? 0;
    const size = this.args.range.sizes[i] ?? 0;
    return htmlSafe(`position:absolute;top:0;left:0;width:100%;contain:layout style paint;will-change:transform;transform:translateY(${offset}px);height:${size}px;pointer-events:auto;`);
  };
  get isItemsMode() {
    return this.args.items !== undefined;
  }
  getItem = index => {
    if (this.isItemsMode) {
      return this.args.items[index];
    }
    return index;
  };
  static {
    setComponentTemplate(precompileTemplate("<div style={{this.innerStyle}} data-warper-inner>\n  <div style={{this.viewportStyle}} data-warper-viewport>\n    {{#each @range.items key=\"@identity\" as |index i|}}\n      <div style={{this.rowStyleAt i}} data-index={{index}}>\n        {{yield (this.getItem index) index}}\n      </div>\n    {{/each}}\n  </div>\n</div>", {
      strictMode: true
    }), this);
  }
}
class WarperComponent extends Component {
  get containerStyle() {
    const height = this.args.height;
    const h = typeof height === 'number' ? `${height}px` : height ?? '100%';
    return htmlSafe(`width:100%;overflow:auto;position:relative;overscroll-behavior:contain;contain:strict;height:${h};`);
  }
  static {
    n(this.prototype, "containerStyle", [cached]);
  }
  get itemCount() {
    return this.args.itemCount ?? this.args.items?.length ?? 0;
  }
  static {
    setComponentTemplate(precompileTemplate("<Virtualizer @itemCount={{this.itemCount}} @estimateSize={{@estimateSize}} @height={{@height}} @overscan={{@overscan}} @horizontal={{@horizontal}} as |v|>\n  <div {{v.scrollElementRef}} style={{this.containerStyle}} data-warper-container ...attributes>\n    {{#if v.error}}\n      {{#if (has-block \"error\")}}\n        {{yield v.error to=\"error\"}}\n      {{else}}\n        <div data-warper-error>\n          {{v.error.message}}\n        </div>\n      {{/if}}\n    {{else if v.isLoading}}\n      {{#if (has-block \"loading\")}}\n        {{yield to=\"loading\"}}\n      {{else}}\n        <div data-warper-loading>\n          Loading...\n        </div>\n      {{/if}}\n    {{else}}\n      <WarperCoreComponent @items={{@items}} @height={{@height}} @horizontal={{@horizontal}} @range={{v.range}} as |item index|>\n        {{yield item index}}\n      </WarperCoreComponent>\n    {{/if}}\n  </div>\n</Virtualizer>", {
      strictMode: true,
      scope: () => ({
        Virtualizer,
        WarperCoreComponent
      })
    }), this);
  }
}

export { Virtualizer, WarperComponent };
//# sourceMappingURL=index.js.map
