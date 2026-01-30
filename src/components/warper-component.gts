import Component from '@glimmer/component';
import { cached } from '@glimmer/tracking';
import { htmlSafe } from '@ember/template';

import Virtualizer from './virtualizer.gts';

import type { VirtualRange } from './virtualizer.gts';
import type { SafeString } from '@ember/template';

type YieldedItem<T> = [T] extends [never] ? number : T;

interface WarperCoreSignature<T = never> {
  Args: {
    range: VirtualRange;
    items?: T[];
    height?: number | string;
    horizontal?: boolean;
  };
  Blocks: {
    default: [item: YieldedItem<T>, index: number];
  };
  Element: HTMLDivElement;
}

class WarperCoreComponent<T = never> extends Component<WarperCoreSignature<T>> {
  get innerStyle(): SafeString {
    const totalHeight = this.args.range.totalHeight || 1;
    return htmlSafe(
      `width:100%;position:relative;height:${totalHeight}px;pointer-events:none;`,
    );
  }

  get viewportStyle(): SafeString {
    const paddingTop = this.args.range.paddingTop;
    return htmlSafe(
      `position:absolute;top:0;left:0;width:100%;transform:translateY(${paddingTop}px);will-change:transform;`,
    );
  }

  rowStyleAt = (i: number): SafeString => {
    const offset = this.args.range.offsets[i] ?? 0;
    const size = this.args.range.sizes[i] ?? 0;
    return htmlSafe(
      `position:absolute;top:0;left:0;width:100%;contain:layout style paint;will-change:transform;transform:translateY(${offset}px);height:${size}px;pointer-events:auto;`,
    );
  };

  get isItemsMode(): boolean {
    return this.args.items !== undefined;
  }

  getItem = (index: number): YieldedItem<T> => {
    if (this.isItemsMode) {
      return this.args.items![index] as YieldedItem<T>;
    }
    return index as YieldedItem<T>;
  };

  <template>
    <div style={{this.innerStyle}} data-warper-inner>
      <div style={{this.viewportStyle}} data-warper-viewport>
        {{#each @range.items key="@identity" as |index i|}}
          <div style={{this.rowStyleAt i}} data-index={{index}}>
            {{yield (this.getItem index) index}}
          </div>
        {{/each}}
      </div>
    </div>
  </template>
}

export interface WarperComponentSignature<T = never> {
  Args: {
    items?: T[];
    itemCount?: number;
    estimateSize: (index: number) => number;
    height?: number | string;
    overscan?: number;
    horizontal?: boolean;
  };
  Blocks: {
    default: [item: YieldedItem<T>, index: number];
    loading: [];
    error: [error: Error];
  };
  Element: HTMLDivElement;
}

export default class WarperComponent<T = never> extends Component<
  WarperComponentSignature<T>
> {
  @cached
  get containerStyle(): SafeString {
    const height = this.args.height;
    const h = typeof height === 'number' ? `${height}px` : (height ?? '100%');
    return htmlSafe(
      `width:100%;overflow:auto;position:relative;overscroll-behavior:contain;contain:strict;height:${h};`,
    );
  }

  get itemCount(): number {
    return this.args.itemCount ?? this.args.items?.length ?? 0;
  }

  <template>
    <Virtualizer
      @itemCount={{this.itemCount}}
      @estimateSize={{@estimateSize}}
      @height={{@height}}
      @overscan={{@overscan}}
      @horizontal={{@horizontal}}
      as |v|
    >
      <div
        {{v.scrollElementRef}}
        style={{this.containerStyle}}
        data-warper-container
        ...attributes
      >
        {{#if v.error}}
          {{#if (has-block "error")}}
            {{yield v.error to="error"}}
          {{else}}
            <div data-warper-error>
              {{v.error.message}}
            </div>
          {{/if}}
        {{else if v.isLoading}}
          {{#if (has-block "loading")}}
            {{yield to="loading"}}
          {{else}}
            <div data-warper-loading>
              Loading...
            </div>
          {{/if}}
        {{else}}
          <WarperCoreComponent
            @items={{@items}}
            @height={{@height}}
            @horizontal={{@horizontal}}
            @range={{v.range}}
            as |item index|
          >
            {{yield item index}}
          </WarperCoreComponent>
        {{/if}}
      </div>
    </Virtualizer>
  </template>
}
