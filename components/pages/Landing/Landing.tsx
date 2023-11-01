import * as React from 'react';
import cx from 'clsx';
import Graphemer from 'graphemer';

import { mappable } from '@madeinhaus/utils';

import Head from 'components/misc/Head';

import grid from 'styles/modules/grid.module.scss';
import styles from './Landing.module.scss';

interface SplitOptions {
    /* */
    dataTypeName?: string;
    /* */
    dataTypeWhitespace?: string;
    /* The custom property added to span wrappers to get the index. Default: "--index"  */
    indexCustomProp?: string;
    /* Whitelist of selectors to wrap in spans. Default: ["img", "svg"] */
    whitelistSelectors?: string[];
    /* Whether to adjust kerning. Default: true */
    adjustKerning?: boolean;
    /* Function to split a string into characters/graphemes. Default: string => [...string.normalize('NFC')] */
    graphemeSplitter?: (str: string) => string[];
}

function walk(node: Node, func: (node: Node) => void) {
    var children = node.childNodes;
    for (var i = 0; i < children.length; i++) walk(children[i], func);
    func(node);
}

function split(el: HTMLElement, options: SplitOptions = {}): HTMLElement {
    const {
        dataTypeName = 'type',
        dataTypeWhitespace = 'whitespace',
        indexCustomProp = '--index',
        whitelistSelectors = ['img', 'svg'],
        adjustKerning = true,
        graphemeSplitter = string => [...string.normalize('NFC')],
    } = options;
    const dataTypeNameInternal = `${dataTypeName}internal`;
    const splitNode = (node: Node) => {
        const children = Array.from(node.childNodes).reverse();
        for (const child of children) {
            switch (child.nodeType) {
                case Node.ELEMENT_NODE: {
                    if ((child as Element).matches(whitelistSelectors.join(','))) {
                        // This is a whitelisted element.
                        // Wrap it in a span and don't process any further.
                        const span = document.createElement('span');
                        child.parentNode?.replaceChild(span, child);
                        span.dataset[dataTypeName] = child.nodeName.toLowerCase();
                        span.appendChild(child);
                    } else {
                        splitNode(child);
                    }
                    break;
                }
                case Node.TEXT_NODE: {
                    // Wrap nodeValue in a temporary span.
                    // This will get us the innerText with collapsed whitespace.
                    const spanTmp = document.createElement('span');
                    spanTmp.textContent = child.nodeValue;
                    spanTmp.style.setProperty('all', 'unset');
                    node.replaceChild(spanTmp, child);
                    // Wrap each character in a span
                    const fragment = document.createDocumentFragment();
                    graphemeSplitter(spanTmp.innerText).forEach(char => {
                        const span = document.createElement('span');
                        span.dataset[dataTypeNameInternal] = 'char';
                        span.textContent = char;
                        fragment.appendChild(span);
                    });
                    spanTmp.parentNode?.replaceChild(fragment, spanTmp);
                    break;
                }
                default: {
                    // Remove comments, cdatas etc.
                    child.remove();
                    break;
                }
            }
        }
        return node;
    };

    console.log(`"${el.innerText}"`);

    // Swap split element into the DOM
    const elSplit = el.cloneNode(true) as HTMLElement;
    el.parentNode?.replaceChild(elSplit, el);

    // Do the splitting
    splitNode(elSplit);

    console.log(`"${elSplit.innerText}"`);

    // Swap original element back into the DOM
    elSplit.parentNode?.replaceChild(el, elSplit);

    const spans = Array.from(
        elSplit.querySelectorAll<HTMLSpanElement>(`[data-${dataTypeNameInternal}]`)
    );
    console.log(spans);

    interface Pair {
        key: string;
        elements: {
            span: HTMLSpanElement;
            path: HTMLElement[];
            key: string;
        }[];
    }

    const pairs: Pair[] = spans
        // Only use spans that contain text (no wrapped images etc.)
        .filter(span => span.dataset[dataTypeNameInternal] === 'char')
        // Get all bigrams
        .reduce((acc, span, i, a) => {
            if (i < a.length - 1) acc[i] = [span];
            if (i > 0) acc[i - 1].push(span);
            return acc;
        }, [] as HTMLSpanElement[][])
        .map(([a, b]) => {
            const aSpan = a;
            const bSpan = b;
            const aPath = [a];
            const bPath = [b];
            while (a.parentElement && a.parentElement !== elSplit) {
                a = a.parentElement;
                aPath.unshift(a);
            }
            while (b.parentElement && b.parentElement !== elSplit) {
                b = b.parentElement;
                bPath.unshift(b);
            }
            const aKey = aPath
                .map(el => {
                    const elClone = el.cloneNode(el === aSpan) as HTMLElement;
                    delete elClone.dataset[dataTypeNameInternal];
                    const key = elClone.outerHTML;
                    return key.replace(`</${elClone.nodeName.toLowerCase()}>`, '');
                })
                .join(' | ');
            const bKey = bPath
                .map(el => {
                    const elClone = el.cloneNode(el === bSpan) as HTMLElement;
                    delete elClone.dataset[dataTypeNameInternal];
                    const key = elClone.outerHTML;
                    return key.replace(`</${elClone.nodeName.toLowerCase()}>`, '');
                })
                .join(' | ');
            console.log(`-------\n${aKey} # ${bKey}`);
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
                    const spanEl: HTMLElement | null = siblingEl.querySelector(
                        `[data-${dataTypeNameInternal}]`
                    );
                    if (spanEl && spanEl?.dataset[dataTypeNameInternal] !== 'char') {
                        // One of the siblings is a whitelisted element.
                        // Drop this pair.
                        return false;
                    }
                }
                siblingNode = siblingNode?.nextSibling ?? null;
            }
        }
        const isDuplicate = pairSet.has(key);
        pairSet.add(key);
        return !isDuplicate;
    });

    console.log(uniquePairs);

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
                const isSpan = el === span;
                const newEl = (
                    isSpan ? el.firstChild?.cloneNode(true) : el.cloneNode(false)
                ) as HTMLElement;
                currentRoot.appendChild(newEl);
                currentRoot = newEl;
            }
        }
        reconstruct(i, aPath, a, currentRoot);
        reconstruct(i, bPath, b, currentRoot);
        // Normalize text nodes
        // Safari needs this
        walk(measureEl, node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                (node as HTMLElement).normalize();
            }
        });
        return {
            key,
            elements,
            wrapper: measureEl,
        };
    });

    console.log(measureElements);

    // create a div and add all wrappers from measure to it
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

    measureDivKern.dataset[dataTypeName] = 'kern';
    setMeasureDivStyles(measureDivKern, true);
    elSplit.insertBefore(measureDivKern, elSplit.firstChild);

    measureDivNoKern.dataset[dataTypeName] = 'nokern';
    setMeasureDivStyles(measureDivNoKern, false);
    elSplit.insertBefore(measureDivNoKern, elSplit.firstChild);

    // Swap split element into the DOM
    el.parentNode?.replaceChild(elSplit, el);

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

    console.log(kerningValues);

    // Swap original element back into the DOM
    elSplit.parentNode?.replaceChild(el, elSplit);

    elSplit.removeChild(measureDivKern);
    elSplit.removeChild(measureDivNoKern);

    // Apply kerning values
    // For all pairs, find
    pairs.forEach(({ key, elements }) => {
        const { span } = elements[0];
        console.log(`"${span.textContent}${elements[1].span.textContent}"`);
        const index = measureElements.findIndex(({ key: k }) => k === key);
        if (index !== -1) {
            if (kerningValues[index]) {
                span.style.setProperty('margin-right', `${kerningValues[index]}em`);
            }
        } else {
            console.log('Kerning pair not found', key);
        }
    });

    let charIndex = 0;
    spans.forEach(span => {
        const type = span.dataset[dataTypeNameInternal];
        const hasLetter = span.textContent?.trim().length; // TODO: Does this work for all kinds of whitespaces?
        if (type === 'char') {
            // Rename internal data type attribute to public facing one
            // and set it to 'whitespace' if it's a whitespace character
            span.dataset[dataTypeName] = hasLetter ? type : 'whitespace';
            delete span.dataset[dataTypeNameInternal];
        }
        if (type !== 'char' || hasLetter) {
            // The span contains either a whitelisted element or a letter:
            // Add custom property with the index
            span.style.setProperty(indexCustomProp, charIndex.toString());
            charIndex++;
        }
    });

    return elSplit;
}

