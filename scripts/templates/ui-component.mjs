export const uiComponentJS = name => `import * as React from 'react';
import cx from 'clsx';

import styles from './${name}.module.scss';

interface ${name}Props {
    className?: string;
}

const ${name}: React.FC<${name}Props> = ({ className }) => {
    return (
        <div className={cx(styles.root, className)}>

        </div>
    );
};

export default ${name};
`;

export const uiComponentSCSS = () => `@import 'styles/breakpoints';
@import 'styles/fonts';

.root {
}
`;

export const uiComponentIndex = name => `export { default } from './${name}';
`;
