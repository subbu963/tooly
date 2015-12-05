/**
 * InvalidPosition Error module.
 * @author Aditya Subramanyam
 * @module
 */

import ExtendableError from './ExtendableError';
/**
 * InvalidPosition Error
 */
class InvalidPositionError extends ExtendableError {
    /**
     * Create a InvalidPositionError.
     * @param {(string|string[])} message - The error message/messages.
     * @param {(string|string[])} fileName - The file/files in which the eror originated.
     * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
     */
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}

/** Export InvalidPositionError. */
export default InvalidPositionError;
