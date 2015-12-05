/**
 * Tooly module.
 * @author Aditya Subramanyam
 * @module
 */
import $ from 'jquery';
import {
    nextUID,
    createStyles
}
from 'utils';
import toolyTpl from 'tooly.html!text';
import 'tooly.scss!';
import InvalidPositionError from './errors/InvalidPositionError';
import InvalidAnimationError from './errors/InvalidAnimationError';
import ViewPortTooSmallError from './errors/ViewPortTooSmallError';
import NotInitializedError from './errors/NotInitializedError';
import AlreadyInitializedError from './errors/AlreadyInitializedError';

/** 
 * Default tooly options
 * @constant
 * @default
 * @type {object}
 */
const DEFAULT_OPTIONS = {
    position: 'top',
    animation: 'opacity'
};
/** 
 * Prefix of class that will be applied to the target element
 * @constant
 * @type {string}
 */
const TARGET_CLASS_PREFIX = 'tooly-id-';
/** 
 * Prefix of id that will be applied to the container element
 * @constant
 * @type {string}
 */
const CONTAINER_ID_PREFIX = 'tooly-container-id-';
/** 
 * Prefix of id that will be applied to the style element
 * @constant
 * @type {string}
 */
const STYLE_PREFIX = 'tooly-style-id-';
/** 
 * Anchor elements visible diagonal length
 * @constant
 * @type {number}
 */
const ANCHOR_HEIGHT = 9;
/** 
 * Key of data object stored in the element
 * @constant
 * @type {string}
 */
const TOOLY_OPTIONS = 'tooly-options';
/** 
 * Positions accepted when initializing tooly
 * @constant
 * @type {string[]}
 */
const POSITIONS_ACCEPTED = ['top', 'right', 'bottom', 'left'];
/** 
 * Animations accepted when initializing tooly
 * @constant
 * @type {string[]}
 */
const ANIMATIONS_ACCEPTED = ['opacity', 'slide'];
/** 
 * Prefix of class that will be applied to animate the container
 * @constant
 * @type {string}
 */
const ANIMATE_CLASS_PREFIX = 'animate-';
/** 
 * Default anchor styles
 * @constant
 * @default
 * @type {object}
 */
const DEFAULT_ANCHOR_STYLES = {
    top: {
        'bottom': '-5px',
        'left': '32px',
        'box-shadow': '1px 1px 0 0 #BABABC'
    },
    right: {
        'top': '5px',
        'left': '-5px',
        'box-shadow': '-1px 1px 0 0 #BABABC'
    },
    bottom: {
        'top': '-5px',
        'left': '32px',
        'box-shadow': '-1px -1px 0 0 #BABABC'
    },
    left: {
        'top': '5px',
        'right': '-5px',
        'box-shadow': '1px -1px 0 0 #BABABC'
    }
};
/** 
 * Jquery wrapped window
 * @type {jQuery}
 */
let $window = $(window);
/** 
 * Jquery wrapped body
 * @type {jQuery}
 */
let $body = $('body');
/** 
 * Current window height
 * @default
 * @type {number}
 */
let currWinHeight = $window.height();
/** 
 * Current window width
 * @default
 * @type {number}
 */
let currWinWidth = $window.width();
$window.resize(() => {
    console.log('window resized');
    currWinHeight = $window.height();
    currWinWidth = $window.width();
});
/**
 * Returns the next possible position to try
 * @param {string} position position
 * @return {number} index of next position in POSITIONS_ACCEPTED
 */
function _getNextPostion(position) {
    let currPosition = POSITIONS_ACCEPTED.indexOf(position);
    if (currPosition === POSITIONS_ACCEPTED.length - 1) {
        return 0;
    }
    return currPosition + 1;
}
/**
 * Checks whether the tooltip will fit in the window
 * @param {number} containerLeft distance of container from left
 * @param {number} containerTop distance of container from top
 * @param {number} containerHeight container height
 * @param {number} containerWidth container width
 * @param {string} position position
 * @return {boolean} whether tooltip will fit or not
 */
function _tooltipWillFit(containerLeft, containerTop, containerHeight, containerWidth, position) {
    switch (position) {
    case 'top':
        return (containerTop >= 0) && (containerLeft + containerWidth <= currWinWidth);
    case 'right':
        return (containerLeft + containerWidth <= currWinWidth) && (containerTop + containerHeight <= currWinHeight);
    case 'bottom':
        return (containerTop + containerHeight <= currWinHeight) && (containerLeft + containerWidth <= currWinWidth);
    case 'left':
        return (containerLeft >= 0) && (containerTop + containerHeight <= currWinHeight);
    }
}
/**
 * Calculates the styles and position of the container that needs to be applied
 * @param {jQuery} el target element
 * @param {jQuery} container element for which the styles and position needs to be calculated
 * @param {string} position position
 * @param {string} preferredPosition Preferred position of tooly
 * @return {object} object containing styles and position
 */
