import $ from 'jquery';
import {
    nextUID,
    createStyles
}
from 'utils';
import toolyTpl from 'tooly.html!text';
import 'tooly.scss!';
const DEFAULT_OPTIONS = {

};
const TARGET_CLASS_PREFIX = 'tooly-id-';
const CONTAINER_CLASS_PREFIX = 'tooly-container-id-';
const STYLE_PREFIX = 'tooly-style-id-';
const ANCHOR_HEIGHT = 10;
const TOOLY_OPTIONS = 'tooly-options';
let currWinHeight, currWinWidth;
let $window = $(window),
    $body = $('body');
$window.resize(() => {
    console.log('window resized');
    currWinHeight = $window.height();
    currWinWidth = $window.width();
});

function _getStyles(el, container) {
    let options = el.data(TOOLY_OPTIONS);
    let elWidth = el.width(),
        elHeight = el.height(),
        elPosition = el.position();
    let containerWidth = container.width(),
        containerHeight = container.height() + ANCHOR_HEIGHT,
        containerId = `#${_getToolyContainerId(options.id)}`;
    let containerTop = elPosition.top - containerHeight,
        containerLeft = elPosition.left;
    let containerStyles = createStyles(containerId, {
            top: containerTop + 'px',
            left: containerLeft + 'px'
        }),
        anchorStyles = createStyles(`${containerId}:after`, {
            left: '20px'
        });
    return containerStyles + anchorStyles;
}

function _getToolyContainerId(id) {
    return CONTAINER_CLASS_PREFIX + id;
}

function _getToolyTargetClass(id) {
    return TARGET_CLASS_PREFIX + id;
}

function _getToolyStyleId(id) {
    return STYLE_PREFIX + id;
}

function _onMouseOver() {
    let _this = this;
    let options = _this.data(TOOLY_OPTIONS);
    let toolyContainer = $(toolyTpl).attr('id', _getToolyContainerId(options.id));
    _this.addClass(`tooly ${_getToolyTargetClass(options.id)}`);
    $body.append(toolyContainer);
    toolyContainer.find('.body-wrapper').html(options.html);
    $body.append(`<style id="${_getToolyStyleId(options.id)}">${_getStyles(_this,toolyContainer)}</style>`);
}

function _onMouseOut() {
    let _this = this;
    let options = _this.data(TOOLY_OPTIONS);
    $body.find(`#${_getToolyContainerId(options.id)}, #${_getToolyStyleId(options.id)}`).remove();
}
$.fn.tooly = function (options) {
    let _this = this;
    let type = $.type(options);
    if (type === 'object' || type === 'undefined') {
        options = $.extend({}, DEFAULT_OPTIONS, options);
        options.id = nextUID();
        _this.data(TOOLY_OPTIONS, options);
        _this.mouseover(_onMouseOver.bind(_this));
        _this.mouseout(_onMouseOut.bind(_this));
    }
    return _this;
};
