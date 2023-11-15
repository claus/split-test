import { mappable } from '@madeinhaus/utils';
import { createPath, toSelector } from './dom';
import { NodeInfoSplit, Pair } from './types';

export function fixKerning(
    elSource: HTMLElement,
    elSplit: HTMLElement,
    blockBuckets: NodeInfoSplit[][]
): void {
    console.time('fixKerning');
    const activeElement = elSource.parentNode ? 'source' : 'split';
    if (activeElement === 'split') {
        // Swap split element into the DOM
        elSplit.parentNode?.replaceChild(elSource, elSplit);
    }

    const spans = blockBuckets.reduce((acc, bucket) => {
        bucket.forEach(({ spans, isWhitelisted }) => {
            if (!isWhitelisted) {
                spans.forEach(({ span }) => {
                    acc.push(span);
                });
            }
        });
        return acc;
    }, [] as HTMLSpanElement[]);

    const pairs: Pair[] = spans
        // Get all bigrams
        .reduce((acc, span, i, a) => {
            if (i < a.length - 1) acc[i] = [span];
            if (i > 0) acc[i - 1].push(span);
            return acc;
        }, [] as HTMLSpanElement[][])
        .map(([a, b]) => {
            function getPathAndSelector(
                rootEl: HTMLElement,
                childEl: HTMLElement
            ): [HTMLElement[], string] {
                const path = createPath(rootEl, childEl);
                const selector = path
                    .map(el => {
                        const selector = toSelector(el, [`data-typeinternal`]);
                        const text = el === childEl ? el.textContent ?? '' : '';
                        return selector + (text.length ? ` \{${text}}` : '');
                    })
                    .join(' > ');
                return [path, selector];
            }
            const [aPath, aKey] = getPathAndSelector(elSplit, a);
            const [bPath, bKey] = getPathAndSelector(elSplit, b);
            return {
                key: `${aKey} # ${bKey}`,
                elements: [
                    { span: aPath.at(-1)!, path: aPath, key: aKey },
                    { span: bPath.at(-1)!, path: bPath, key: bKey },
                ],
            };
        });

    const pairSet = new Set<string>();
    const uniquePairs: Pair[] = pairs.filter(({ key, elements }) => {
        const { path: aPath } = elements[0];
        const { path: bPath } = elements[1];
        let i = 0;
        while (aPath[i] === bPath[i] && i < aPath.length && i < bPath.length) i++;
        if (i < aPath.length && i < bPath.length) {
            let siblingNode = aPath[i].nextSibling;
            while (siblingNode && siblingNode !== bPath[i]) {
                if (siblingNode.nodeType === Node.ELEMENT_NODE) {
                    const siblingEl = siblingNode as HTMLElement;
                    const spanEl = siblingEl.querySelector<HTMLElement>(`[data-typeinternal]`);
                    if (spanEl && spanEl.dataset.typeinternal !== 'char') {
                        // One of the siblings is a whitelisted element.
                        // Drop this pair.
                        return false;
                    }
                }
                siblingNode = siblingNode?.nextSibling ?? null;
            }
        }
        if (!pairSet.has(key)) {
            pairSet.add(key);
            return true;
        }
        return false;
    });

    interface MeasureElement extends Pair {
        wrapper: HTMLElement;
    }

    // Deep-clone the two elements of each unique pair and wrap them
    // in a div for measuring the "kerning" (the difference in width
    // between one of the clones rendered with `kerning: normal` and
    // the other with `kerning: none`.
    console.time('measureElements');
    const measureElements: MeasureElement[] = uniquePairs.map(({ key, elements }) => {
        const { span: a, path: aPath } = elements[0];
        const { span: b, path: bPath } = elements[1];

        const measureEl = document.createElement('div');
        const measureElStyles = [
            { property: 'all', value: 'unset' },
            { property: 'display', value: 'block' },
            { property: 'white-space', value: 'pre' },
            { property: 'width', value: 'fit-content' },
        ];
        measureElStyles.forEach(({ property, value }) => {
            measureEl.style.setProperty(property, value);
        });

        let i = 0;
        let currentRoot: HTMLElement = measureEl;
        const maxPathLen = Math.max(aPath.length, bPath.length);

        // Find the common root and reconstruct the DOM structure up to that point
        while (aPath[i] === bPath[i] && i < maxPathLen) {
            if (aPath[i]) {
                const newRoot = aPath[i].cloneNode(false) as HTMLElement;
                currentRoot.appendChild(newRoot);
                currentRoot = newRoot;
            }
            i++;
        }

        // Reconstruct the DOM structure of the two paths,
        // each from the common root down to the span leave
        // and append them to the common root.
        function reconstruct(
            index: number,
            path: HTMLElement[],
            span: HTMLElement,
            currentRoot: HTMLElement
        ) {
            while (path[index]) {
                const el = path[index++];
                const newEl = (
                    el === span ? el.firstChild?.cloneNode(true) : el.cloneNode(false)
                ) as HTMLElement;
                currentRoot.appendChild(newEl);
                currentRoot = newEl;
            }
        }
        reconstruct(i, aPath, a, currentRoot);
        reconstruct(i, bPath, b, currentRoot);

        // Normalize text nodes
        // Safari needs this
        measureEl.normalize();

        return {
            key,
            elements,
            wrapper: measureEl,
        };
    });
    const measureElementMap = new Map<string, MeasureElement>(
        measureElements.map(measureElement => [measureElement.key, measureElement])
    );
    console.timeEnd('measureElements');

    console.time('cloneMeasure');
    const measureDiv = document.createElement('div');
    measureElements.forEach(({ wrapper }) => {
        measureDiv.appendChild(wrapper);
    });
    console.timeEnd('cloneMeasure');

    console.time('measureKernings');
    console.time('kern');
    measureDiv.dataset.type = 'kern';
    elSplit.insertBefore(measureDiv, elSplit.firstChild);
    elSource.parentNode?.replaceChild(elSplit, elSource);
    const kerningData = measureElements.map(({ wrapper }) => {
        const kernWidth = wrapper.getBoundingClientRect().width;
        let tmp = wrapper;
        while (tmp.firstChild?.nodeType === Node.ELEMENT_NODE) {
            tmp = tmp.firstChild as HTMLElement;
        }
        const fontSize = parseFloat(window.getComputedStyle(tmp).getPropertyValue('font-size'));
        return { kernWidth, fontSize };
    });
    console.timeEnd('kern');

    console.time('nokern');
    const keyToKerningValueMap = new Map<string, number>();
    measureDiv.dataset.type = 'nokern';
    measureElements.forEach(({ key, wrapper }, i) => {
        const { kernWidth, fontSize } = kerningData[i];
        const noKernWidth = wrapper.getBoundingClientRect().width;
        const kerningValue = (kernWidth - noKernWidth) / fontSize;
        keyToKerningValueMap.set(key, kerningValue);
    });
    console.timeEnd('nokern');
    console.timeEnd('measureKernings');

    // Swap original element into the DOM
    elSplit.parentNode?.replaceChild(elSource, elSplit);

    // Clean up
    elSplit.removeChild(measureDiv);

    // Apply kerning values
    pairs.forEach(({ key, elements }) => {
        const { span } = elements[0];
        const kerningValue = keyToKerningValueMap.get(key);
        if (kerningValue) {
            span.style.setProperty('margin-right', `${kerningValue}em`);
        }
    });

    if (activeElement === 'split') {
        // Swap split element into the DOM
        elSource.parentNode?.replaceChild(elSplit, elSource);
    }

    console.timeEnd('fixKerning');
}
