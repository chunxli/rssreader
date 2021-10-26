this.BKDOMCleanup = {};

/*** Utility functions ***/

BKDOMCleanup.getEffectiveWritingMode = function() {
	// If body has one DIV child, use that, else use the body
	var mode = null;
	
	if (document && document.body) {
		var element = document.body.firstElementChild || document.body;
		mode = window.getComputedStyle(element).getPropertyValue("-webkit-writing-mode");
	}
	return mode;
}

/*** Cleanup functions ***/
BKDOMCleanup._recordWritingMode = function() {
	// Always run this for presenting content and pagination
	var root = document.documentElement;
	if (root) {
		root.setAttribute("__ibooks_writing_mode", BKDOMCleanup.getEffectiveWritingMode());
	}
}

BKDOMCleanup._hoistAttributeName = "__ibooks_hoist_writing_mode";
BKDOMCleanup._unhoistAttributeName = "__ibooks_unhoist_writing_mode";

BKDOMCleanup._recordHoistedWritingMode = function()
{
    var body = document.body;
    if (body)
    {
        var child = body.firstElementChild;
        if (child)
        {
            var unhoistedWritingMode = window.getComputedStyle(body).getPropertyValue("-webkit-writing-mode");
            var hoistedWritingMode = window.getComputedStyle(child).getPropertyValue("-webkit-writing-mode");
            
            body.setAttribute(BKDOMCleanup._unhoistAttributeName, unhoistedWritingMode);
            body.setAttribute(BKDOMCleanup._hoistAttributeName, hoistedWritingMode);
        }
    }
}

BKDOMCleanup._hoistWritingMode = function(hoist) {
    var mode = document.body.getAttribute(hoist ? BKDOMCleanup._hoistAttributeName : BKDOMCleanup._unhoistAttributeName);
    var updated = false;
    
	// Always run this for pagination to get correct page counts.
	if (document && mode)
	{
		var root = document.documentElement;
		if (root) {
            if (window.getComputedStyle(root).getPropertyValue("-webkit-writing-mode") != mode)
            {
                root.style.setProperty("-webkit-writing-mode", mode);
                updated = true;
            }
		}
		var body = document.body;
		if (body) {
            if (window.getComputedStyle(body).getPropertyValue("-webkit-writing-mode") != mode)
            {
                body.style.setProperty("-webkit-writing-mode", mode);
                updated = true;
            }
		}
	}
    
    return updated;
}

// Returns an array of DOMElements that should be marked for display overrides
// Keep this in sync with the stylesheet
BKDOMCleanup._inlineBlockTagName = "__ibooks_has_inline_block";
BKDOMCleanup._multiplePageTagName = "__ibooks_has_multiple_pages";

BKDOMCleanup._markInlineBlockElements = function () {
    var updated = false;
    var element = document.querySelectorAll("body > div:only-child > span:empty:first-child + div:last-child")[0];
    if (element)
    {
        var elementsToMark = [];
        
        var displayMode = window.getComputedStyle(element).getPropertyValue("display");
        if (displayMode == "inline-block" || element.getAttribute(BKDOMCleanup._inlineBlockTagName) == "true")
        {
            elementsToMark.push(element);
            
            var spanElement = element.previousElementSibling;
            if (spanElement)
            {
                var spanDisplayMode = window.getComputedStyle(spanElement).getPropertyValue("display");
                if (spanDisplayMode == "inline-block" || element.getAttribute(BKDOMCleanup._inlineBlockTagName) == "true")
                {
                    elementsToMark.push(spanElement);
                }
            }
        }
                
        for (var i = 0; i < elementsToMark.length; i++)
        {
            var elementToMark = elementsToMark[i];
            elementsToMark[i].setAttribute(BKDOMCleanup._inlineBlockTagName, "true");
        }
        
        // mark the document element as well so we know we did this
        if (elementsToMark.length > 0)
        {
            document.documentElement.setAttribute(BKDOMCleanup._inlineBlockTagName, "true");
            updated = true;
        }
    }
    
    return updated;
}

