import { fixKerning } from './fixKerning';
import { deepCloneUntil, moveChildNodes } from './utils';

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
}

interface NodeInfo {
    node: Node;
    nearestBlockLevelParent: Node;
    isBlockLevel?: boolean;
    text?: string;
}

interface NodeInfoSplit extends NodeInfo {
    spans: {
        span: HTMLSpanElement;
        rect?: DOMRect;
        line?: number;
    }[];
}

export function split(elSource: HTMLElement, options: SplitOptions = {}): HTMLElement {
    const {
        dataTypeName = 'type',
        dataTypeWhitespace = 'whitespace',
        indexCustomProp = '--index',
        totalCustomProp = '--total',
        whitelistSelectors = ['img', 'svg', 'span.ignore'],
        adjustKerning = true,
        graphemeSplitter = string => [...string.normalize('NFC')],
    } = options;
    // Work on a clone of the source element
    const elSplit = elSource.cloneNode(true) as HTMLElement;

    // Swap split element into the DOM
    elSource.parentNode?.replaceChild(elSplit, elSource);

    // Do the splitting
    const blockBuckets = splitChars(elSplit, graphemeSplitter);

    // Swap source element back into the DOM
    elSplit.parentNode?.replaceChild(elSource, elSplit);

    // Fix the kerning
    fixKerning(elSource, elSplit);

    // Swap split element into the DOM
    elSource.parentNode?.replaceChild(elSplit, elSource);

    splitLines(blockBuckets);

    // Swap source element back into the DOM
    elSplit.parentNode?.replaceChild(elSource, elSplit);

    return elSplit;
}

const splitChars = (node: Node, splitter: (str: string) => string[]): NodeInfoSplit[][] => {
    const t = performance.now();
    const iterator = walk(node, (node: Node) => node.nodeType === Node.TEXT_NODE);
    return (
        [...iterator]
            // Filter out empty text nodes
            .filter(({ text }) => (text?.length ?? 0) > 0)
            // Sibling textElements with the same nearestBlockLevelParent
            // are grouped together into buckets.
            .reduce((acc, textElement) => {
                const needsNewBucket =
                    acc.length === 0 ||
                    (acc.at(-1)!.length > 0 &&
                        acc.at(-1)!.at(0)!.nearestBlockLevelParent !==
                            textElement.nearestBlockLevelParent);
                if (needsNewBucket) {
                    acc.push([textElement]);
                } else {
                    acc.at(-1)!.push(textElement);
                }
                return acc;
            }, [] as NodeInfo[][])
            // Wrap graphemes in spans
            .map(blockBucket =>
                blockBucket.map(nodeInfo => {
                    const fragment = document.createDocumentFragment();
                    const spans = splitter(nodeInfo.text!).map(char => {
                        const span = document.createElement('span') as HTMLSpanElement;
                        span.dataset.typeinternal = 'char';
                        span.textContent = char;
                        fragment.appendChild(span);
                        return { span };
                    });
                    nodeInfo.node.parentNode?.replaceChild(fragment, nodeInfo.node);
                    return { ...nodeInfo, spans };
                })
            )
    );
};

const splitLines = (blockBuckets: NodeInfoSplit[][]): NodeInfoSplit[][] => {
    let line = 0;
    const blockBucketsMeasured = blockBuckets.map(blockBucket => {
        let lastXPos: number;
        const blockBucketMeasured = blockBucket.map(nodeInfo => {
            const spans = nodeInfo.spans.map(({ span }) => {
                const rect = span.getBoundingClientRect();
                if (lastXPos != null && rect.x < lastXPos) {
                    line++;
                }
                lastXPos = rect.x;
                return { span, line, rect };
            });
            return { ...nodeInfo, spans };
        });
        line++;
        return blockBucketMeasured;
    });

    let currentLine = 0;

    const lines: {
        rootEl: HTMLElement;
        isOneLiner: boolean;
        startSpan: HTMLSpanElement;
        endSpan: HTMLSpanElement;
    }[] = [];

    blockBucketsMeasured.forEach(blockBucket => {
        const rootEl = blockBucket.at(0)!.nearestBlockLevelParent as HTMLElement;
        const spans = blockBucket.map(nodeInfo => nodeInfo.spans).flat();
        let startSpan: HTMLSpanElement = spans.at(0)!.span;
        let endSpan: HTMLSpanElement = startSpan;
        spans.forEach(({ span, line }) => {
            if (line !== currentLine) {
                lines.push({ rootEl, isOneLiner: false, startSpan, endSpan });
                startSpan = endSpan = span;
                currentLine = line;
            } else {
                endSpan = span;
            }
        });
        const isOneLiner = startSpan === spans.at(0)!.span && endSpan === spans.at(-1)!.span;
        lines.push({ rootEl, isOneLiner, startSpan, endSpan });
        currentLine++;
    });

    lines.forEach(({ rootEl, isOneLiner, startSpan, endSpan }) => {
        const lineSpan = document.createElement('span');
        if (isOneLiner) {
            moveChildNodes(rootEl, lineSpan);
        } else {
            moveChildNodes(deepCloneUntil(rootEl, endSpan)!, lineSpan);
        }
        lineSpan.dataset.line = '';
        lineSpan.style.setProperty('display', 'inline-block');
        rootEl.appendChild(lineSpan);
    });

    return blockBucketsMeasured;
};

function* walk(
    node: Node,
    matcher: (node: Node) => boolean = () => true,
    nearestBlockLevelParent: Node = node
): IterableIterator<NodeInfo> {
    switch (node.nodeType) {
        case Node.TEXT_NODE: {
            if (matcher(node) && node.parentNode) {
                // This is a matching text node:
                if (node.parentNode.childNodes.length === 1) {
                    // This is the only child of its parent
                    // It's safe to get innerText directly from the parent
                    yield {
                        node,
                        isBlockLevel: false,
                        nearestBlockLevelParent,
                        text: (node.parentNode as HTMLElement).innerText,
                    };
                } else {
                    // Wrap nodeValue in a temporary span
                    // This will get us the innerText
                    const spanTmp = document.createElement('span');
                    spanTmp.textContent = node.textContent;
                    spanTmp.style.setProperty('all', 'unset');
                    node.parentNode.replaceChild(spanTmp, node);
                    const text = spanTmp.innerText;
                    // Swap the original node back in
                    spanTmp.parentNode!.replaceChild(node, spanTmp);
                    yield {
                        node,
                        isBlockLevel: false,
                        nearestBlockLevelParent,
                        text,
                    };
                }
            }
            break;
        }
        case Node.ELEMENT_NODE:
        case Node.DOCUMENT_NODE: {
            // Check if this a block-level element
            const display = window
                .getComputedStyle(node as HTMLElement)
                .getPropertyValue('display');
            const blockLevelDisplayValues = [
                'block',
                'flex',
                'grid',
                'table',
                'list-item',
                'flow-root',
            ];
            const isBlockLevel = blockLevelDisplayValues.includes(display);
            if (isBlockLevel) {
                nearestBlockLevelParent = node;
            }
            if (matcher(node)) {
                yield { node, isBlockLevel, nearestBlockLevelParent };
            }
            // Recurse
            var children = node.childNodes;
            for (var i = 0; i < children.length; i++) {
                yield* walk(children[i], matcher, nearestBlockLevelParent);
            }
            break;
        }
        default: {
            // Ignore comments, cdatas etc.
            break;
        }
    }
}
