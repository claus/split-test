import * as React from 'react';
import cx from 'clsx';
import Graphemer from 'graphemer';

import { split } from './splitter';

import Head from 'components/misc/Head';
import CheckIcon from './svg/check';
import HeartIcon from './svg/heart';
import PersonIcon from './svg/person';
import RocketIcon from './svg/rocket';
import ThumbsUpIcon from './svg/thumbsup';

import grid from 'styles/modules/grid.module.scss';
import styles from './Landing.module.scss';
import { Link } from '@madeinhaus/nextjs-page-transition';
import Romper from '@/components/ui/Romper';

interface LandingProps {
    font: { style: { fontFamily: string } };
}

const Landing: React.FC<LandingProps> = ({ font }) => {
    const [fontLoaded, setFontLoaded] = React.useState(false);
    const [enabled, setEnabled] = React.useState(true);

    const toggle = React.useCallback(() => {
        setEnabled(!enabled);
    }, [enabled]);

    React.useEffect(() => {
        const WebFont = require('webfontloader');
        WebFont.load({
            custom: { families: [font.style.fontFamily] },
            active: () => {
                setFontLoaded(true);
            },
        });
    }, [font.style.fontFamily]);

    return (
        <div className={cx(styles.root, grid.container)}>
            <Head title="Split Text" description="Split Text Experiments" />
            <section className={styles.section}>
                <button className={styles.toggle} onClick={toggle}>
                    Toggle Romper
                </button>
                {enabled ? " (it's ON)" : " (it's OFF)"}
                <div className={styles.test}>
                    <Romper
                        enabled={fontLoaded && enabled}
                        doubleWrap="none"
                        className={styles.original}
                    >
                        <div>
                            Romper <ThumbsUpIcon /> supports <CheckIcon /> SVGs, images{' '}
                            <img src="/images/accordion.gif" width="220" height="220" alt="" /> and{' '}
                            <Link href="/">links</Link>, should <PersonIcon /> you ever{' '}
                            <HeartIcon /> need them.
                        </div>
                        <div style={{ marginTop: '0.4em' }}>
                            How cool <RocketIcon /> is that?
                        </div>
                    </Romper>
                </div>
            </section>
        </div>
    );
};

export default Landing;