BKDOMCleanup._forceStyleRecalc = function() {
    // force a style recalc
    var styleElement = document.createElement("style");
    styleElement.appendChild(document.createTextNode("*{}"));
    document.body.appendChild(styleElement);
    document.body.removeChild(styleElement);
    
    var waitForLayoutToFinish = document.body.offsetTop;
}

BKDOMCleanup._removeBodyInlineStyle = function () {
    var root = document.body || document.documentElement;
    if (root)
    {
        var displayMode = window.getComputedStyle(root);
        if (displayMode == "inline-block")
        {
            root.style.setProperty("display", "block");
        }
    }
}

BKDOMCleanup._tagAsMultiplePages = function (mark) {
    var root = document.documentElement;
    // Right now, we only care about this if we have inline-block in the document
    var updated = false;
    if (root && root.getAttribute(BKDOMCleanup._inlineBlockTagName) == "true")
    {
        if (mark && root.getAttribute(BKDOMCleanup._multiplePageTagName) != "true")
        {
            root.setAttribute(BKDOMCleanup._multiplePageTagName, "true");
            updated = true;
        }
        else if (!mark && root.getAttribute(BKDOMCleanup._multiplePageTagName) == "true")
        {
            root.removeAttribute(BKDOMCleanup._multiplePageTagName);
            updated = true;
        }
    }
    
    return updated;
}

BKDOMCleanup._fixupBodyLang = function(language) {
    if (language != null && language != "") {
        var body = document.body;
        if (!body) return;
        // check for existing lang
        var elts = [body, document.documentElement];
        for (var i = 0; i < elts.length; i++) {
            var elt = elts[i];
            var xlang = elt.getAttribute("xml:lang");
            if ((elt.lang != null && elt.lang != "") || (xlang != null && xlang != "")) {
                // found a lang
                return;
            }
        }
        // found no lang; set book's lang on the body
        body.lang = language;
    }
}

BKDOMCleanup._modifyAutoplayNodes = function() {
    var elts = document.querySelectorAll("video[autoplay], audio[autoplay]");
    for (var i = 0; i < elts.length; i++) {
        var node = elts[i];
        node.removeAttribute("autoplay");
        node.setAttribute("ibooksautoplay", "true");
    }
}

// <rdar://problem/14120624> OSX: Unable to bring images to expanded mode
//
// Simple workaround: Make an <a> tag to navigate with that will trigger
//                    the same handler as clicking on a link to the IMG
//                    if was inside a link.
BKDOMCleanup._isContainedInAnchor = function(node) {
    var parent = node.parentElement;
    var result = false;
    while (parent && !result)
    {
        if ((parent.tagName || "").toLowerCase() == "a")
        {
            // Anchor tags much have a href to be considered a link
            if (parent.hasAttribute("href"))
            {
                result = true;
            }
            else
            {
                parent = parent.parentElement;
            }
        }
        else
        {
            parent = parent.parentElement;
        }
    }
    
    return result;
}

BKDOMCleanup._makeImagesBringUpExpandedOverlay = function (evt) {
    var img = evt.target;
    
    // Make sure the img isn't contained in an <a> tag

    // If not contained, then trigger the overlay.
    if (img && !img.hasAttribute("__ibooks_respect_image_size") && !BKDOMCleanup._isContainedInAnchor(img))
    {
        var src;
        if (img.hasAttribute("src"))
        {
            src = img.getAttribute("src");
        }
        else if (img.hasAttribute("xlink:href"))
        {
            src = img.getAttribute("xlink:href");
        }
        if (src)
        {
            var a = document.createElement("a");
            a.href = src;
            a.click();
        }
    }
}

BKDOMCleanup._uniqueCount = 0;

