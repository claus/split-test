import { mappable } from '@madeinhaus/utils';
import { createPath, toSelector } from './dom';
import { NodeInfoSplit, Pair } from './types';

export function fixKerning(
    elSource: HTMLElement,
    elSplit: HTMLElement,
    blockBuckets: NodeInfoSplit[][]
): void {
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
                    const spanEl: HTMLElement | null =
                        siblingEl.querySelector(`[data-typeinternal]`);
                    if (spanEl && spanEl?.dataset.typeinternal !== 'char') {
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

    // Create a div and add all measureElement wrappers to it
    const measureDivKern = document.createElement('div');
    const measureDivNoKern = document.createElement('div');
    measureElements.forEach(({ wrapper }) => {
        measureDivKern.appendChild(wrapper).cloneNode(true);
        measureDivNoKern.appendChild(wrapper.cloneNode(true));
    });

    const setMeasureDivStyles = (element: HTMLElement, kern: boolean) => {
        const styles = [
            { property: 'all', value: 'unset' },
            { property: 'position', value: 'absolute' },
            { property: 'font-kerning', value: kern ? 'normal' : 'none' },
            { property: 'font-feature-settings', value: `"kern" ${kern ? 'on' : 'off'}` },
        ];
        styles.forEach(({ property, value }) => element.style.setProperty(property, value));
    };

    measureDivKern.dataset.type = 'kern';
    setMeasureDivStyles(measureDivKern, true);
    elSplit.insertBefore(measureDivKern, elSplit.firstChild);

    measureDivNoKern.dataset.type = 'nokern';
    setMeasureDivStyles(measureDivNoKern, false);
    elSplit.insertBefore(measureDivNoKern, elSplit.firstChild);

    // Swap split element into the DOM
    elSource.parentNode?.replaceChild(elSplit, elSource);

    // Measure kerning values
    const kerningValues = mappable(measureElements.length).map(i => {
        const measureElKern = measureDivKern.childNodes[i] as HTMLElement;
        const measureElNoKern = measureDivNoKern.childNodes[i] as HTMLElement;
        const kernWidth = measureElKern.getBoundingClientRect().width;
        const noKernWidth = measureElNoKern.getBoundingClientRect().width;
        let tmp = measureElKern;
        while (tmp.firstChild?.nodeType === Node.ELEMENT_NODE) {
            tmp = tmp.firstChild as HTMLElement;
        }
        const fontSize = parseFloat(window.getComputedStyle(tmp).getPropertyValue('font-size'));
        return (kernWidth - noKernWidth) / fontSize;
    });

    // Swap original element back into the DOM
    elSplit.parentNode?.replaceChild(elSource, elSplit);

    elSplit.removeChild(measureDivKern);
    elSplit.removeChild(measureDivNoKern);

    // Apply kerning values
    pairs.forEach(({ key, elements }) => {
        const { span } = elements[0];
        const index = measureElements.findIndex(({ key: k }) => k === key);
        if (index !== -1) {
            if (kerningValues[index]) {
                span.style.setProperty('margin-right', `${kerningValues[index]}em`);
            }
        } else {
            console.log(`Kerning pair not found: {${key}}`);
        }
    });
}
