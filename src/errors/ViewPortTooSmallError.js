import ExtendableError from './ExtendableError';

class ViewPortTooSmallError extends ExtendableError {
    constructor(message, fileName, lineNumber) {
        super(...arguments);
    }
}
export default ViewPortTooSmallError;