BKDOMCleanup._makeTablesBringUpExpandedOverlay = function (evt) {
    var tbl = evt.target;
    
    while (tbl && !(tbl instanceof HTMLTableElement))
    {
        tbl = tbl.parentElement;
    }
    
    // Make sure the table isn't contained in an <a> tag
    var body = document.body;

    if (tbl && body)
    {
        // If not contained, then trigger the overlay.
        // - only do this if table is wider than body; ideally this would be done based on where the tbl spilled outside the page
        //   but getBoundingClientRects() doesn't return something useful (it returns the rect for the first page)
        if (!BKDOMCleanup._isContainedInAnchor(tbl) && tbl.scrollWidth > body.clientWidth)
        {
            var a = document.createElement("a");
            
            var range = document.createRange();
            range.setStart(tbl, 0);
            range.setEndAfter(tbl);
            var cfi = CFI.computeCFI(null, null, null, range);

            // unless there's changing part of the URL webkit doesn't feel like passing on the navigation events
            a.href = "#-ibooks-expanded-" + cfi + "?q=" + BKDOMCleanup._uniqueCount;
            BKDOMCleanup._uniqueCount++;
            a.click();
        }
    }
}

BKDOMCleanup._setupImagePreview = function() {
    var images = document.querySelectorAll("img, svg image");
    var length = images.length;
    for (var i = 0; i < length; i++)
    {
        var img = images[i];
        img.__bk_original_addEventListener("dblclick", BKDOMCleanup._makeImagesBringUpExpandedOverlay);
    }
}

BKDOMCleanup._setupTablePreview = function() {
    var tables = document.querySelectorAll("table");
    var length = tables.length;
    for (var i = 0; i < length; i++)
    {
        var tbl = tables[i];
        tbl.__bk_original_addEventListener("click", BKDOMCleanup._makeTablesBringUpExpandedOverlay);
    }
}

BKDOMCleanup._XHTMLNamespace = "http://www.w3.org/1999/xhtml";

BKDOMCleanup._tagImagesThatAreRespectedInSize = function(bookInfo)
{
    // test if this is an image size we're respecting
    var images = document.images;
    for (var i=0; i < images.length; i++)
    {
        var image = images[i];
        
        if (bookInfo && bookInfo.respectImageSizeClass) {
            var selector;
            if (bookInfo.respectImageSizeClassIsPrefix) {
                selector = "*[class|=" + bookInfo.respectImageSizeClass + "]";
            } else {
                selector = "*[class~=" + bookInfo.respectImageSizeClass + "]";
            }
            if (image.webkitMatchesSelector(selector)) {
                isRespecting = true;
                image.setAttribute("__ibooks_respect_image_size", "true"); // Tag so we can't expand it.
            }
        }
    }
}

