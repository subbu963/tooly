import $ from 'jquery';
import 'tooly.scss!';
const DEFAULT_OPTIONS = {

};
let elList = [];
let currWinHeight, currWinWidth;
let $window = $(window);
$window.resize(function (event) {
    console.log('window resized');
    currWinHeight = $window.height();
    currWinWidth = $window.width();
});
$.fn.tooly = function (options) {
    let _this = this;
    let type = $.type(options);
    if (type === 'object' || type === 'undefined') {
        options = $.extend({}, DEFAULT_OPTIONS, options);
        _this.data('tooly-options', options);
        elList.indexOf(_this) === -1 && elList.push(_this);
        let width = _this.width();
        let height = _this.height();
        _this.addClass('tooly');
    }
    return _this;
};
