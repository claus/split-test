export const pageComponentRoute = name => {
    return `export { default } from 'components/pages/${name}';
`;
};

export const pageComponentJS = name => {
    return `import * as React from 'react';

import styles from './${name}.module.scss';

interface ${name}Props {}

const ${name}: React.FC<${name}Props> = () => {
    return (
        <div className={styles.root}>

        </div>
    );
};

export default ${name};
`;
};

export const pageComponentSCSS = () => {
    return `@import 'styles/breakpoints';
@import 'styles/fonts';

.root {
}
`;
};

export const pageComponentIndex = name => {
    return `export { default } from './${name}';
`;
};
