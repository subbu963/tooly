/**
 * Extendable Error module.
 * @author Aditya Subramanyam
 * @module
 */

/**
 * Extendable Error
 * Base class for errors to make them extendable. 
 * @interface
 */
class ExtendableError extends Error {
    /**
     * Create a ExtendableError.
     * @param {(string|string[])} message - The error message/messages.
     * @param {(string|string[])} fileName - The file/files in which the eror originated.
     * @param {(string|string[])} lineNumber - The line/lines at which error occurred.
     */
    constructor(message, fileName, lineNumber) {
        super(...arguments);
        this.name = this.constructor.name;
        this.message = message;
        this.stack = (new Error()).stack;
    }
}

/** Export ExtendableError. */
export default ExtendableError;
