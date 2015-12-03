let curUID = 1;

function nextUID() {
    return curUID++;
}

function createStyles(selector, styles) {
    let styleSheet = '';
    for (let style in styles) {
        if (styles.hasOwnProperty(style)) {
            styleSheet += `${style}:${styles[style]};`;
        }
    }
    return `${selector}{${styleSheet}}`;
}
export default {
    nextUID: nextUID,
    createStyles: createStyles
};
export {
    nextUID,
    createStyles
};
