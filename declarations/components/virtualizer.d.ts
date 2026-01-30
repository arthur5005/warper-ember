import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import type { ModifierLike } from '@glint/template';
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
    scrollElementRef: ModifierLike<{
        Element: HTMLElement;
    }>;
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
    isLoading: boolean;
    error: Error | null;
    range: VirtualRange;
    private element;
    private virtualizer;
    private uniformVirtualizer;
    private isUniform;
    private uniformSize;
    private scrollMultiplier;
    private lastStart;
    private lastEnd;
    private lastPaddingTop;
    private rafId;
    private rafPending;
    private wasmReady;
    constructor(owner: Owner, args: VirtualizerSignature['Args']);
    willDestroy(): void;
    private get count();
    private initialize;
    handleItemCountChange: (_itemCount: number) => void;
    /** Initial virtualizer setup after WASM is ready */
    private setupVirtualizer;
    private calculateRange;
    private handleScroll;
    scrollElementRef: import("ember-modifier").FunctionBasedModifier<{
        Args: {
            Positional: unknown[];
            Named: import("ember-modifier/-private/signature").EmptyObject;
        };
        Element: HTMLElement;
    }>;
    scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
    scrollToOffset: (offset: number, behavior?: ScrollBehavior) => void;
    get virtualizerState(): VirtualizerState;
}
//# sourceMappingURL=virtualizer.d.ts.map