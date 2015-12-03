class ExtendableError extends Error {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
        this.name = this.constructor.name;
        this.message = message;
        Error.captureStackTrace(this, this.constructor.name)
    }
}
export default ExtendableError;
