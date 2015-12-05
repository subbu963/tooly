/**
 * AlreadyInitialized Error module.
 * @author Aditya Subramanyam
 * @module
 */

import ExtendableError from './ExtendableError';
/**
 * AlreadyInitialized Error
 */
class AlreadyInitializedError extends ExtendableError {
    /**
     * Create a AlreadyInitializedError.
     * @param {(string|string[])} message - The error message/messages.
     * @param {(string|string[])} fileName - The file/files in which the eror originated.
     * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
     */
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}

/** Export AlreadyInitializedError. */
export default AlreadyInitializedError;
