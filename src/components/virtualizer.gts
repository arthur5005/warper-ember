import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { modifier } from 'ember-modifier';
import { effect } from 'reactiveweb/effect';

import {
  initializeWasm,
  createVirtualizer,
  createUniformVirtualizer,
} from '../core/wasm.ts';

import type Owner from '@ember/owner';
import type { QuantumVariable, QuantumUniform } from '../core/wasm.ts';
import type { ModifierLike } from '@glint/template';

const MAX_SAFE_SCROLL_HEIGHT = 15_000_000;

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  items: readonly number[];
  offsets: readonly number[];
  sizes: readonly number[];
  totalHeight: number;
  paddingTop: number;
}

export interface VirtualizerState {
  scrollElementRef: ModifierLike<{ Element: HTMLElement }>;
  range: VirtualRange;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  scrollToOffset: (offset: number, behavior?: ScrollBehavior) => void;
  isLoading: boolean;
  error: Error | null;
}

export interface VirtualizerSignature {
  Args: {
    itemCount: number;
    estimateSize: (index: number) => number;
    height?: number | string;
    overscan?: number;
    horizontal?: boolean;
  };
  Blocks: {
    default: [virtualizer: VirtualizerState];
  };
}

export default class Virtualizer extends Component<VirtualizerSignature> {
  @tracked isLoading = true;
  @tracked error: Error | null = null;
  @tracked range: VirtualRange = {
    startIndex: 0,
    endIndex: 0,
    items: [],
    offsets: [],
    sizes: [],
    totalHeight: 0,
    paddingTop: 0,
  };

  // Non-reactive state
  private element: HTMLElement | null = null;
  private virtualizer: QuantumVariable | null = null;
  private uniformVirtualizer: QuantumUniform | null = null;
  private isUniform = false;
  private uniformSize = 0;
  private scrollMultiplier = 1;
  private lastStart = -1;
  private lastEnd = -1;
  private lastPaddingTop = 0;
  private rafId = 0;
  private rafPending = false;
  private wasmReady = false;

  constructor(owner: Owner, args: VirtualizerSignature['Args']) {
    super(owner, args);
    void this.initialize();
  }

  willDestroy(): void {
    super.willDestroy();

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.virtualizer?.free();
    this.uniformVirtualizer?.free();
    this.virtualizer = null;
    this.uniformVirtualizer = null;
  }

  private get count(): number {
    return this.args.itemCount;
  }

  private async initialize(): Promise<void> {
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
  handleItemCountChange = (_itemCount: number): void => {
    if (!this.wasmReady || this.isLoading) return;

    const count = this.count;

    let virtualTotalHeight: number;

    if (this.isUniform && this.uniformVirtualizer) {
      // Fast path: just update count on existing uniform virtualizer
      this.uniformVirtualizer.set_count(count);
      virtualTotalHeight = count * this.uniformSize;
    } else if (this.virtualizer) {
      // Variable sizes: need to recreate virtualizer
      const sizes = new Array<number>(count);
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
  private setupVirtualizer(): void {
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

    let virtualTotalHeight: number;

    if (isUniform) {
      this.uniformVirtualizer = createUniformVirtualizer(count, firstSize);
      virtualTotalHeight = count * firstSize;
    } else {
      const sizes = new Array<number>(count);
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

  private calculateRange = (): void => {
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
      const info = this.uniformVirtualizer.calc_range(
        virtualScroll,
        viewportSize,
        overscan,
      );
      start = (info[0] ?? 0) | 0;
      end = (info[1] ?? 0) | 0;
    } else if (this.virtualizer) {
      const info = this.virtualizer.calc_range(
        virtualScroll,
        viewportSize,
        overscan,
      );
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
    if (
      start === this.lastStart &&
      end === this.lastEnd &&
      Math.abs(newPaddingTop - this.lastPaddingTop) < 0.5
    ) {
      return;
    }

    this.lastStart = start;
    this.lastEnd = end;
    this.lastPaddingTop = newPaddingTop;

    const visibleCount = end - start;
    const items: number[] = new Array<number>(visibleCount);
    const offsets: number[] = new Array<number>(visibleCount);
    const sizes: number[] = new Array<number>(visibleCount);

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

    const totalHeight = this.isUniform
      ? (totalCount * this.uniformSize) / this.scrollMultiplier
      : this.virtualizer
        ? this.virtualizer.get_offset(totalCount) / this.scrollMultiplier
        : 0;

    this.range = {
      startIndex: start,
      endIndex: end,
      items,
      offsets,
      sizes,
      totalHeight: Math.min(totalHeight, MAX_SAFE_SCROLL_HEIGHT),
      paddingTop: newPaddingTop,
    };
  };

  private handleScroll = (): void => {
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

  scrollElementRef = modifier((element: HTMLElement) => {
    if (this.element !== element) {
      this.element?.removeEventListener('scroll', this.handleScroll);
      this.element = element;
      element.addEventListener('scroll', this.handleScroll, {
        passive: true,
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

  scrollToIndex = (index: number, behavior: ScrollBehavior = 'auto'): void => {
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
      behavior,
    });
  };

  scrollToOffset = (
    offset: number,
    behavior: ScrollBehavior = 'auto',
  ): void => {
    const el = this.element;
    if (!el) return;

    const horizontal = this.args.horizontal ?? false;
    el.scrollTo({
      [horizontal ? 'left' : 'top']: offset,
      behavior,
    });
  };

  get virtualizerState(): VirtualizerState {
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
      scrollToOffset: this.scrollToOffset,
    };
  }

  <template>
    {{effect this.handleItemCountChange @itemCount}}
    {{yield this.virtualizerState}}
  </template>
}
