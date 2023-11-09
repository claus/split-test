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
    totalCustomProp?: string;
    /* Whitelist of selectors to wrap in spans. Default: ["img", "svg"] */
    whitelistSelectors?: string[];
    /* Whether to adjust kerning. Default: true */
    adjustKerning?: boolean;
    /* Function to split a string into characters/graphemes. Default: string => [...string.normalize('NFC')] */
    graphemeSplitter?: (str: string) => string[];
}

type WalkResult = {
    node: Node;
    nearestBlockLevelParent: Node;
    isBlockLevel?: boolean;
    text?: string;
};

function* walk(
    node: Node,
    matcher: (node: Node) => boolean = () => true,
    nearestBlockLevelParent: Node = node
): IterableIterator<WalkResult> {
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

function toSelector(node: Element, attributeIgnoreList: string[] = []) {
    attributeIgnoreList = [...new Set([...attributeIgnoreList, 'id', 'class'])];
    let selector = node.nodeName.toLowerCase();
    const id = node.getAttribute('id');
    if (id != null) {
        selector += '#' + id;
    }
    selector += Array.from(node.classList)
        .map(className => `.${className}`)
        .join('');
    selector += Array.from(node.attributes)
        .filter(({ name }) => !attributeIgnoreList.includes(name))
        .map(({ name, value }) => (value ? `[${name}="${value}"]` : `[${name}]`))
        .join('');
    return selector;
}

function split(
    el: HTMLElement,
    options: SplitOptions = {}
): { elSplit: HTMLElement; timeSplit: number; timeKern: number } {
    const {
        dataTypeName = 'type',
        dataTypeWhitespace = 'whitespace',
        indexCustomProp = '--index',
        totalCustomProp = '--total',
        whitelistSelectors = ['img', 'svg', 'span.ignore'],
        adjustKerning = true,
        graphemeSplitter = string => [...string.normalize('NFC')],
    } = options;
    const dataTypeNameInternal = `${dataTypeName}internal`;

    const splitLines = (node: Node) => {
        const t = performance.now();
        const iterator = walk(node, (node: Node) => node.nodeType === Node.TEXT_NODE);
        const blockBuckets = [...iterator]
            .filter(({ text }) => (text?.length ?? 0) > 0)
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
            }, [] as WalkResult[][])
            .map(blockBucket =>
                blockBucket.map(textElement => {
                    const { node, text } = textElement;
                    // Wrap each character in a span
                    const fragment = document.createDocumentFragment();
                    const spans = graphemeSplitter(text!).map(char => {
                        const span = document.createElement('span');
                        span.dataset[dataTypeNameInternal] = 'char';
                        span.textContent = char;
                        fragment.appendChild(span);
                        return span;
                    });
                    node.parentNode?.replaceChild(fragment, node);
                    const graphemes = spans.map(span => ({
                        rect: (span as HTMLElement).getBoundingClientRect(),
                        span,
                    }));
                    return { ...textElement, graphemes };
                })
            );
        // console.log(blockBuckets);
        return performance.now() - t;
    };

    // const span = document.createElement('span');
    // span.dataset[dataTypeName] = 'line';
    // ...
    // rootEl.appendChild(span);

    // Swap split element into the DOM
    const elSplit = el.cloneNode(true) as HTMLElement;
    el.parentNode?.replaceChild(elSplit, el);

    // Do the splitting
    const timeSplit = splitLines(elSplit);

    // Swap original element back into the DOM
    elSplit.parentNode?.replaceChild(el, elSplit);

    const spans = Array.from(
        elSplit.querySelectorAll<HTMLSpanElement>(`[data-${dataTypeNameInternal}]`)
    );

    // console.log(spans);
    const t = performance.now();

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
            function getPathAndSelector(
                rootEl: HTMLElement,
                childEl: HTMLElement
            ): [HTMLElement[], string] {
                const path: HTMLElement[] = [childEl];
                let el = childEl;
                while (el.parentElement && el.parentElement !== rootEl) {
                    el = el.parentElement;
                    path.unshift(el);
                }
                const selector = path
                    .map(el => {
                        const selector = toSelector(el, [`data-${dataTypeNameInternal}`]);
                        const text = el === childEl ? el.textContent ?? '' : '';
                        return selector + (text.length ? ` \{${text}}` : '');
                    })
                    .join(' > ');
                return [path, selector];
            }
            const [aPath, aKey] = getPathAndSelector(elSplit, a);
            const [bPath, bKey] = getPathAndSelector(elSplit, b);
            // console.log(`-------\n${aKey} # ${bKey}`);
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
        if (!pairSet.has(key)) {
            pairSet.add(key);
            return true;
        }
        return false;
    });

    // console.log(uniquePairs);

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
        // walk(measureEl, node => {
        //     if (node.nodeType === Node.ELEMENT_NODE) {
        //         (node as HTMLElement).normalize();
        //     }
        // });
        return {
            key,
            elements,
            wrapper: measureEl,
        };
    });

    // console.log(measureElements);

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

    // console.log(kerningValues);

    // Swap original element back into the DOM
    elSplit.parentNode?.replaceChild(el, elSplit);

    elSplit.removeChild(measureDivKern);
    elSplit.removeChild(measureDivNoKern);

    // Apply kerning values
    // For all pairs, find
    pairs.forEach(({ key, elements }) => {
        const { span } = elements[0];
        // console.log(`"${elements[0].span.textContent}${elements[1].span.textContent}"`);
        const index = measureElements.findIndex(({ key: k }) => k === key);
        if (index !== -1) {
            if (kerningValues[index]) {
                span.style.setProperty('margin-right', `${kerningValues[index]}em`);
            }
        } else {
            console.log(`Kerning pair not found: {${key}}`);
        }
    });

    let charIndex = 0;
    spans.forEach(span => {
        const type = span.dataset[dataTypeNameInternal];
        const hasLetter = !span.textContent?.match(/[ \n\t\u200B\u200E\u200F\uFEFF]+/);
        if (type === 'char') {
            // Rename internal data type attribute to public facing one
            // and set the value to 'whitespace' if it's a whitespace character
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

    elSplit.style.setProperty(totalCustomProp, charIndex.toString());
    // console.log(charIndex, elSplit);

    const timeKern = performance.now() - t;
    // console.log(performance.now() - t);
    return { elSplit, timeSplit, timeKern };
}

interface LandingProps {
    font: {
        style: {
            fontFamily: string;
        };
    };
}

const Landing: React.FC<LandingProps> = ({ font }) => {
    const original = React.useRef<HTMLDivElement>(null);
    const modified = React.useRef<HTMLDivElement>(null);
    const [debugTime, setDebugTime] = React.useState('');
    const [fontLoaded, setFontLoaded] = React.useState(false);

    React.useEffect(() => {
        if (!modified.current || !original.current) return;
        if (!fontLoaded) return;
        const splitter = new Graphemer();
        const elMod = modified.current;
        const {
            elSplit: elNormal,
            timeSplit,
            timeKern,
        } = split(original.current!, {
            graphemeSplitter: string => splitter.splitGraphemes(string),
        });
        elMod.parentElement?.replaceChild(elNormal, elMod);
        elNormal.classList.remove(styles.original);
        elNormal.classList.add(styles.split);
        setDebugTime(`Split: ${timeSplit.toFixed(4)}ms, Kern: ${timeKern.toFixed(4)}ms`);
    }, [fontLoaded]);

    React.useEffect(() => {
        const WebFont = require('webfontloader');
        WebFont.load({
            custom: { families: [font.style.fontFamily] },
            active: () => {
                setFontLoaded(true);
            },
        });
    });

    return (
        <div className={cx(styles.root, grid.container)}>
            <Head title="Split Text" description="Split Text Experiments" />
            <section className={styles.section}>
                <h3 style={{ marginBottom: '1em' }}>{debugTime}</h3>
                <div className={styles.test}>
                    <div
                        ref={original}
                        className={styles.original}
                        dangerouslySetInnerHTML={{
                            // __html: 'X <b><img class="abc" src=""></b>  <i>  A 👩‍👩‍👧‍👧 B <b>  hello</b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i>   AWAY  <span class="ignore"> away   </span>  ',
                            // __html: 'X <![CDATA[ xxx ]]> <!-- --> <b><img class="abc" src=""></b>  <i>   A 👩‍👩‍👧‍👧   <b>   B  </b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i> ',
                            // __html: 'A <b>W</b>',
                            // __html: 'W <i> A <a href="https://madeinhaus.com">A</a> </i>',
                            // __html: 'https://<a href="https://madeinhaus.com">madeinhaus.com</a>',
                            // __html: 'The quick brown fox <i><b>jumps</b></i> over the lazy dog.',
                            // __html: 'h̷̛͈͆̀͋͠e̷̢̮̩̙͐͒l̴̢̨̅͑l̸͍̩̗͌̄o̵̫͖̘̰̿̒͆̈́̍',
                            // __html: 'a\u200Bbbb\u200Exyz\u200Fxyz\uFEFFg\th\ni\r\n j',
                            // __html: '<div>V<a class="hello" style="display: inline; position: relative; top: 10rem;" href="https://madeinhaus.com">AVAV</a><div style="padding: 2rem;">AV</div></div>',
                            // __html: 'A<div>V <a href="https://madeinhaus.com">AVAV</a></div>AV <i>AYAYAVAVAVAVAV AVAVAVAVAV</i> AVAVAVA',
                            // __html: 'AVATPAY',
                            // __html: 'Tr<b>a</b>nsfor<i>m</i> avav br<b>a</b>nd',
                            __html: `
<div>
    <h1>Headline</h1>
    <p>The quick <b><i>brown avavav </i></b> fox jumps <a href="https://madeinhaus.com">over the <b>lazy dog</b></a>. </p>
    <div style="display: flex;">hello</div>
    <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
    </ul>
    <h1>Headline</h1>
    <p>The quick <b><i>brown</i></b> fox jumps <a href="https://madeinhaus.com">over the <b>lazy dog</b></a>. </p>
    <div style="display: flex;">hello</div>
    <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
    </ul>
</div>`,
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
