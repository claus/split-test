import { Html, Head, Main, NextScript } from 'next/document';
import { ThemeScript } from '@madeinhaus/nextjs-theme';

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                <ThemeScript />
            </Head>
            <body>
                <Main />
                <div id="__gridoverlay_portal__" />
                <NextScript />
            </body>
        </Html>
    );
}