BKDOMCleanup._wrapImagesInDivs = function(bookInfo) {
    var imageShouldBeWrapped = function(image, computedStyle) {
        var shouldWrap = (computedStyle.getPropertyValue("display") == "block");
        if (!shouldWrap) {
            if (image.namespaceURI == BKDOMCleanup._XHTMLNamespace) {
                // See https://developer.mozilla.org/en-US/docs/Web/API/element.getAttribute
                if (image.hasAttribute("width") && image.hasAttribute("height")) {
                    var width = image.getAttribute("width"), height = image.getAttribute("height");
                    shouldWrap = (width.length && width != "100%" && height.length && height != "100%");
                }
            }
        }
        return shouldWrap;
    };
    var wrapOneImage = function(image, computedStyle) {
        // Create a new div that contains the equivalent computed style of the original image.
        var div = document.createElement("div");
        div.style.cssText = computedStyle.cssText;
        
        var isRespecting = image.hasAttribute("__ibooks_respect_image_size");
        if (!isRespecting) {
            // if we're not obeying image dimensions, then the image must have been forced to auto
            // so force that on the div too, so we behave better when rotating
            div.style.setProperty("width", "auto", "");
            div.style.setProperty("height", "auto", "");
        }
        
        // if the image was inline already, then we want the div to be inline-block
        if (div.style.display == "inline") {
            // we tested div.style because if its display is inline, that's because it got it from cssText
            // We can't test the image directly without getting its computed style, and that's not necessary
            div.style.setProperty("display", "inline-block", "");
        } else {
            // Change the image to be inline...
            image.style.setProperty("display", "inline", "");
        }
        
        // The image shouldn't float since the div wrapper will take care of any necessary floating.
        image.style.setProperty("float", "none", "");
        
        // We want to force the image to auto-size
        image.style.setProperty("width", "auto", "!important");
        image.style.setProperty("height", "auto", "!important");
        
        // page-break-inside: avoid; on the image can cause problems
        image.style.setProperty("page-break-inside", "auto", "!important");
        // remove it on the div too
        div.style.setProperty("page-break-inside", "auto", "!important");
        
        // wrap the image in the div.
        image.parentElement.replaceChild(div, image);
        div.appendChild(image);
    };
    
    var scalesWithText = function(str) {
        var scales = false;

        if (str.length > 2)
        {
            var units = str.substr(-2);
            scales = units == 'em' || units == 'ex';
        }

        return scales;
    }
    
    var wrapImages = function(images) {
        var length = images.length;
        for (var i = 0; i < length; i++) {
            var image = images[i];
            if (image.nodeType == document.ELEMENT_NODE) {
                var computedStyle = window.getComputedStyle(image);
                if (imageShouldBeWrapped(image, computedStyle)) {
                    wrapOneImage(image, computedStyle);
                } else {
                    var isRespecting = image.hasAttribute("__ibooks_respect_image_size");
                    if (isRespecting == false) {
                        var clone = StyledClone.cloneElementWithStyle(image);
                        var width = clone.style.width;
                        var height = clone.style.height;
                        if (scalesWithText(width) == false && scalesWithText(height) == false) {
                            if (image.hasAttribute("width") == false) {
                                image.style.width = 'auto';
                            }
                            if (image.hasAttribute("height") == false) {
                                image.style.height = 'auto';
                            }
                        }
                    }
                }
            }
        }
    };
    
    // wrap HTML images.
//    wrapImages(document.images);
    
    // wrap SVG images.
//    wrapImages(document.querySelectorAll("svg image"));
}

BKDOMCleanup._checkParagrahElements = function(fontFamily) {
    var tags = new Array("p","div","span");
    
    var textContainersToForce = new Array();
    var textContainersToAlign = new Array();
    var tagContainersToForce = new Array();
    
    var i, j;
    
    for (i = 0; i < tags.length; i++)
    {
        var tag = tags[i];
        
        var textContainers = document.querySelectorAll(tag);
        
        for (j = 0; j < textContainers.length; j++)
        {
            var textContainer = textContainers[j];
            
            if (textContainer.nodeType == document.ELEMENT_NODE)
            {
                // don't try to override <span>s inside of <ruby><rt>
                if (tag == "span")
                {
                    if (textContainer.webkitMatchesSelector("ruby > rt *"))
                    {
                        continue;
                    }
                }
                
                var computedTextStyle = window.getComputedStyle(textContainer);
                var computedTextFontValue = computedTextStyle.getPropertyCSSValue("font-family");
                var computedTextFont = computedTextStyle.getPropertyValue("font-family");
                
                while (computedTextFontValue.cssValueType == CSSValue.CSS_VALUE_LIST)
                {
                    if (computedTextFontValue.length > 0)
                    {
                        computedTextFontValue = computedTextFontValue[0]
                    }else
                    {
                        computedTextFontValue = null;
                    }
                }
                if (computedTextFontValue.cssValueType == CSSValue.CSS_PRIMITIVE_VALUE)
                {
                    if (computedTextFontValue.primitiveType == CSSPrimitiveValue.CSS_STRING || computedTextFontValue.primitiveType == CSSPrimitiveValue.CSS_IDENT)
                    {
                        computedTextFont = computedTextFontValue.getStringValue();
                    }
                }
                
                //add if they have a different font
                if (computedTextFont != fontFamily)
                {
                    tagContainersToForce.push(textContainer);
                }
                
                var computedTextAlign = (computedTextStyle.getPropertyValue("text-align") || "").toLowerCase();
                if (computedTextAlign == "start" || computedTextAlign == "left" || computedTextAlign == "-webkit-auto" || computedTextAlign == "justify")
                {
                    textContainersToAlign.push(textContainer);
                }
            }
        }
        
        // If there are only FORCE_FONTS_THRESHOLD% of the paragraphs that are in a different font, do nothing...
        if (textContainers.length > 0 && tagContainersToForce.length / textContainers.length < 0.8)
        {
            
        }else
        {
            textContainersToForce = textContainersToForce.concat(tagContainersToForce);
        }
        tagContainersToForce.length = 0;
        
        // Don't implement a threshold on alignment because we're only justifying left-aligned content
        // And this gives us a far less predictable measurement for the number of divs we're asked to modify.
    }
    
    return new Array(textContainersToForce, textContainersToAlign);
}

