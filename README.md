# warper-ember

An Ember addon providing high-performance list virtualization powered by [Warper](https://github.com/warper-org/warper)'s Rust/WASM core.

## Demo

**[Live Demo](https://arthur5005.github.io/warper-ember/)** - Stress test with 1M+ rows at 120+ FPS

> **Performance Tip:** For maximum performance, disable Ember Inspector or open the demo in an incognito/private browser window. Browser extensions can significantly impact rendering performance.

> **Early Development Warning**: This is an alpha release with no tests. It is intended as a starting point for development work on replacing or updating the core of Ember's VerticalCollection. The API reflects the upstream Warper API and is subject to change as development continues. Use at your own risk.

## What is Warper?

Warper is a virtualization library that efficiently renders massive datasets (10+ million items) while maintaining smooth 120+ FPS performance. Instead of rendering all items in the DOM, it intelligently displays only visible items.

Key performance characteristics:
- **O(1)** lookups for uniform-height items
- **O(log n)** calculations for variable-height items via Fenwick tree
- Zero-copy transfers between WASM and JavaScript via typed arrays
- CSS containment and transforms for GPU acceleration

## Installation

```bash
pnpm add @arthur5005/warper-ember
```

## Limitations

**No automatic element measurement**: This library does not measure rendered elements to determine their actual heights. The `estimateSize` function you provide is used directly as the item size. If your items have variable heights that can only be known after rendering, you'll need to handle measurement yourself.

**Initialization overhead**: The `estimateSize` callback is invoked for every item during initialization to build the internal data structures. For very large lists with complex size calculations, this can cause a noticeable delay on first render. Keep your `estimateSize` function fast—ideally returning a constant or doing simple arithmetic.

## Usage

### Basic Example

```gts
import { WarperComponent } from '@arthur5005/warper-ember';

function estimateSize(_item: number) {
  return 50;
}

export default <template>
  <WarperComponent
    @itemCount={{1000}}
    @estimateSize={{estimateSize}}
    @height={{600}}
    @overscan={{3}}
    as |index|
  >
    <div>Item {{index}}</div>
  </WarperComponent>
</template>
```

### With Data Array

```gts
import Component from '@glimmer/component';
import { WarperComponent } from '@arthur5005/warper-ember';

interface Item {
  id: number;
  name: string;
}

export default class MyList extends Component {
  items: Item[] = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }));

  estimateSize = () => 40;

  <template>
    <WarperComponent
      @items={{this.items}}
      @estimateSize={{this.estimateSize}}
      @height="100vh"
      @overscan={{5}}
      as |item index|
    >
      <div class="row">
        {{item.name}} (index: {{index}})
      </div>
    </WarperComponent>
  </template>
}
```

### Custom Loading and Error States

```gts
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { WarperComponent } from '@arthur5005/warper-ember';

export default class MyList extends Component {
  @tracked count = 1000;

  estimateSize = () => 50;

  <template>
    <WarperComponent
      @itemCount={{this.count}}
      @estimateSize={{this.estimateSize}}
      @height={{400}}
    >
      <:loading>
        <div class="custom-loader">Initializing WASM...</div>
      </:loading>

      <:error as |err|>
        <div class="error-state">Failed to load: {{err.message}}</div>
      </:error>

      <:default as |index|>
        <div>Item {{index}}</div>
      </:default>
    </WarperComponent>
  </template>
}
```

## API

### WarperComponent

The main component for rendering virtualized lists.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `@itemCount` | `number` | * | Total number of items (use this OR `@items`) |
| `@items` | `T[]` | * | Data array (use this OR `@itemCount`) |
| `@estimateSize` | `(index: number) => number` | Yes | Function returning item height in pixels |
| `@height` | `number \| string` | No | Container height (default: `"100%"`) |
| `@overscan` | `number` | No | Extra items to render above/below viewport |
| `@horizontal` | `boolean` | No | Enable horizontal scrolling |

**Yielded values:**
- When using `@items`: yields `[item, index]`
- When using `@itemCount`: yields `[index, index]` (index as both values)

**Named blocks:**
- `default` - Content for each visible item
- `loading` - Custom loading state while WASM initializes
- `error` - Custom error handling (receives error object)

### Virtualizer (Low-level)

For advanced use cases, the `Virtualizer` component provides direct access to scroll methods and range data:

```gts
import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import Virtualizer from '@arthur5005/warper-ember/components/virtualizer';
import type { VirtualRange } from '@arthur5005/warper-ember/components/virtualizer';

export default class CustomVirtualList extends Component {
  estimateSize = () => 50;

  containerStyle = (range: VirtualRange) =>
    htmlSafe(`height:${range.totalHeight}px;position:relative;`);

  rowStyle = (range: VirtualRange, i: number) => {
    const offset = range.offsets[i] ?? 0;
    const size = range.sizes[i] ?? 0;
    return htmlSafe(
      `position:absolute;top:0;left:0;width:100%;height:${size}px;transform:translateY(${offset}px);`
    );
  };

  <template>
    <Virtualizer
      @itemCount={{1000}}
      @estimateSize={{this.estimateSize}}
      as |v|
    >
      <div
        {{v.scrollElementRef}}
        style="height:400px;overflow:auto;"
      >
        <div style={{this.containerStyle v.range}}>
          {{#each v.range.items as |index i|}}
            <div style={{this.rowStyle v.range i}}>
              Item {{index}}
            </div>
          {{/each}}
        </div>
      </div>
      <button type="button" {{on "click" (fn v.scrollToIndex 500)}}>
        Jump to middle
      </button>
    </Virtualizer>
  </template>
}
```

## Implementation Notes

This port aims to match the API of the original Warper's `WarperComponent` and `useVirtualizer` hook. The hook is exposed as a yielded component pattern instead.

Key implementation details:
- Uses double RAF (requestAnimationFrame) for rendering to ensure paint happens before calculations
- WASM binary and bindings are copied directly from the upstream project (no React-free dependency exists yet)
- Automatically detects uniform vs variable item sizes and uses the optimal algorithm

## License

MIT
