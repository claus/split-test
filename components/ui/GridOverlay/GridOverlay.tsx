import * as React from 'react';
import cx from 'clsx';

import Portal from '@madeinhaus/portal';

import grid from 'styles/modules/grid.module.scss';
import styles from './GridOverlay.module.scss';

const GridOverlay = () => {
    const [visible, setVisible] = React.useState(false);
    const isProduction = process.env.NODE_ENV === 'production';

    React.useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (!isProduction && target?.nodeName?.toLowerCase() !== 'input' && event.key === 'g') {
                setVisible(!visible);
            }
        };
        document.addEventListener('keypress', handleKey);
        return () => document.removeEventListener('keypress', handleKey);
    }, [visible, isProduction]);

    if (isProduction) {
        return null;
    }

    const className = cx(styles.gridOverlay, grid.container, {
        [styles.visible]: visible,
    });

    return (
        <Portal selector="#__gridoverlay_portal__">
            <div className={className}>
                {Array.from({ length: 12 }).map((_, i) => {
                    const columnClass = cx(styles.col, styles[`col${i + 1}`]);
                    return <div key={i} className={columnClass} />;
                })}
            </div>
        </Portal>
    );
};

export default GridOverlay;
