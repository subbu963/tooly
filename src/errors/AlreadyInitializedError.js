import ExtendableError from './ExtendableError';

class AlreadyInitializedError extends ExtendableError {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
export default AlreadyInitializedError;
