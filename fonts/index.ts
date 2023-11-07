import localFont from 'next/font/local';

export const hausHeadlineFont = localFont({
    src: '../fonts/HAUSHeadlineVariable-VariableVF.ttf',
    weight: '100 900',
    adjustFontFallback: false,
    variable: '--haus-headline-font',
});
