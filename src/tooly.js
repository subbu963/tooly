import $ from 'jquery';
import {
    nextUID,
    createStyles
}
from 'utils';
import toolyTpl from 'tooly.html!text';
import 'tooly.scss!';
import InvalidPositionError from './errors/InvalidPositionError';
import ViewPortTooSmallError from './errors/ViewPortTooSmallError';
import NotInitializedError from './errors/NotInitializedError';

const DEFAULT_OPTIONS = {
    position: 'top'
};
const TARGET_CLASS_PREFIX = 'tooly-id-';
const CONTAINER_CLASS_PREFIX = 'tooly-container-id-';
const STYLE_PREFIX = 'tooly-style-id-';
const ANCHOR_HEIGHT = 10;
const TOOLY_OPTIONS = 'tooly-options';
const POSITIONS_ACCEPTED = ['top', 'bottom'];
let $window = $(window),
    $body = $('body');
let currWinHeight = $window.height(),
    currWinWidth = $window.width();
$window.resize(() => {
    console.log('window resized');
    currWinHeight = $window.height();
    currWinWidth = $window.width();
});

function _getNextPostion(position) {
    let currPosition = POSITIONS_ACCEPTED.indexOf(position);
    if (currPosition === POSITIONS_ACCEPTED.length - 1) {
        return 0;
    }
    return currPosition + 1;
}

function _getStyles(el, container, position = 'top', preferredPosition) {
    preferredPosition = preferredPosition || position;
    let options = el.data(TOOLY_OPTIONS);
    let elWidth = el.width(),
        elHeight = el.height(),
        elPosition = el.position();
    let containerWidth = container.width(),
        containerHeight = container.height(),
        containerId = `#${_getToolyContainerId(options.id)}`,
        containerTop = elPosition.top,
        containerLeft = elPosition.left,
        containerStyles, anchorStyles;
    if (position === 'top') {
        containerHeight += ANCHOR_HEIGHT;
        containerTop -= containerHeight;
        if (containerTop < 0) {
            let nextPosition = _getNextPostion(position);
            if (nextPosition === POSITIONS_ACCEPTED.indexOf(preferredPosition)) {
                throw new ViewPortTooSmallError('viewport too small!');
            }
            return _getStyles(el, container, POSITIONS_ACCEPTED[nextPosition], preferredPosition);
        }
        containerStyles = createStyles(containerId, {
            'top': `${containerTop}px`,
            'left': `${containerLeft}px`
        });
        anchorStyles = createStyles(`${containerId}:after`, {
            'left': '2em',
            'bottom': '-0.325em',
            'box-shadow': '1px 1px 0 0 #BABABC',
            'background': '#FFFFFF'
        });
    } else if (position === 'right') {
        containerWidth += ANCHOR_HEIGHT;
    } else if (position === 'bottom') {
        containerTop += elHeight + ANCHOR_HEIGHT;
        if (containerTop + containerHeight > currWinHeight) {
            let nextPosition = _getNextPostion(position);
            if (nextPosition === POSITIONS_ACCEPTED.indexOf(preferredPosition)) {
                throw new ViewPortTooSmallError('viewport too small!');
            }
            return _getStyles(el, container, POSITIONS_ACCEPTED[nextPosition], preferredPosition);
        }
        containerStyles = createStyles(containerId, {
            'top': `${containerTop}px`,
            'left': `${containerLeft}px`
        });
        anchorStyles = createStyles(`${containerId}:after`, {
            'left': '2em',
            'top': '-0.325em',
            'box-shadow': '-1px -1px 0 0 #BABABC'
        });
    } else {
        containerWidth += ANCHOR_HEIGHT;
    }
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

function _cleanup(el) {
    console.log('cleaning up!');
    let options = el.data(TOOLY_OPTIONS);
    let targetClass = `tooly ${_getToolyTargetClass(options.id)}`;
    $body
        .find(`.tooly.${_getToolyTargetClass(options.id)}`)
        .removeClass(`tooly ${_getToolyTargetClass(options.id)}`);
    $body
        .find(
            `#${_getToolyContainerId(options.id)},
            #${_getToolyStyleId(options.id)}`
        )
        .remove();
}

function _onMouseOver() {
    let _this = $(this);
    let options = _this.data(TOOLY_OPTIONS);
    console.log(options);
    let toolyContainer = $(toolyTpl).attr('id', _getToolyContainerId(options.id));
    _this.addClass(`tooly ${_getToolyTargetClass(options.id)}`);
    toolyContainer.find('.body-wrapper').html(options.html);
    $body.append(toolyContainer);
    try {
        $body.append(
            `<style id="${_getToolyStyleId(options.id)}">
            ${_getStyles(_this,toolyContainer,options.position)}</style>`
        );
    } catch (e) {
        _cleanup(_this);
        if (e instanceof ViewPortTooSmallError) {
            console.error(e.message);
        } else {
            throw e;
        }
    }
}

function _onMouseOut() {
    let _this = $(this);
    _cleanup(_this);
}

function _destroy(el) {
    _cleanup(el);
    el
        .removeData(TOOLY_OPTIONS)
        .off('mouseover', _onMouseOver)
        .off('mouseout', _onMouseOut);
}

function _tooly(options) {
    let _this = $(this);
    let type = $.type(options);
    if (type === 'object' || type === 'undefined') {
        options = $.extend({}, DEFAULT_OPTIONS, options);
        options.id = nextUID();
        if (POSITIONS_ACCEPTED.indexOf(options.position) === -1) {
            throw new InvalidPositionError(`${options.position} not recognized!`);
        }
        _this.data(TOOLY_OPTIONS, options);
        _this
            .mouseover(_onMouseOver)
            .mouseout(_onMouseOut);
    } else if (type === 'string') {
        let existingOptions = _this.data(TOOLY_OPTIONS);
        if (!existingOptions) {
            throw new NotInitializedError('tooly not initialized!');
        }
        switch (options) {
        case 'destroy':
            _destroy(_this);
            break;
        default:
        }
    }
}
$.fn.tooly = function (options) {
    for (let i = 0; i < this.length; i++) {
        _tooly.call(this[i], options);
    }

    return this;
};
