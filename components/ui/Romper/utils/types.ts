export interface SplitOptions {
    /* */
    dataTypeName?: string;
    /* */
    dataTypeWhitespace?: string;
    /* The custom property added to span wrappers to get the index. Default: "--index"  */
    indexCustomProp?: string;
    totalCustomProp?: string;
    /* Whitelist of selectors to wrap in spans. Default: ["img", "svg"] */
    whitelistSelectors?: string[];
    /* Whether to adjust kerning. Default: true */
    adjustKerning?: boolean;
    /* Function to split a string into characters/graphemes. Default: string => [...string.normalize('NFC')] */
    graphemeSplitter?: (str: string) => string[];
    /* Whether to double-wrap characters and/or lines. Default: 'none' */
    doubleWrap?: 'none' | 'chars' | 'lines' | 'both';
}

export interface NodeInfo {
    node: Node;
    isWhitelisted: boolean;
    nearestBlockLevelParent: Node;
    text?: string;
}

export interface NodeInfoSplit extends NodeInfo {
    spans: {
        span: HTMLSpanElement;
        rect?: DOMRect;
        line?: number;
    }[];
}

export interface Pair {
    key: string;
    elements: {
        span: HTMLSpanElement;
        path: HTMLElement[];
        key: string;
    }[];
}
