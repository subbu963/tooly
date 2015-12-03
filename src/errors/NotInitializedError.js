import ExtendableError from './ExtendableError';

class NotInitializedError extends ExtendableError {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
export default NotInitializedError;
