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
            console.log(`-------\n${aKey}\n${bKey}`);
            return {
                key: `${aKey}\n${bKey}`,
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

    interface Wrapper extends Pair {
        wrapper: HTMLElement;
    }

    const wrappers: Wrapper[] = uniquePairs.map(({ key, elements }) => {
        const { span: a, path: aPath } = elements[0];
        const { span: b, path: bPath } = elements[1];
        const wrapper = document.createElement('div');
        const wrapperStyles = [
            // { property: 'all', value: 'unset' },
            { property: 'display', value: 'block' },
            { property: 'white-space', value: 'pre' },
            { property: 'width', value: 'fit-content' },
        ];
        wrapperStyles.forEach(({ property, value }) => wrapper.style.setProperty(property, value));
        let i = 0;
        let currentRoot: HTMLElement = wrapper;
        const maxPathLen = Math.max(aPath.length, bPath.length);
        while (aPath[i] === bPath[i] && i < maxPathLen) {
            if (aPath[i]) {
                const newRoot = aPath[i].cloneNode(false) as HTMLElement;
                currentRoot.appendChild(newRoot);
                currentRoot = newRoot;
            }
            i++;
        }
        let j = i;
        let aCurrentRoot = currentRoot;
        while (aPath[j]) {
            const isSpan = aPath[j] === a;
            const newEl = (
                isSpan ? aPath[j].firstChild?.cloneNode(true) : aPath[j].cloneNode(false)
            ) as HTMLElement;
            aCurrentRoot.appendChild(newEl);
            aCurrentRoot = newEl;
            j++;
        }
        let k = i;
        let bCurrentRoot = currentRoot;
        while (bPath[k]) {
            const isSpan = bPath[k] === b;
            const newEl = (
                isSpan ? bPath[k].firstChild?.cloneNode(true) : bPath[k].cloneNode(false)
            ) as HTMLElement;
            bCurrentRoot.appendChild(newEl);
            bCurrentRoot = newEl;
            k++;
        }
        // Normalize text nodes
        // Safari needs this
        function walk(node: Node, func: (node: Node) => void) {
            var children = node.childNodes;
            for (var i = 0; i < children.length; i++) walk(children[i], func);
            func(node);
        }
        walk(wrapper, node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                (node as HTMLElement).normalize();
            }
        });
        return {
            key,
            elements,
            wrapper,
        };
    });

    console.log(wrappers);

    // create a div and add all wrappers from measure to it
    const divKern = document.createElement('div');
    const divNoKern = document.createElement('div');
    wrappers.forEach(({ wrapper }) => {
        divKern.appendChild(wrapper).cloneNode(true);
        divNoKern.appendChild(wrapper.cloneNode(true));
    });

    const setDivStyles = (element: HTMLElement, kern: boolean) => {
        const styles = [
            { property: 'display', value: 'contents' },
            { property: 'font-kerning', value: kern ? 'normal' : 'none' },
            { property: 'font-feature-settings', value: `"kern" ${kern ? 'on' : 'off'}` },
        ];
        styles.forEach(({ property, value }) => element.style.setProperty(property, value));
    };

    divKern.dataset[dataTypeName] = 'kern';
    setDivStyles(divKern, true);
    elSplit.insertBefore(divKern, elSplit.firstChild);

    divNoKern.dataset[dataTypeName] = 'nokern';
    setDivStyles(divNoKern, false);
    elSplit.insertBefore(divNoKern, elSplit.firstChild);

    // Swap split element into the DOM
    el.parentNode?.replaceChild(elSplit, el);

    // Measure kerning values
    const fontSize = parseFloat(window.getComputedStyle(elSplit).getPropertyValue('font-size'));
    const kerningValues = mappable(wrappers.length).map(i => {
        const kernWidth = (divKern.childNodes[i] as HTMLElement).getBoundingClientRect().width;
        const noKernWidth = (divNoKern.childNodes[i] as HTMLElement).getBoundingClientRect().width;
        return (kernWidth - noKernWidth) / fontSize;
    });

    console.log(fontSize, kerningValues);

    // Swap original element back into the DOM
    elSplit.parentNode?.replaceChild(el, elSplit);

    elSplit.removeChild(divKern);
    elSplit.removeChild(divNoKern);

    pairs.forEach(({ key, elements }) => {
        const { span } = elements[0];
        console.log(`"${span.textContent}${elements[1].span.textContent}"`);
        const index = wrappers.findIndex(({ key: k }) => k === key);
        if (index !== -1) {
            if (kerningValues[index]) {
                span.style.setProperty('margin-right', `${kerningValues[index]}em`);
            }
        } else {
            console.log('not found', key);
        }
    });

    let charIndex = 0;
    spans.forEach(span => {
        const type = span.dataset[dataTypeNameInternal];
        const hasLetter = span.textContent?.trim().length; // TODO: Does this work for all kinds of whitespeces?
        if (type === 'char') {
            if (!hasLetter) {
                // This is a whitespace character, set `data-whitespace`
                span.dataset[dataTypeWhitespace] = '';
            }
            // Rename `data-type-internal` to `data-type`
            span.dataset[dataTypeName] = type;
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
    const test = React.useRef<HTMLDivElement>(null);
    const modified = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const splitter = new Graphemer();
        const elMod = modified.current;
        const elNormal = split(test.current!, {
            graphemeSplitter: string => splitter.splitGraphemes(string),
        });
        while (elMod?.firstChild && elMod?.lastChild) {
            elMod?.removeChild(elMod?.lastChild);
        }
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
                <h2 className={cx(styles.sectionHeadline, 'body')}>Test</h2>
                <div className={styles.test}>
                    <div
                        ref={test}
                        className={styles.normal}
                        dangerouslySetInnerHTML={{
                            // __html: 'X <![CDATA[ xxx ]]> <!-- --> <b><img class="abc" src=""></b>  <i>   A   <b>   B  </b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i> ',
                            __html: 'A <b>W</b>',
                            // __html: 'https://<a href="https://madeinhaus.com">madeinhaus.com</a>',
                            // __html: 'The quick brown fox <i><b>jumps</b></i> over the lazy dog.',
                            // __html: 'h̷̛͈͆̀͋͠e̷̢̮̩̙͐͒l̴̢̨̅͑l̸͍̩̗͌̄o̵̫͖̘̰̿̒͆̈́̍',
                            // __html: 'A<i>V<a href="https://madeinhaus.com">AV</a></i>AV',
                        }}
                    />
                    <div ref={modified} className={styles.modified} />
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
