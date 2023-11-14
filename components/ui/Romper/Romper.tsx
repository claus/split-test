import * as React from 'react';
import cx from 'clsx';

import { cleanUp, split } from './utils';

import styles from './Romper.module.scss';
import { splitChars, splitLines } from '@/components/pages/Landing/splitter';
import { fixKerning } from './utils/fixKerning';

interface RomperProps {
    as?: React.ElementType<any>;
    enabled?: boolean;
    graphemeSplitter?: (str: string) => string[];
    className?: string;
    children: React.ReactNode;
}

const Romper: React.FC<RomperProps> = props => {
    const {
        as: Wrapper = 'div',
        enabled = false,
        graphemeSplitter = str => [...str.normalize('NFC')],
        className,
        children,
    } = props;

    const wrapperRef = React.useCallback(
        (el: HTMLElement) => {
            if (el) {
                if (enabled) {
                    const t = performance.now();
                    const elSplit = el.cloneNode(true) as HTMLElement;
                    const blockBuckets = splitChars(elSplit, { graphemeSplitter });
                    fixKerning(el, elSplit, blockBuckets);
                    const elTmp = elSplit.cloneNode(true) as HTMLElement;
                    splitLines(blockBuckets);
                    cleanUp(el, blockBuckets);
                    console.log(performance.now() - t);
                }
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