BKDOMCleanup._forceFontsOnParagraphs = function (items) {
    var textContainersToForce = items[0];
    var textContainersToAlign = items[1];
    
    var i;
    for (i = 0; i < textContainersToForce.length; i++)
    {
        var element = textContainersToForce[i];
        
        element.setAttribute("__ibooks_font_override", true);
    }
    
    for (i = 0; i < textContainersToAlign.length; i++)
    {
        var element = textContainersToAlign[i];
        
        element.setAttribute("__ibooks_align_override", true);
    }
}

BKDOMCleanup._shouldRemoveDocumentElementWritingMode = function() {
    var body = document.body;
    if (!body)
        return false;
    
    var rootWritingMode = window.getComputedStyle(document.documentElement).getPropertyValue("-webkit-writing-mode");
    var bodyWritingMode = window.getComputedStyle(body).getPropertyValue("-webkit-writing-mode");
    
    return rootWritingMode != bodyWritingMode;
}

BKDOMCleanup._removeDocumentWritingMode = function() {
    var body = document.body;
    if (!body)
        return;
    
    var writingMode = window.getComputedStyle(body).getPropertyValue("-webkit-writing-mode");
    if (!writingMode)
        return;
    
    document.documentElement.style.setProperty("-webkit-writing-mode", writingMode);
}

BKDOMCleanup._shouldAdjustWritingMode = function() {
    var body = document.body;
    if (!body)
        return false;
    var child = body.firstElementChild;
    if (!child)
        return false;
    if (child.nextElementSibling)
        return false;
    
    var bodyMode = window.getComputedStyle(body).getPropertyValue("-webkit-writing-mode");
    var childMode = window.getComputedStyle(child).getPropertyValue("-webkit-writing-mode");
    
    return bodyMode != childMode;
}

/*** Hooks ***/

