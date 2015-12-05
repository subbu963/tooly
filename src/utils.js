/**
 * Utils module.
 * @author Aditya Subramanyam
 * @module
 */

/**
 * A unique identifier.
 * @type {number}
 */
let curUID = 1;

/**
 * Generates a unique identifier.
 * @return {number} A unique identifier
 */
function nextUID() {
    return curUID++;
}

/**
 * Given a hashmap of styles and a selector returns a string of css styles.
 * @param {string} selector selector
 * @param {object} styles styles to add to the selector
 * @return {string} string of css styles
 */
function createStyles(selector, styles) {
    let styleSheet = '';
    for (let style in styles) {
        if (styles.hasOwnProperty(style)) {
            styleSheet += `${style}:${styles[style]};`;
        }
    }
    return `${selector}{${styleSheet}}`;
}
/** 
 * Export the whole utils.
 */
export default {
    nextUID: nextUID,
    createStyles: createStyles
};
/** 
 * Export individual utils.
 */
export {
    nextUID,
    createStyles
};
