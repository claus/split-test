import * as React from 'react';
import cx from 'clsx';
import Graphemer from 'graphemer';

import { split } from './splitter';

import Head from 'components/misc/Head';

import grid from 'styles/modules/grid.module.scss';
import styles from './Landing.module.scss';

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
            });
            elSplit.classList.remove(styles.original);
            elSplit.classList.add(styles.split);
            splitRef.current.parentElement?.replaceChild(elSplit, splitRef.current);
            // setDebugTime(`Split: ${timeSplit.toFixed(4)}ms, Kern: ${timeKern.toFixed(4)}ms`);
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
                    <div
                        ref={sourceRef}
                        className={styles.original}
                        dangerouslySetInnerHTML={{
                            __html: 'AVAV <b><img class="abc" src=""></b>  <i>  A 👩‍👩‍👧‍👧 B <b>  hello</b> \u006E\u0303 <a href="https://madeinhaus.com">AVAVAV</a> </i>   avav  <span class="ignore"> away   </span>  ',
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
                    />
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
