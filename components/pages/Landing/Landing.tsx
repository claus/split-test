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

interface LandingProps {
    font: {
        style: {
            fontFamily: string;
        };
    };
}

const Landing: React.FC<LandingProps> = ({ font }) => {
    const sourceRef = React.useRef<HTMLDivElement>(null);
    const splitRef = React.useRef<HTMLDivElement>(null);
    const [fontLoaded, setFontLoaded] = React.useState(false);
    const [debugTime, setDebugTime] = React.useState('');

    React.useEffect(() => {
        if (fontLoaded && splitRef.current && sourceRef.current) {
            const splitter = new Graphemer();
            const elSplit = split(sourceRef.current, {
                graphemeSplitter: string => splitter.splitGraphemes(string),
                whitelistSelectors: ['img', 'svg', 'span.ignore'],
            });
            elSplit.classList.remove(styles.original);
            elSplit.classList.add(styles.split);
            splitRef.current.parentElement?.replaceChild(elSplit, splitRef.current);
        }
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
                    {/* <div
                        ref={sourceRef}
                        className={styles.original}
                        dangerouslySetInnerHTML={{
                            // __html: 'AVAV <b><img class="abc" src=""></b>  <i>  A 👩‍👩‍👧‍👧 B <b>  hello</b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i>   avav  <span class="ignore"> away   </span>  ',
                            // __html: 'AVAV <b><img class="abc" src=""></b>  <i>  A 👩‍👩‍👧‍👧 B <b>  hello</b></i>',
                            // __html: '<b>abc</b> <div>AVAVA</div> hello',
                            // __html: 'X <![CDATA[ xxx ]]> <!-- --> <b><img class="abc" src=""></b>  <i>   A 👩‍👩‍👧‍👧   <b>   B  </b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i> ',
                            // __html: 'A <b>W</b>',
                            // __html: 'W <i> A <a href="https://madeinhaus.com">A</a> </i>',
                            // __html: 'https://<a href="https://madeinhaus.com">madeinhaus.com</a>',
                            // __html: 'The quick brown fox <i><b>jumps</b></i> over avav lazy dog.',
                            // __html: 'h̷̛͈͆̀͋͠e̷̢̮̩̙͐͒l̴̢̨̅͑l̸͍̩̗͌̄o̵̫͖̘̰̿̒͆̈́̍',
                            // __html: 'a\u200Bbbb\u200Exyz\u200Fxyz\uFEFFg\th\ni\r\n j',
                            // __html: '<div>V<a class="hello" style="display: inline; position: relative; top: 10rem;" href="https://madeinhaus.com">AVAV</a><div style="padding: 2rem;">AV</div></div>',
                            // __html: 'A<div>V <a href="https://madeinhaus.com">AVAV</a></div>AV <i>AYAYAVAVAVAVAV AVAVAVAVAV</i> AVAVAVA',
                            // __html: 'AVATPAY dsdsadas dasdasdsa das das dasdas',
                            // __html: 'Tr<b>a</b>nsfor<i>m</i> avav br<b>a</b>nd',
                            __html: 'It even supports <img src="/images/check.svg" width="24" height="24"> SVG and images if you need them, how cool is that?',
                            //                             __html: `
                            // <div>
                            //     <h1>Headline</h1>
                            //     <p><span>The quick <b><s>i <i>avav</i> i</s></b></span> jumps <a href="https://madeinhaus.com">over the <b>lazy dog</b></a>. </p>
                            //     <div style="display: flex;">hello</div>
                            //     <ul>
                            //         <li>One</li>
                            //         <li>Two</li>
                            //         <li>Three</li>
                            //     </ul>
                            //     <h1>Headline</h1>
                            //     <p>The quick <b><i>brown</i></b> fox jumps <a href="https://madeinhaus.com">over the <b>lazy dog</b></a>. </p>
                            //     <div style="display: flex;">hello</div>
                            //     <ul>
                            //         <li>One</li>
                            //         <li>Two</li>
                            //         <li>Three</li>
                            //     </ul>
                            // </div>`,
                        }}
                    /> */}
                    <div ref={sourceRef} className={styles.original}>
                        <div>
                            Romper <ThumbsUpIcon /> supports <CheckIcon /> SVGs, images{' '}
                            <img src="/images/accordion.gif" width="220" height="220" alt="" /> and{' '}
                            <Link href="/">links</Link>, should <PersonIcon /> you ever{' '}
                            <HeartIcon /> need them.
                        </div>
                        <div style={{ marginTop: '0.4em' }}>
                            How cool <RocketIcon /> is that?
                        </div>
                    </div>
                    <div ref={splitRef} className={styles.split} />
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
