/**
 * ViewPortTooSmall Error module.
 * @author Aditya Subramanyam
 * @module
 */

import ExtendableError from './ExtendableError';
/**
 * ViewPortTooSmall Error
 */
class ViewPortTooSmallError extends ExtendableError {
    /**
     * Create a ViewPortTooSmallError.
     * @param {(string|string[])} message - The error message/messages.
     * @param {(string|string[])} fileName - The file/files in which the eror originated.
     * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
     */

    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
/** Export ViewPortTooSmallError. */
export default ViewPortTooSmallError;
