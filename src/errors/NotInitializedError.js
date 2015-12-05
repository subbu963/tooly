/**
 * NotInitialized Error module.
 * @author Aditya Subramanyam
 * @module
 */

import ExtendableError from './ExtendableError';
/**
 * NotInitialized Error
 */
class NotInitializedError extends ExtendableError {
    /**
     * Create a NotInitializedError.
     * @param {(string|string[])} message - The error message/messages.
     * @param {(string|string[])} fileName - The file/files in which the eror originated.
     * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
     */
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
/** Export NotInitializedError. */
export default NotInitializedError;
