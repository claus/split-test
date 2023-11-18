import * as React from 'react';
import cx from 'clsx';

import { splitChars, splitLines, cleanUp } from './utils';
import { fixKerning } from './utils/fixKerning';
import { moveChildNodes } from './utils/dom';
import { SplitOptions } from './utils/types';

import styles from './Romper.module.scss';

interface RomperProps extends SplitOptions {
    as?: React.ElementType<any>;
    enabled?: boolean;
    className?: string;
    children: React.ReactNode;
}

const Romper: React.FC<RomperProps> = props => {
    const {
        as: Container = 'div',
        enabled = false,
        graphemeSplitter = str => [...str.normalize('NFC')],
        kerningCache = new Map<string, number>(),
        kerningCacheKey = (a: string, b: string) => `romper-${a}-${b}`,
        splitLines: splitLinesProp = true,
        fixKerning: fixKerningProp = true,
        doubleWrap = 'none',
        className,
        children,
    } = props;

    const elSourceRef = React.useRef<HTMLElement>();
    const elSourceCloneRef = React.useRef<HTMLElement>();
    const resizeObserverRef = React.useRef<ResizeObserver>();
    const wrapperRef = React.useCallback(
        (elSource: HTMLElement) => {
            if (elSource) {
                if (enabled) {
                    console.time('split');

                    // Work on a clone of the source element
                    const elSplit = elSource.cloneNode(true) as HTMLElement;

                    elSourceCloneRef.current = elSource.cloneNode(true) as HTMLElement;
                    elSourceRef.current = elSource;

                    // Split characters and wrap them into spans
                    const blockBuckets = splitChars(elSource, elSplit, {
                        graphemeSplitter,
                        doubleWrap,
                    });

                    // Fix the kerning
                    fixKerning(elSource, elSplit, blockBuckets, {
                        kerningCache,
                        kerningCacheKey,
                        fixKerning: fixKerningProp,
                    });

                    // Split lines and wrap them into spans
                    splitLines(elSource, elSplit, blockBuckets, {
                        splitLines: splitLinesProp,
                        doubleWrap,
                    });

                    // Index chars and lines, add `data-type="romper"` to root element
                    cleanUp(elSource, elSplit, blockBuckets);

                    if (elSplit.parentNode) {
                        // Swap source element into the DOM
                        elSplit.parentNode?.replaceChild(elSource, elSplit);
                    }

                    elSource.innerHTML = '';
                    moveChildNodes(elSplit, elSource);
                    elSource.dataset.type = elSplit.dataset.type;
                    elSource.setAttribute('style', elSplit.getAttribute('style')!);

                    console.timeEnd('split');

                    resizeObserverRef.current = new ResizeObserver(([entry]) => {
                        // TO-TF-DO
                        // console.log(entry);
                        // splitLines(blockBuckets);
                        // cleanUp(elSplit, blockBuckets);
                    });
                    resizeObserverRef.current.observe(elSource);
                    return;
                }
            }
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = undefined;
            }
            if (elSourceRef.current && elSourceCloneRef.current) {
                elSourceRef.current.innerHTML = '';
                moveChildNodes(elSourceCloneRef.current, elSourceRef.current);
                delete elSourceRef.current.dataset.type;
                elSourceRef.current.removeAttribute('style');
                elSourceRef.current = undefined;
                elSourceCloneRef.current = undefined;
            }
        },
        [
            enabled,
            graphemeSplitter,
            kerningCache,
            kerningCacheKey,
            doubleWrap,
            splitLinesProp,
            fixKerningProp,
        ]
    );

    return (
        <Container ref={wrapperRef} className={cx(styles.root, className)}>
            {children}
        </Container>
    );
};

export default Romper;
