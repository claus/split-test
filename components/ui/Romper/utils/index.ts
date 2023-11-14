import { fixKerning } from './fixKerning';
import { NodeInfo, NodeInfoSplit, SplitOptions } from './types';
import { deepCloneUntil, moveChildNodes } from './dom';

export function split(elSource: HTMLElement, options: SplitOptions = {}): HTMLElement {
    let t = performance.now();

    // Work on a clone of the source element
    const elSplit = elSource.cloneNode(true) as HTMLElement;

    // Swap split element into the DOM
    elSource.parentNode?.replaceChild(elSplit, elSource);

    // Do the splitting
    const blockBuckets = splitChars(elSplit, options);
    console.log('splitChars', performance.now() - t);
    t = performance.now();

    // Swap source element back into the DOM
    elSplit.parentNode?.replaceChild(elSource, elSplit);

    // Fix the kerning
    fixKerning(elSource, elSplit, blockBuckets);
    console.log('fixKerning', performance.now() - t);
    t = performance.now();

    // Swap split element into the DOM
    elSource.parentNode?.replaceChild(elSplit, elSource);

    splitLines(blockBuckets);
    console.log('splitLines', performance.now() - t);

    // Swap source element back into the DOM
    elSplit.parentNode?.replaceChild(elSource, elSplit);

    cleanUp(elSource, blockBuckets);

    return elSplit;
}

export function splitChars(node: Node, options: SplitOptions): NodeInfoSplit[][] {
    const {
        graphemeSplitter = string => [...string.normalize('NFC')],
        whitelistSelectors = ['img', 'svg'],
    } = options;
    const iterator = walk(
        node,
        (node: Node) =>
            node.nodeType === Node.TEXT_NODE ||
            (node as HTMLElement).matches(whitelistSelectors.join(','))
    );
    return (
        [...iterator]
            // Filter out empty text nodes
            .filter(({ text, isWhitelisted }) => (text?.length ?? 0) > 0 || isWhitelisted)
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
            // Wrap graphemes and whitelisted elements in spans
            .map(blockBucket =>
                blockBucket.map(nodeInfo => {
                    if (nodeInfo.isWhitelisted) {
                        const span = document.createElement('span') as HTMLSpanElement;
                        span.dataset.typeinternal = 'whitelisted';
                        nodeInfo.node.parentNode?.replaceChild(span, nodeInfo.node);
                        span.appendChild(nodeInfo.node);
                        return { ...nodeInfo, spans: [{ span }] };
                    } else {
                        const fragment = document.createDocumentFragment();
                        const spans = graphemeSplitter(nodeInfo.text!).map(char => {
                            const span = document.createElement('span') as HTMLSpanElement;
                            span.dataset.typeinternal = 'char';
                            span.textContent = char;
                            fragment.appendChild(span);
                            return { span };
                        });
                        nodeInfo.node.parentNode?.replaceChild(fragment, nodeInfo.node);
                        return { ...nodeInfo, spans };
                    }
                })
            )
    );
};

export function splitLines(blockBuckets: NodeInfoSplit[][]): NodeInfoSplit[][] {
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

    lines.forEach(({ rootEl, isOneLiner, endSpan }) => {
        const lineSpan = document.createElement('span');
        if (isOneLiner) {
            moveChildNodes(rootEl, lineSpan);
        } else {
            moveChildNodes(deepCloneUntil(rootEl, endSpan)!, lineSpan);
        }
        lineSpan.dataset.type = 'line';
        rootEl.appendChild(lineSpan);
    });

    return blockBucketsMeasured;
};

export function cleanUp(elSplit: HTMLElement, blockBuckets: NodeInfoSplit[][]) {
    let charIndex = 0;
    blockBuckets
        .reduce((acc, bucket) => {
            bucket.forEach(({ spans }) => {
                spans.forEach(({ span }) => {
                    acc.push(span);
                });
            });
            return acc;
        }, [] as HTMLSpanElement[])
        .forEach(span => {
            const type = span.dataset.typeinternal;
            const isChar = type === 'char';
            const isWhitelisted = type === 'whitelisted';
            const isSpace = isChar && span.textContent?.match(/[ \n\t\u200B\u200E\u200F\uFEFF]+/);
            if (isChar || isWhitelisted) {
                // Rename internal data type attribute to public facing one
                // and set the value to 'whitespace' if it's a whitespace character
                span.dataset.type = isSpace ? 'whitespace' : type;
                delete span.dataset.typeinternal;
            }
            if ((isChar || isWhitelisted) && !isSpace) {
                // The span contains either a whitelisted element or a letter:
                // Add custom property with the index
                span.style.setProperty('--index', charIndex.toString());
                charIndex++;
            }
        });

    elSplit.style.setProperty('--total-chars', charIndex.toString());
}

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
                        isWhitelisted: false,
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
                        isWhitelisted: false,
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
                yield { node, isWhitelisted: true, nearestBlockLevelParent };
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