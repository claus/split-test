import * as React from 'react';
import cx from 'clsx';

import styles from './Text.module.scss';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
    as?: React.ElementType<any>;
    theme?: string;
    className?: string;
    children: React.ReactNode;
}

const Text = React.forwardRef<HTMLElement, TextProps>((props, ref) => {
    const { as: Wrapper = 'p', theme = 'body', className, children, ...otherProps } = props;
    return (
        <Wrapper ref={ref} className={cx(styles[theme], className)} {...otherProps}>
            {children}
        </Wrapper>
    );
});

export default Text;
