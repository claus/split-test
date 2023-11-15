import * as React from 'react';
import cx from 'clsx';

import { useTheme } from '@madeinhaus/nextjs-theme';
import { Link } from '@madeinhaus/nextjs-page-transition';

import grid from 'styles/modules/grid.module.scss';
import styles from './Header.module.scss';

interface HeaderProps {
    className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
    const { theme, setTheme } = useTheme() ?? {};

    const handleThemeClick = (theme: string) => () => {
        setTheme?.(theme);
    };

    return (
        <div className={cx(styles.root, className)}>
            <div className={cx(styles.container, grid.container)}>
                <h1 className={cx(styles.home, 'body')}>
                    <Link href="/">Romper</Link>
                </h1>
                <ul data-title="Theme:" className={cx(styles.themeToggle, 'body')}>
                    {['auto', 'light', 'dark'].map(themeValue => (
                        <li key={themeValue}>
                            <button
                                onClick={handleThemeClick(themeValue)}
                                disabled={themeValue === theme}
                                className={styles.themeButton}
                            >
                                {themeValue}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Header;