function _getStylesAndPos(el, container, position, preferredPosition) {
    preferredPosition = preferredPosition || position;
    let options = el.data(TOOLY_OPTIONS);
    let elWidth = el.width(),
        elHeight = el.height(),
        elPosition = el.offset();
    let containerWidth = container.width(),
        containerHeight = container.height(),
        containerId = `#${_getToolyContainerId(options.id)}`,
        containerTop = elPosition.top - $window.scrollTop(),
        containerLeft = elPosition.left - $window.scrollLeft(),
        containerStyles, anchorStyles;
    switch (position) {
    case 'top':
        containerHeight += ANCHOR_HEIGHT;
        containerTop -= containerHeight;
        break;
    case 'right':
        containerLeft += elWidth + ANCHOR_HEIGHT;
        break;
    case 'bottom':
        containerTop += elHeight + ANCHOR_HEIGHT;
        break;
    case 'left':
        containerWidth += ANCHOR_HEIGHT;
        containerLeft -= containerWidth;
        break;
    }
    if (!_tooltipWillFit(containerLeft, containerTop, containerHeight, containerWidth, position)) {
        let nextPosition = _getNextPostion(position);
        if (nextPosition === POSITIONS_ACCEPTED.indexOf(preferredPosition)) {
            throw new ViewPortTooSmallError('viewport too small!');
        }
        return _getStylesAndPos(el, container, POSITIONS_ACCEPTED[nextPosition], preferredPosition);
    }
    containerStyles = createStyles(containerId, {
        'top': `${containerTop}px`,
        'left': `${containerLeft}px`
    });
    anchorStyles = createStyles(
        `${containerId}:before`,
        DEFAULT_ANCHOR_STYLES[position]
    );
    return {
        styles: containerStyles + anchorStyles,
        position: position
    };
}
/**
 * Returns the id of a tooly container
 * @param {number} id id of tooly
 * @return {string} container id
 */
function _getToolyContainerId(id) {
    return CONTAINER_ID_PREFIX + id;
}
/**
 * Returns the class of a tooly target
 * @param {number} id id of tooly
 * @return {string} target class
 */
function _getToolyTargetClass(id) {
    return TARGET_CLASS_PREFIX + id;
}
/**
 * Returns the id of a tooly style element
 * @param {number} id id of tooly
 * @return {string} style id
 */
function _getToolyStyleId(id) {
    return STYLE_PREFIX + id;
}
/**
 * Cleanups styles and containers appended to the document
 * @param {jQuery} el tooly target
 */
function _cleanup(el) {
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
/**
 * Animates the container
 * @param {jQuery} toolyContainer tooly container
 * @param {string} animationClass class that needs to be applied to the tooly target
 */
function _animateContainer(toolyContainer, animationClass) {
    toolyContainer
        .addClass(ANIMATE_CLASS_PREFIX + animationClass)
        .animate({
            opacity: 1,
            margin: 0
        }, 100);
}
/**
 * Returns the id of a tooly style element
 * @param {jQuery} el tooly target
 * @param {jQuery} toolyContainer tooly container
 * @param {string} position position
 * @param {string} animation animation that needs to be applied to the tooly target
 */
function _animate(el, toolyContainer, position, animation) {
    switch (animation) {
    case 'slide':
        _animateContainer(toolyContainer, `${animation}-${position}`);
        break;
    default:
        _animateContainer(toolyContainer, animation);
    }
}
/**
 * Callback for mouseover on a tooly target
 * @listens mouseover
 */
function _onMouseOver() {
    let _this = $(this);
    let options = _this.data(TOOLY_OPTIONS);
    let toolyContainer = $(toolyTpl).attr('id', _getToolyContainerId(options.id));
    _this.addClass(`tooly ${_getToolyTargetClass(options.id)}`);
    toolyContainer.find('.body-wrapper').html(options.html);
    $body.append(toolyContainer);
    try {
        let stylesAndPos = _getStylesAndPos(_this, toolyContainer, options.position);
        $body.append(
            `<style id="${_getToolyStyleId(options.id)}">${stylesAndPos.styles}</style>`
        );
        _animate(_this, toolyContainer, stylesAndPos.position, options.animation);
    } catch (e) {
        _cleanup(_this);
        if (e instanceof ViewPortTooSmallError) {
            console.error(e.message);
        } else {
            //rethrow the error to be caught by error loggers like ravenjs/errorception
            throw e;
        }
    }
}
/**
 * Callback for mouseout on a tooly target
 * @listens mouseout
 */
function _onMouseOut() {
    let _this = $(this);
    _cleanup(_this);
}
/**
 * Destroy's a tooly target
 * @param {jQuery} el tooly target
 */
function _destroy(el) {
    _cleanup(el);
    el
        .removeData(TOOLY_OPTIONS)
        .off('mouseover', _onMouseOver)
        .off('mouseout', _onMouseOut);
}
/**
 * Verifies the options provided are valid or not
 * @param {object} tooly options
 */
function _verifyOptions(options) {
    if (POSITIONS_ACCEPTED.indexOf(options.position) === -1) {
        throw new InvalidPositionError(`${options.position} not recognized!`);
    }
    if (ANIMATIONS_ACCEPTED.indexOf(options.animation) === -1) {
        throw new InvalidAnimationError(`${options.animation} not recognized!`);
    }
}
/**
 * Tooly internal initializer
 * @param {object} tooly options
 */
function _tooly(options) {
    let _this = $(this);
    let type = $.type(options);
    let existingOptions = _this.data(TOOLY_OPTIONS);
    if (type === 'object' || type === 'undefined') {
        if (existingOptions) {
            throw new AlreadyInitializedError('tooly already initialized!');
        }
        options = $.extend({}, DEFAULT_OPTIONS, options);
        options.id = nextUID();
        _verifyOptions(options);
        _this.data(TOOLY_OPTIONS, options);
        _this
            .mouseover(_onMouseOver)
            .mouseout(_onMouseOut);
    } else if (type === 'string') {
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
/**
 * Tooly external initializer
 * @param {object} tooly options
 */
$.fn.tooly = function (options) {
    for (let i = 0; i < this.length; i++) {
        _tooly.call(this[i], options);
    }

    return this;
};
/** 
 * Export jquery.
 */
export default $;
