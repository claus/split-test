import * as React from 'react';
import cx from 'clsx';

import { splitChars, splitLines, cleanUp } from './utils';
import { fixKerning } from './utils/fixKerning';
import { moveAttributes, moveChildNodes } from './utils/dom';
import { NodeInfoSplit, SplitOptions } from './utils/types';

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
        debug = false,
        className,
        children,
    } = props;

    const elSourceRef = React.useRef<HTMLElement>();
    const elSourceCloneRef = React.useRef<HTMLElement>();
    const resizeObserverRef = React.useRef<ResizeObserver>();

    const split = React.useCallback(
        (elSource: HTMLElement) => {
            debug && console.time('split');

            // Work on a clone of the source element
            const elSplit = elSource.cloneNode(true) as HTMLElement;

            elSourceCloneRef.current = elSource.cloneNode(true) as HTMLElement;
            elSourceRef.current = elSource;

            // Split characters and wrap them into spans
            const blockBuckets = splitChars(elSource, elSplit, {
                graphemeSplitter,
                doubleWrap,
                debug,
            });

            // Fix the kerning
            fixKerning(elSource, elSplit, blockBuckets, {
                kerningCache,
                kerningCacheKey,
                fixKerning: fixKerningProp,
                doubleWrap,
                debug,
            });

            // Split lines and wrap them into spans
            splitLines(elSource, elSplit, blockBuckets, {
                splitLines: splitLinesProp,
                doubleWrap,
                debug,
            });

            // Index chars and lines,
            // rename internal data-type attributes,
            // add `data-type="romper"` to root element
            cleanUp(elSource, elSplit, blockBuckets);

            moveChildNodes(elSplit, elSource);
            moveAttributes(elSplit, elSource);

            if (elSplit.parentNode) {
                // Swap source element into the DOM
                elSplit.parentNode?.replaceChild(elSource, elSplit);
            }

            debug && console.timeEnd('split');
        },
        [
            graphemeSplitter,
            kerningCache,
            kerningCacheKey,
            doubleWrap,
            splitLinesProp,
            fixKerningProp,
            debug,
        ]
    );

    const resizeObserverCallback = React.useCallback(
        ([entry]: ResizeObserverEntry[]) => {
            if (elSourceRef.current && elSourceCloneRef.current) {
                if (splitLinesProp) {
                    moveChildNodes(elSourceCloneRef.current, elSourceRef.current);
                    moveAttributes(elSourceCloneRef.current, elSourceRef.current);
                    split(elSourceRef.current);
                }
            } else {
                split(entry.target as HTMLElement);
            }
        },
        [split, splitLinesProp]
    );

    const wrapperRef = React.useCallback(
        (elSource: HTMLElement | null) => {
            if (elSource) {
                if (enabled) {
                    resizeObserverRef.current = new ResizeObserver(resizeObserverCallback);
                    resizeObserverRef.current.observe(elSource);
                    return;
                }
            }
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = undefined;
            }
            if (elSourceRef.current && elSourceCloneRef.current) {
                moveChildNodes(elSourceCloneRef.current, elSourceRef.current);
                moveAttributes(elSourceCloneRef.current, elSourceRef.current);
                elSourceRef.current = undefined;
                elSourceCloneRef.current = undefined;
            }
        },
        [enabled, resizeObserverCallback]
    );

    return (
        <Container ref={wrapperRef} className={cx(styles.root, className)}>
            {children}
        </Container>
    );
};

export default Romper;
