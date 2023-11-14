import * as React from 'react';

const CheckIcon = () => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
        >
            <circle
                cx={12}
                cy={12}
                r={10.5}
                fill="none"
                stroke="currentColor"
                strokeMiterlimit="10"
            />
            <path
                d="m6.27 12 3.82 3.82 7.64-7.64"
                fill="none"
                stroke="currentColor"
                strokeMiterlimit="10"
            />
        </svg>
    );
};

export default CheckIcon;
