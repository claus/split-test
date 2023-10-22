import * as React from 'react';

import Head from 'components/misc/Head';

import styles from './Error.module.scss';

export interface ErrorProps {
    statusCode: number | string;
    message: string;
}

const Error: React.FC<ErrorProps> = ({ statusCode, message }) => {
    return (
        <div className={styles.root}>
            <Head title={`${statusCode} | ${message}`} />
            <p>{statusCode}</p>
        </div>
    );
};

export default Error;
