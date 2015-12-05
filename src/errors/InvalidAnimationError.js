import ExtendableError from './ExtendableError';

class InvalidAnimationError extends ExtendableError {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
export default InvalidAnimationError;
