import * as React from 'react';
import cx from 'clsx';

import { cleanUp } from './utils';

import styles from './Romper.module.scss';
import { splitChars, splitLines } from './utils';
import { fixKerning } from './utils/fixKerning';
import { moveChildNodes } from './utils/dom';

interface RomperProps {
    as?: React.ElementType<any>;
    enabled?: boolean;
    doubleWrap?: boolean;
    graphemeSplitter?: (str: string) => string[];
    className?: string;
    children: React.ReactNode;
}

const Romper: React.FC<RomperProps> = props => {
    const {
        as: Wrapper = 'div',
        enabled = false,
        doubleWrap = false,
        graphemeSplitter = str => [...str.normalize('NFC')],
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

                    // Swap split element into the DOM
                    elSource.parentNode?.replaceChild(elSplit, elSource);

                    const blockBuckets = splitChars(elSplit, { graphemeSplitter });

                    fixKerning(elSource, elSplit, blockBuckets);

                    splitLines(elSource, elSplit, blockBuckets);

                    cleanUp(elSplit, blockBuckets);

                    // Swap source element into the DOM
                    elSplit.parentNode?.replaceChild(elSource, elSplit);

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
        [enabled, graphemeSplitter]
    );

    return (
        <Wrapper ref={wrapperRef} className={cx(styles.root, className)}>
            {children}
        </Wrapper>
    );
};

export default Romper;
