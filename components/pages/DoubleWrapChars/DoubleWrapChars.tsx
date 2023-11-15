import * as React from 'react';
import cx from 'clsx';

import Head from 'components/misc/Head';
import Romper from '@/components/ui/Romper';

import grid from 'styles/modules/grid.module.scss';
import styles from './DoubleWrapChars.module.scss';

interface DoubleWrapCharsProps {
    font: { style: { fontFamily: string } };
}

const DoubleWrapChars: React.FC<DoubleWrapCharsProps> = ({ font }) => {
    const [enabled, setEnabled] = React.useState(true);

    const toggle = React.useCallback(() => {
        setEnabled(!enabled);
    }, [enabled]);

    return (
        <div className={cx(styles.root, grid.container)}>
            <Head title="Romper: Double-Wrapped Chars" description="Split Text Experiments" />
            <section className={styles.section}>
                <button className={styles.toggle} onClick={toggle}>
                    Toggle Romper
                </button>
                {enabled ? " (it's ON)" : " (it's OFF)"}
                <div className={styles.container}>
                    <Romper
                        enabled={enabled}
                        doubleWrap="chars"
                        splitLines={true}
                        fixKerning={true}
                        className={styles.romper}
                    >
                        The quick brown fox jumps over the lazy dog who then walks away.
                    </Romper>
                </div>
            </section>
        </div>
    );
};

export default DoubleWrapChars;