const Landing = () => {
    const original = React.useRef<HTMLDivElement>(null);
    const modified = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (!modified.current || !original.current) return;
        const splitter = new Graphemer();
        const elMod = modified.current;
        const elNormal = split(original.current!, {
            graphemeSplitter: string => splitter.splitGraphemes(string),
        });
        elMod.innerHTML = '';
        if (elNormal) {
            for (const node of Array.from(elNormal?.childNodes ?? [])) {
                elMod?.appendChild(node);
            }
        }
    }, []);
    return (
        <div className={cx(styles.root, grid.container)}>
            <Head title="Split Text" description="Split Text Experiments" />
            <section className={styles.section}>
                <div className={styles.test}>
                    <div
                        ref={original}
                        className={styles.original}
                        dangerouslySetInnerHTML={{
                            __html: 'X <![CDATA[ xxx ]]> <!-- --> <b><img class="abc" src=""></b>  <i>   A   <b>   B  </b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i> ',
                            // __html: 'A <b>W</b>',
                            // __html: 'W <i> A <a href="https://madeinhaus.com">A</a> </i>',
                            // __html: 'https://<a href="https://madeinhaus.com">madeinhaus.com</a>',
                            __html: 'The quick brown fox <i><b>jumps</b></i> over the lazy dog.',
                            // __html: 'h̷̛͈͆̀͋͠e̷̢̮̩̙͐͒l̴̢̨̅͑l̸͍̩̗͌̄o̵̫͖̘̰̿̒͆̈́̍',
                            // __html: 'A<i>V<a href="https://madeinhaus.com">AV</a></i>AV',
                        }}
                    />
                    <div ref={modified} className={styles.split} />
                </div>
            </section>
        </div>
    );
};

interface TestProps {
    children: React.ReactNode;
}

const Test: React.FC<TestProps> = ({ children }) => {
    return children;
};

export default Landing;
