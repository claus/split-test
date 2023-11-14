import * as React from 'react';

const PersonIcon = () => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
        >
            <path
                d="M2.45 7.23v1.91l5.73 1.91V22.5h1.91l.91-5.81a1 1 0 0 1 2 0l.89 5.81h1.91V11.05l5.73-1.91V7.23Z"
                fill="none"
                stroke="currentColor"
                strokeMiterlimit="10"
            />
            <circle
                cx={12}
                cy={4.36}
                r={2.86}
                fill="none"
                stroke="currentColor"
                strokeMiterlimit="10"
            />
        </svg>
    );
};

export default PersonIcon;
