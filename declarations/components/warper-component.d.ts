import Component from '@glimmer/component';
import type { SafeString } from '@ember/template';
type YieldedItem<T> = [T] extends [never] ? number : T;
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
export default class WarperComponent<T = never> extends Component<WarperComponentSignature<T>> {
    get containerStyle(): SafeString;
    get itemCount(): number;
}
export {};
//# sourceMappingURL=warper-component.d.ts.map