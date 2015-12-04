class ExtendableError extends Error {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
        this.name = this.constructor.name;
        this.message = message;
        this.stack = (new Error()).stack;
    }
}
export default ExtendableError;
