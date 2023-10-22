import * as React from 'react';
import Head from 'next/head';

export interface PageHeadProps {
    title: string;
    description?: string;
    url?: string;
    image?: string;
    preloads?: {
        type: string;
        href: string;
        crossOrigin: '' | 'anonymous' | 'use-credentials' | undefined;
    }[];
}

const PageHead: React.FC<PageHeadProps> = ({ title, description, image, url, preloads = [] }) => {
    return (
        // prettier-ignore
        <Head>
            <title key="title">{title}</title>
            {description && <meta key="description" name="description" content={description} />}
            {description && <meta key="og-description" property="og:description" content={description} />}
            {image && <meta key="og-image" property="og:image" content={image} />}
            {url && <meta key="og-url" property="og:url" content={url} />}
            <meta key="og-type" property="og:type" content="website" />
            <meta key="tw-card" name="twitter:card" content="summary_large_image" />
            <meta key="tw-creator" name="twitter:creator" content="@madeinhaus" />
            {preloads.map(preload => {
                const props = {
                    rel: "preload",
                    as: "image",
                    ...preload,
                }
                return <link key={preload.href} {...props} />;
            })}
        </Head>
    );
};

export default PageHead;