// didFinishLoad is fired by BKEpubWebProcessPlugIn in didFinishLoadForFrame()
BKDOMCleanup.didFinishLoad = function(bookInfo) {
    if (!bookInfo.isFixedLayout) {

        var adjustWritingMode = BKDOMCleanup._shouldAdjustWritingMode();
        var removeDocumentWritingMode = BKDOMCleanup._shouldRemoveDocumentElementWritingMode();
        var forceStyleRecalc = false;

        if (adjustWritingMode)
        {
            forceStyleRecalc = true;
            BKDOMCleanup._recordHoistedWritingMode();
        }

        if (BKDOMCleanup._markInlineBlockElements())
        {
            forceStyleRecalc = true;
        }

        if (removeDocumentWritingMode)
        {
            BKDOMCleanup._removeDocumentWritingMode();
        }
        
        BKDOMCleanup._removeBodyInlineStyle();
        BKDOMCleanup._setupImagePreview();
        BKDOMCleanup._setupTablePreview();
        BKDOMCleanup._tagImagesThatAreRespectedInSize(bookInfo);
        BKDOMCleanup._wrapImagesInDivs(bookInfo);

        if (bookInfo.fontFamily)
        {
            BKDOMCleanup._forceFontsOnParagraphs(BKDOMCleanup._checkParagrahElements(bookInfo.fontFamily));
        }

        // must occur after recording hoisted writing mode
        if (BKDOMCleanup._hoistWritingMode(true))
        {
            forceStyleRecalc = true;
        }
        
        // must come after mark inline
        if (BKDOMCleanup._tagAsMultiplePages(true))
        {
            forceStyleRecalc = true;
        }

        if (forceStyleRecalc)
        {
            BKDOMCleanup._forceStyleRecalc();
        }
    }
};

// didFinishDocumentLoad is fired by BKEpubWebProcessPlugIn in didFinishDocumentLoadForFrame()
// Equivalent to DOMContentLoaded
BKDOMCleanup.didFinishDocumentLoad = function(bookInfo) {
    BKDOMCleanup._fixupBodyLang(bookInfo.language);
    BKDOMCleanup._modifyAutoplayNodes();
    // soundtrack is handled in readAloud.js
    // footnotes are handled elsewhere
}

BKDOMCleanup.tocIdCssRules = function(cfiToIdMap) {
    var idCssRules = "";
    
    if (BKDOMCleanup.getEffectiveWritingMode().indexOf("vertical") != -1 && cfiToIdMap) // Otherwise short-circuit, too much work
    {
        // Cycle through the CFI->id map, finding the elements to which the CFIs
        // correspond.  Inspect the elements and map some of their properties.
        var tcyIds = "";
        var displayNoneIds = "";
        for (var cfi in cfiToIdMap)
        {
            if (cfiToIdMap.hasOwnProperty(cfi))
            {
                var elementSyntheticId = cfiToIdMap[cfi];
                var range = CFI.parseCFI(cfi);
                var element = range.startContainer;
                
                var elementStyle = window.getComputedStyle(element);
                var textCombine = elementStyle.webkitTextCombine;
                var writingMode = elementStyle.webkitWritingMode;
                if (textCombine == "horizontal" ||
                    writingMode == "lr-tb" ||
                    writingMode == "horizontal-tb")
                {
                    tcyIds = tcyIds + ((tcyIds.length > 0) ? ", #" : "#") + elementSyntheticId;
                }
                
                var display = elementStyle.display;
                if (display == "none")
                {
                    displayNoneIds = displayNoneIds + ((displayNoneIds.length > 0) ? ", #" : "#") + elementSyntheticId;
                }
            }
        }
        if (tcyIds.length > 0)
        {
            idCssRules = idCssRules + tcyIds + " { -webkit-text-combine: horizontal; }\n\n";
        }
        if (displayNoneIds.length > 0)
        {
            idCssRules = idCssRules + displayNoneIds + " { display: none; }\n\n";
        }
    }
    return idCssRules;
}

BKDOMCleanup.unhoistWritingModeIfNeeded = function(pageWidth, gap)
{
    var width = document.body.scrollWidth;
    var pageCount = Math.ceil(width / (pageWidth + gap));
    
    if (pageCount <= 1)
    {
        var forceStyleRecalc = false;
        
        if (BKDOMCleanup._hoistWritingMode(false))
        {
            forceStyleRecalc = true;
        }
        
        if (BKDOMCleanup._tagAsMultiplePages(false))
        {
            forceStyleRecalc = true;
        }
        
        if (forceStyleRecalc)
        {
            BKDOMCleanup._forceStyleRecalc();
        }
    }
    
    BKDOMCleanup._recordWritingMode();
}
