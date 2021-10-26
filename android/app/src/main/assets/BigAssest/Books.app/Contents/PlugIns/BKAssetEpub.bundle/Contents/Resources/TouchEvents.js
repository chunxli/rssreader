//
//  TouchEvents.js
//
//  Emulates TouchEvents in Desktop WebKit
//
//  Created by Patrick Beard on 5/29/13.
//  Copyright (c) 2013 Apple Inc. All rights reserved.
//

(function() {
var TouchEvents = new Object();

TouchEvents.emulateTouchEvents = function() {
    // walk all the elements using a DOM tree walker. if the element contains one of the following
    // ontouch* event handler attributes, but contains no equivalent mouse event handlers, then we
    // inject mouse event handlers that forward fake touch events to the touch handlers.
    var nodeFilter = function(node) {
        if (node.nodeType == Node.ELEMENT_NODE) {
            var attrs = node.attributes;
            for (var i = 0, count = attrs.length; i < count; ++i) {
                var name = attrs[i].name;
                switch (name) {
                case 'ontouchstart':
                case 'ontouchend':
                case 'ontouchmove':
                case 'ontouchcancel':
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        }
        return NodeFilter.FILTER_SKIP;
    };
    var walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT, nodeFilter, false);
    return walker;
}

TouchEvents.createTouch = function(mouseEvent, identifier) {
    var properties = {
        "identifier" : { value: identifier, writable: false, enumerable: true },
        "target" : { value: mouseEvent.target, writable: false, enumerable: true },
        "clientX" : { value: mouseEvent.clientX, writable: false, enumerable: true },
        "clientY" : { value: mouseEvent.clientY, writable: false, enumerable: true },
        "pageX" : { value: mouseEvent.pageX, writable: false, enumerable: true },
        "pageY" : { value: mouseEvent.pageY, writable: false, enumerable: true },
        "screenX" : { value: mouseEvent.screenX, writable: false, enumerable: true },
        "screenY" : { value: mouseEvent.screenY, writable: false, enumerable: true },
    };
    var touch = new Object();
    Object.defineProperties(touch, properties);
    return touch;
}

TouchEvents.createTouchEvent = function(mouseEvent, type) {
    var touches = [TouchEvents.createTouch(mouseEvent, 0)];
    var properties = {
        // forward to underlying mouseEvent to stop it from propagating.
        "preventDefault" : { value: function() { mouseEvent.preventDefault() }, writable: false },
        "stopPropagation" : { value: function() { mouseEvent.stopPropagation() }, writable: false },
        // readonly attributes of TouchEvent objects.
        "changedTouches" : { value: touches, writable: false },
        "targetTouches" : { value: touches, writable: false },
        "touches" : { value: touches, writable: false },
        "type" : { value: type, writable: false },
        "target" : { value: mouseEvent.target, writable: false },
    };
    return Object.create(mouseEvent, properties);
}

TouchEvents.wrapListener = function(listener) {
    if (listener instanceof Function) {
        return listener;
    } else {
        return function(event) { listener.handleEvent(event); }
    }
}

// Hash table of event listeners keyed by the object itself.
TouchEvents.eventTablesByTarget = new Object();

TouchEvents.addEventListener = function(target, type, listener, useCapture, substitute) {
    var eventTable = TouchEvents.eventTablesByTarget[target];
    if (eventTable == null) {
        eventTable = new Object();
        TouchEvents.eventTablesByTarget[target] = eventTable;
    }
    var key = type + (useCapture ? '+' : '-');
    var listenersForEvent = eventTable[key];
    if (listenersForEvent == null) {
        listenersForEvent = new Array();
        eventTable[key] = listenersForEvent;
    }
    // console.log('substituted an event listener for type ' + type + ' with type ' + substitute.type);
    listenersForEvent[listener] = substitute;
}

TouchEvents.removeEventListener = function(target, type, listener, useCapture) {
    var eventTable = TouchEvents.eventTablesByTarget[target];
    if (eventTable) {
        var key = type + (useCapture ? '+' : '-');
        var listenersForEvent = eventTable[key];
        if (listenersForEvent) {
            var substitute = listenersForEvent[listener];
            if (substitute) {
                delete listenersForEvent[listener];
                // console.log('removed a substituted event listener for type ' + type + ' with type ' + substitute.type);
                return substitute;
            }
        }
    }
    return null;
}

TouchEvents.patchPrototype = function(DOMType) {

    var isFormElement = function (element)
    {
        var tagName = (element.tagName || "").toLowerCase();
        var formTags = ["select", "option", "input", "textarea", "datalist", "keygen", "output", "label", "button", "optgroup", "legend", "fieldset"];
        if (formTags.indexOf(tagName) != -1)
        {
            return true;
        }
    }
 
    var eventTargetsFormElement = function (event)
    {
        if (event.clientX && event.clientY)
        {
            var targetElement = document.elementFromPoint(event.clientX, event.clientY);
            return targetElement && isFormElement(targetElement);
        }
    }

    var __original__addEventListener = DOMType.prototype.addEventListener;
    DOMType.prototype.addEventListener = function(type, listener, useCapture) {
        var target = this;
        var originalListener = listener, originalType = type;
        var wrappedListener = TouchEvents.wrapListener(originalListener);
        switch (type) {
        case 'touchstart':
            type = 'mousedown';
            listener = function(event) {
                if (!eventTargetsFormElement(event))
                {
                    event.preventDefault();
                    var touchEvent = TouchEvents.createTouchEvent(event, 'touchstart');
                    wrappedListener.call(target, touchEvent);
                }
            };
            break;
        case 'touchend':
            type = 'mouseup';
            listener = function(event) {
                if (!eventTargetsFormElement(event))
                {
                    event.preventDefault();
                    var touchEvent = TouchEvents.createTouchEvent(event, 'touchend');
                    wrappedListener.call(target, touchEvent);
                }
            };
            break;
        case 'touchmove':
            type = 'mousemove';
            listener = function(event) {
                if (!eventTargetsFormElement(event))
                {
                    var touchEvent = TouchEvents.createTouchEvent(event, 'touchmove');
                    wrappedListener.call(target, touchEvent);
                }
            };
            break;
        case 'touchcancel':
            console.log('need to emulate a touch event of type ' + type);
            return;
        }
        if (originalListener != listener) {
            var substitute = {
                'listener' : listener,
                'type' : type
            };
            TouchEvents.addEventListener(this, originalType, originalListener, useCapture, substitute);
        }
        __original__addEventListener.call(this, type, listener, useCapture);
    };
    var __original__removeEventListener = DOMType.prototype.removeEventListener;
    DOMType.prototype.removeEventListener = function(type, listener, useCapture) {
        var substitute = TouchEvents.removeEventListener(this, type, listener, useCapture);
        if (substitute) {
            type = substitute.type;
            listener = substitute.listener;
        }
        __original__removeEventListener.call(this, type, listener, useCapture);
    };
}

// patch Node event listener methods to redirect touch events to mouse events.
TouchEvents.patchPrototype(Node);
TouchEvents.patchPrototype(Window);
})();
