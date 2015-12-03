import ExtendableError from './ExtendableError';

class InvalidPositionError extends ExtendableError {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
export default InvalidPositionError;
