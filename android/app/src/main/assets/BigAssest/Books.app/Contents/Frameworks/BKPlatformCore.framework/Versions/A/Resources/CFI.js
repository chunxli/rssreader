//
// CFI.js
//
// Converts a DOM range to a CFI string.
//

function __BKPatchAddEventListener()
{
    var patchPrototype = function(DOMType)
        {
            // Don't patch twice.
            if (DOMType.prototype.__bk_original_addEventListener)
            {
                return;
            }
            
            // Patch addEventListener so that we can warn on interactive books
            DOMType.prototype.__bk_original_addEventListener = DOMType.prototype.addEventListener;
            DOMType.prototype.addEventListener = function(type, listener, useCapture)
                {
                    window.setTimeout(function()
                        {
                            window.location = "warn://events";
                        }, 2000);
                    this.__bk_original_addEventListener(type, listener, useCapture);
                };
        };

    patchPrototype(Node);
    patchPrototype(Window);
};

__BKPatchAddEventListener();


function CFI() {
    // CFI is a singleton CFI generation/parsing service. It has no instances.
}

// Step type constants used by computeCFI.
CFI.kEpubCFIStepTypeChild = 1;
CFI.kEpubCFIStepTypeAssertion = 2;
CFI.kEpubCFIStepTypeTextAssertion = 3;
CFI.kEpubCFIStepTypeIndirection = 4;
CFI.kEpubCFIStepTypeCharacterOffset = 5;
CFI.kEpubCFIStepTypeTemporalOffset = 6;
CFI.kEpubCFIStepTypeSpatialOffset = 7;

CFI.kCFIStepRankings = [
    0,
    3, // [kEpubCFIStepTypeChild]
    0, // [kEpubCFIStepTypeAssertion]
    0, // [kEpubCFIStepTypeTextAssertion]
    1, // [kEpubCFIStepTypeIndirection]
    4, // [kEpubCFIStepTypeCharacterOffset]
    2, // [kEpubCFIStepTypeTemporalOffset]
    2, // [kEpubCFIStepTypeSpatialOffset]
];

// NSComparisionResult values used by _compareStep
CFI.NSOrderedAscending = -1;
CFI.NSOrderedSame = 0;
CFI.NSOrderedDescending = 1;

// Used for pagination and should be ignored when calculating or following CFIs
CFI._insertedPageBreak = null;
CFI._countNodeAfterPageBreak = true;

CFI._isNodeHiddenFromCFI = function(element) {
    return element == CFI._insertedPageBreak;
}
CFI._setNodeHiddenFromCFI = function(element) {
    CFI._insertedPageBreak = element;
}

CFI.isElementNode = function(node) {
    return node && node.nodeType == Node.ELEMENT_NODE;
}
CFI.isTextNode = function(node) {
    switch (node.nodeType) {
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
            return true;
    }
    return false;
}

CFI._rootedInAttribute = function(range) {
    // Walk up the chain from commonAncestorContainer. If we find any attribute nodes, we're out
    // While we're at it, make sure we actually find the owning document. We could do a compareDocumentPosition
    // and look for DETACHED, but since we're already iterating, it's easier to do it this way
    var foundDocument = false;
    for (var cursor = range.commonAncestorContainer; cursor != null && !foundDocument; cursor = cursor.parentNode) {
        switch (cursor.nodeType) {
        case document.ATTRIBUTE_NODE:
            // oops we found an attribute
            return true;
        case document.DOCUMENT_NODE:
            if (cursor == range.commonAncestorContainer.document) {
                foundDocument = true;
            }
            break;
        }
    }
    return false;
}

CFI._ensureRangeRootedInDocument = function(range) {
    var ancestor = range.commonAncestorContainer;
    
    if (!ancestor)
    {
        return null;
    }
    
    var ownerDocument = ancestor.ownerDocument;
    if (!ownerDocument)
    {
        return null;
    }
    
    var docElt = ancestor.ownerDocument.documentElement;
    
    if (!docElt.isSameNode(ancestor) && (docElt.compareDocumentPosition(ancestor) & document.DOCUMENT_POSITION_CONTAINED_BY) == 0) {
        // our common ancestor falls outside of the document element
        // Make a new range to modify
        var newRange = range.cloneRange();
        if ((docElt.compareDocumentPosition(newRange.startContainer) & document.DOCUMENT_POSITION_PRECEDING) != 0) {
            // the start container preceedes the document element. Clamp it
            newRange.setStart(docElt, 0);
        }
        if (!docElt.isSameNode(newRange.endContainer) && (docElt.compareDocumentPosition(newRange.endContainer) & BK_DOM_DOCUMENT_POSITION_CONTAINED_BY) == 0) {
            // the end container isn't inside the document element. It must be after. Clamp it.
            newRange.setEnd(docElt, docElt.childNodes.length);
        }
        range = newRange;
    }
    return range;
}

CFI._avoidHiddenElementsInRange = function(range)
{
    var newRange = range.cloneRange();
    
    // Test the entire ancestry
    for (var startContainer = range.startContainer; startContainer != null; startContainer = startContainer.parentNode)
    {
        // Fix the range start
        if (CFI._isNodeHiddenFromCFI(startContainer))
        {
            var node = startContainer.parentNode;
            var offset = 0;
            if (startContainer.previousSibling != null)
            {
                node = startContainer.previousSibling;
                offset = node.length;
            }
            newRange.setStart(node,offset);
            
            // We've found the hidden node and have avoided it. So stop.
            break;
        }
    }
    
    // Test the entire ancestry
    for (var endContainer = range.endContainer; endContainer != null; endContainer = endContainer.parentNode)
    {
        // fix the range end
        if (CFI._isNodeHiddenFromCFI(endContainer))
        {
            var node = endContainer.parentNode;
            var offset = 0;
            if (endContainer.previousSibling != null)
            {
                node = endContainer.previousSibling;
                range = node.length;
            }
            newRange.setEnd(node,offset);
            
            // We've found the hidden node and have avoided it. So stop.
            break;
        }
    }
    
    return newRange;
}

CFI._compareValue = function(aValue, bValue) {
    if (aValue < bValue) {
        return CFI.NSOrderedAscending;
    } else if (aValue > bValue) {
        return CFI.NSOrderedDescending;
    }
    return CFI.NSOrderedSame;
}

CFI._compareStep = function (aStep, bStep) {
    if (aStep.type == bStep.type) {
        switch (aStep.type) {
        case CFI.kEpubCFIStepTypeChild:
            if (aStep.index < bStep.index) {
                return CFI.NSOrderedAscending;
            } else if (aStep.index > bStep.index) {
                return CFI.NSOrderedDescending;
            }
            break;
        case CFI.kEpubCFIStepTypeAssertion:
            // We only care about this with individual steps, which only does an equality test.
            // Comparing full CFI's will never pass assertions.
            // So lets test for equality and give Descending otherwise
            if ((aStep.value == bStep.value) && (aStep.parameters == bStep.parameters)) {
                // They're equal
                return CFI.NSOrderedSame;
            }
            return CFI.NSOrderedDescending;
        case CFI.kEpubCFIStepTypeTextAssertion:
            // Same caveats as the Assertion above
            if ((aStep.prefix == bStep.prefix) && (aStep.suffix == bStep.suffix) && (aStep.parameters == bStep.parameters)) {
                // They're equal
                return CFI.NSOrderedSame;
            }
            return CFI.NSOrderedDescending;
        case CFI.kEpubCFIStepTypeIndirection:
            // no comparison to be made
            break;
        case CFI.kEpubCFIStepTypeTemporalOffset:
            // nil temporal offset preceeds all others
            if (aStep.offset == null) {
                return CFI.NSOrderedAscending;
            } else if (bStep.offset == null) {
                return CFI.NSOrderedDescending;
            }
            return CFI._compareValue(aStep.offset, bStep.offset);
        case CFI.kEpubCFIStepTypeSpatialOffset:
            // nil spatial offset preceeds all others - use yOffset to test
            if (aStep.yOffset == null) {
                return CFI.NSOrderedAscending;
            } else if (bStep.yOffset == null) {
                return CFI.NSOrderedDescending;
            }
            var result = CFI._compareValue(aStep.yOffset, bStep.yOffset);
            if (result == CFI.NSOrderedSame) {
                result = CFI._compareValue(aStep.xOffset, bStep.xOffset);
            }
            return result;
        case CFI.kEpubCFIStepTypeCharacterOffset:
            return CFI._compareValue(aStep.offset, bStep.offset);
        }
        return CFI.NSOrderedSame;
    } else {
        // the type itself has a ranking
        if (CFI.kCFIStepRankings[aStep.type] < CFI.kCFIStepRankings[bStep.type]) {
            return CFI.NSOrderedAscending;
        } else {
            // Temporal/Spatial offsets have the same ranking.
            // However, when comparing full CFIs, we never pass two steps where one is
            // spatial and the other isn't, or where one is temporal and the other isn't.
            // Therefore it's safe to assume non-ascending means descending.
            // When comparing individual steps, we don't really care.
            return CFI.NSOrderedDescending;
        }
    }
}

CFI._formatStep = function(cfi,step)
{
    switch (step.type)
    {
        case CFI.kEpubCFIStepTypeChild:
            cfi.push('/' + step.index);
            break;
        case CFI.kEpubCFIStepTypeAssertion:
        case CFI.kEpubCFIStepTypeTextAssertion: {
            var value, parameters;
            if (step.type == CFI.kEpubCFIStepTypeAssertion) {
                value = step.value;
                parameters = step.parameters;
            } else if (step.prefix) {
                value = step.prefix;
                if (step.suffix) {
                    value = [value, step.suffix].join(',');
                }
                parameters = step.parameters;
            }
            cfi.push('[' + CFI._escapeString(value));
            for (key in parameters) {
                cfi.push(';' + CFI._escapeString(key) + '=' + CFI._escapeString(parameters[key]));
            }
            cfi.push(']');
            break;
        }
        case CFI.kEpubCFIStepTypeIndirection:
            cfi.push('!');
            break;
        case CFI.kEpubCFIStepTypeCharacterOffset:
            cfi.push(':' + step.offset);
            break;
        case CFI.kEpubCFIStepTypeSpatialOffset:
            cfi.push('@' + step.xOffset + ':' + step.yOffset);
            break;
        case CFI.kEpubCFIStepTypeTemporalOffset:
            cfi.push('~' + step.offset);
            break;
        default:
            console.error("Unknown step type " + step.type + ".");
            break;
    }
}

CFI._formatSteps = function(cfi, steps, start, end) {
    var count = steps.length;
    for (var i = start; i < end; ++i) {
        var step = steps[i];
        if (!step)
        {
            continue;
        }
        
        CFI._formatStep(cfi,step);
    }
}

CFI._formatStepName = function(type) {
    var name = "unknown";
    switch (type) {
        case CFI.kEpubCFIStepTypeChild:
            name = "a child";
            break;
        case CFI.kEpubCFIStepTypeAssertion:
            name = "an assertion";
            break;
        case CFI.kEpubCFIStepTypeTextAssertion:
            name = "a text assertion";
            break;
        case CFI.kEpubCFIStepTypeIndirection:
            name = "an indirection";
            break;
        case CFI.kEpubCFIStepTypeCharacterOffset:
            name = "a character offset";
            break;
        case CFI.kEpubCFIStepTypeSpatialOffset:
            name = "a spatial offset";
            break;
        case CFI.kEpubCFIStepTypeTemporalOffset:
            name = "a temporal offset";
            break;
        default:
            break;
    }
    return name;
}

CFI._isValid = function(steps,startStepsPtr,endStepsPtr,stepsEnd)
{
    // Allowing passthrough to log all errors with the input CFI.
    var valid = true;
    var startType = steps[startStepsPtr] ? steps[startStepsPtr].type : null;
    var zeroType = steps[0] ? steps[0].type : null;
    
    if (startStepsPtr == 0)
    {
        console.warn("CFI is invalid. Base range is empty.");
        valid = false;
    }
    if (zeroType && zeroType != CFI.kEpubCFIStepTypeChild && zeroType != CFI.kEpubCFIStepTypeIndirection)
    {
        console.warn("CFI is invalid. Base should start with a child node or indirection, not " + CFI._formatStepName(zeroType) + ".");
        valid = false;
    }
    if (startType && startType != CFI.kEpubCFIStepTypeChild && startType != CFI.kEpubCFIStepTypeCharacterOffset)
    {
        console.warn("CFI is invalid. Start range should start with a child node or character offset, not " + CFI._formatStepName(startType) + ".");
        valid = false;
    }
    if (startType && startType != CFI.kEpubCFIStepTypeChild && startType != CFI.kEpubCFIStepTypeCharacterOffset)
    {
        console.warn("CFI is invalid. End range should start with a child node or character offset, not " + CFI._formatStepName(startType) + ".");
        valid = false;
    }
    return valid;
}

CFI.computeCFI = function(spineIndex, chapterIndex, manifestId, range) {
    // We can't handle ranges rooted in attributes
    if (CFI._rootedInAttribute(range)) return null;
    
    // Similarly, check to make sure our range is actually rooted inside the document element
    // If not, clamp it back to the document element
    range = CFI._ensureRangeRootedInDocument(range);
    
    // Move the range so that it doesn't start (or end) on a hidden element
    range = CFI._avoidHiddenElementsInRange(range);
    
    // At this point, we can be sure the range is not rooted in an attribute, and is nested within the document element.
    var elements = new Array();
    elements.push(range.startContainer);
    // TODO: we may be in a nested document, so walk up until we find the main frame, keeping track of each document's element along the way
    // for (WebFrame *frame = [range.startContainer.ownerDocument webFrame]; frame.parentFrame != nil; frame = frame.parentFrame) {
    //    elements.push(frame.frameElement);
    // }
    
    // steps holds our accumulating steps
    var steps = new Array();
    
    var rootStepCount = 0, startStepCount = 0, endStepCount = 0;
    var stepType = 0; // 0 is root, 1 is start, 2 is end
    var noteStepCount = function() {
        var total = steps.length;
        switch (stepType++) {
        case 0: rootStepCount = total; break;
        case 1: startStepCount = total - rootStepCount; break;
        case 2: endStepCount = total - (startStepCount + rootStepCount); break;
        }
    }
    
    // appendStep() appends one step to steps
    var appendStep = function(step)
    {
        // Here's some handy code to help debug text nodes being added to text nodes. You could
        // add some work here to double check rules on what is added to what.
        /*if (steps.length > 0)
        {
            var prevStep = steps[steps.length - 1];
            if (step.type == CFI.kEpubCFIStepTypeChild && (step.index % 2) != 0 && prevStep.type == CFI.kEpubCFIStepTypeChild && (prevStep.index % 2) != 0)
            {
                console.error("Attempting to add text node step as child of text node step.");
                return;
            }
        }*/
        steps.push(step);
    }
    
    // isTextNode() determines if the node is a text node or CDATA node
    // We can't test against DOMCharacterData because DOMComment inherits from that
    //  TODO: Replace calls with CFI.isTextNode()
    var isTextNode = function(node) {
        switch (node.nodeType) {
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
            return true;
        }
        return false;
    }
    
    // isElementNode() determines if the node is an element node
    // TODO: Replace calls with CFI.isElementNode()
    var isElementNode = function(node) {
        return node && node.nodeType == Node.ELEMENT_NODE;
    }
    
    // calculateOffset() calculates the offset of the given node according to the CFI spec
    // elements are even numbers starting at 2
    // collections of non-element nodes are odd numbers starting at 1
    var calculateOffset = function(node) {
        if (node.parentElement == null) return 0;
        var offset = 1;
        var parent = node.parentElement;
        var skipNextIncrement = false;
        while (node.parentNode != parent) node = node.parentNode;
        for (var cursor = parent.firstChild; cursor != null; cursor = cursor.nextSibling) {
            if (skipNextIncrement || CFI._isNodeHiddenFromCFI(cursor))
            {
                skipNextIncrement = CFI._isNodeHiddenFromCFI(cursor) && CFI._skipNodeAfterPageBreak;
                if (cursor == node) break;
                continue;
            }
            
            if (isElementNode(cursor)) {
                ++offset;   // always increment for elements
                if ((offset & 1) == 1) { // offset is odd
                    ++offset;
                }
            } else {
                if ((offset & 1) == 0) { // offset is even
                    ++offset;
                }
            }
            if (cursor == node) break;
        }
        return offset;
    }
    
    // Add the preamble - note spineIndex and chapterIndex are assumed 0-based indexes.
    // These can either be skipped, or simply placeholders values. If they are missing,
    // a relative CFI starting with '!' will be generated.
    if (spineIndex != null) {
        appendStep({type : CFI.kEpubCFIStepTypeChild, index : (spineIndex + 1) * 2});
    }
    if (chapterIndex != null) {
        appendStep({type : CFI.kEpubCFIStepTypeChild, index : (chapterIndex + 1) * 2});
    }
    if (manifestId != null) {
        appendStep({type : CFI.kEpubCFIStepTypeAssertion, value : manifestId});
    }
    
    // Calculates the DOM-style index into the parent's childNodes
    // Returns -1 on error
    // FIXME:  doesn't need to be a closure.
    var indexIntoParent = function(node) {
        var i = 0;
        var skipNextIncrement = false;
        for (var cursor = node.previousSibling; cursor != null; cursor = cursor.previousSibling) {
            // skip the inserted break plus don't increment for the text node that follows
            if (skipNextIncrement || CFI._isNodeHiddenFromCFI(cursor)) {
                skipNextChild = CFI._isNodeHiddenFromCFI(cursor) && CFI._skipNodeAfterPageBreak;
                continue;
            }
            i++;
        }
        return i;
    }
    
    // walk up the ancestors until we find an element or text node, since that's all we'll pass by when walking up the start
    var commonAncestor = range.commonAncestorContainer;
    while ((commonAncestor != null) && !isElementNode(commonAncestor) && !isTextNode(commonAncestor)) {
        commonAncestor = commonAncestor.parentNode;
    }

    var handleOffset = function(obj, objOffset, adjustEnd) {
        // and whatever the startOffset referenced
        if (isElementNode(obj)) {
            // it's a regular element
            // So the start offset is one of its children
            // Walk up the children list and figure out the CFI offset
            var cfiOffset = 1;
            var offsetChild = null;
            var skipNextIncrement = false;
            for (var offset = 0; offset <= objOffset; offset++) {
                if (obj.childNodes.length <= offset) {
                    // we're off the end of the children array
                    if (offset > 0) {
                        // only increment if the childNodes isn't empty
                        cfiOffset++;
                    }
                    offsetChild = null;
                    break;
                }
                
                offsetChild = obj.childNodes[offset];
                
                if (skipNextIncrement || CFI._isNodeHiddenFromCFI(offsetChild))
                {
                    skipNextIncrement = CFI._isNodeHiddenFromCFI(cursor) && CFI._skipNodeAfterPageBreak;
                    continue;
                }
                
                if (isElementNode(offsetChild)) {
                    cfiOffset++; // always increment for elements
                    if ((cfiOffset & 1) == 1) cfiOffset++; // and increment again if odd
                } else {
                    if ((cfiOffset & 1) == 0) cfiOffset++; // increment if even
                }
            }
            if (adjustEnd) {
                // When handling the end offset, if it points to an element, and the previous sibling is an element,
                // we actually want the offset to be the odd index in between the elements
                if (offsetChild && isElementNode(offsetChild) && isElementNode(offsetChild.previousSibling)) {
                    cfiOffset--;
                    offsetChild = null;
                }
            }
            if (offsetChild && isElementNode(offsetChild)) {
                // We have a valid handle on a DOMElement, so use appendElt()
                // in case there's an id on this element
                appendElt(offsetChild);
            } else {
                appendStep({type : CFI.kEpubCFIStepTypeChild, index : cfiOffset});
            }
            // if we're pointing at a text node in the middle of a collection, we need to add the character offset too
            // So let's figure that out
            if (offsetChild && !isElementNode(offsetChild)) {
                // find out if there are any previous siblings that are text before we hit an element
                // If not, we don't want to bother with the character offset
                for (var cursor = offsetChild.previousSibling; cursor && !isElementNode(cursor); cursor = cursor.previousSibling) {
                    if (isTextNode(cursor)) {
                        // Found one, put our node into obj so we handle it below in the character offset code
                        obj = offsetChild;
                        objOffset = 0;
                        break;
                    }
                }
            }
        }
        if (!isElementNode(obj)) {
            // it's character data
            // We might be a collection of non-element nodes, so add the length of our previous siblings
            for (var prev = obj.previousSibling; prev != null && (!isElementNode(prev) || CFI._isNodeHiddenFromCFI(prev)); prev = prev.previousSibling) {
                // skip the element being hidden from CFI and include the text range from the preceeding text sibling - fettes
                if (CFI._isNodeHiddenFromCFI(prev))
                    continue;
                    
                if (isTextNode(prev)) {
                    objOffset += prev.length;
                }
            }
            appendStep({type : CFI.kEpubCFIStepTypeCharacterOffset, offset : objOffset});
            // TODO: attach a text assertion?
        }
    }
    
    // iterate over the documents in turn, in reverse order (root document first)
    var elementCount = elements.length;
    elements.reverse();
    var skipNextElement = false;
    for (var elementIndex = 0; elementIndex < elementCount; ++elementIndex) {
        var element = elements[elementIndex];
        
        appendStep({type : CFI.kEpubCFIStepTypeIndirection});
        
        var startOffset = -1; // only useful for the last iteration
        if (elementIndex == (elementCount - 1)) { // this is the last iteration, grab our offset from the range
            startOffset = range.startOffset;
            // since the startContainer is just a DOMNode, it might be something we can't actually index into in CFI
            // So walk upwards until we find something usable
            while (element != null && !isElementNode(element) && !isTextNode(element)) {
                // figure out the index of obj within its parent node
                // We can't use calculateOffset() because that does a CFI-style calculation, and we want a regular index
                startOffset = indexIntoParent(element);
                element = element.parentNode;
            }
        }
        if (element == null) {
            // how'd this happen?
            console.error("No usable element found.");
            return null;
        }

        // now that we have an element or text node, build an array of all parent elements excluding the document root
        var parents = [element];
        for (var temp = element.parentElement; temp != null; temp = temp.parentElement) {
            if (temp.parentElement != null) {
                parents.push(temp);
            }
        }
        
        var appendElt = function(elt) {
            appendStep({type : CFI.kEpubCFIStepTypeChild, index : calculateOffset(elt)});
            if (elt.id && elt.id.length) {
                // this element has an id
                appendStep({type : CFI.kEpubCFIStepTypeAssertion, value : elt.id, parameters : null });
            }
        }

        // now walk that array in reverse order, building up the intermediate steps
        parents.reverse();
        var parentCount = parents.length;
        var endObj = null, endOffset = -1;
        for (var parentIndex = 0; parentIndex < parentCount; ++parentIndex) {
            var elt = parents[parentIndex];
            if ((parentIndex == (parentCount - 1)) && elt.isSameNode(elt.ownerDocument.documentElement)) {
                // we've got the document element in here. We don't want a step for that
            } else {
                appendElt(elt);
            }
            if (elt == commonAncestor) {
                // We just processed our common ancestor. Do we have a non-collapsed range?
                if (!range.collapsed) {
                    // Double-check that our end object, when clamped to text/element nodes, is still non-collapsed
                    endObj = range.endContainer;
                    endOffset = range.endOffset;
                    while (endObj && !isElementNode(endObj) && !isTextNode(endObj)) {
                        endOffset = indexIntoParent(endObj);
                        endObj = endObj.parentNode;
                    }
                    if (endObj == element && endOffset == startOffset) {
                        // This is collapsed after all
                        endObj = null;
                    } else {
                        // We have a truly non-collapsed range. Save our common steps now
                        noteStepCount();
                    }
                }
            }
        }

        // now we need to handle the startOffset
        if (startOffset >= 0) {
            handleOffset(element, startOffset, false);
        }
        if (endObj != null) {
            noteStepCount();
            // we've handled the start, now we need to handle the end
            // Recalculate parents between endObj and commonAncestor
            parents = new Array(); // FIXME, clear?
            for (var cursor = endObj; cursor != null && cursor != commonAncestor; cursor = cursor.parentElement) {
                parents.push(cursor);
            }
            parents.reverse();
            parents.forEach(appendElt);
            // repeat the offset calculation
            handleOffset(endObj, endOffset, true);
        }
    }
    
    // store our steps
    noteStepCount();
    var startStepsPtr = rootStepCount;
    var endStepsPtr = startStepsPtr + startStepCount;
    var stepsEnd = endStepsPtr + endStepCount;
    
    // Fix up the range in the case where the start and end sub-paths have a common prefix
    // We can't detect this easily above because of the way DOMRanges work
    // Note: after we're done, the start sub-path SHOULD be empty, but the code below doesn't make this assumption
    if ((startStepCount > 0) && (endStepCount > 0)) {
        // this is a range, we have start and end steps
        // Find the number of common steps. This may be more than 1 due to assertions.
        var prefixLen = 0;
        var minStepCount = Math.min(startStepCount, endStepCount);
        for (var i = 0; i < minStepCount; ++i) {
            if (CFI._compareStep(steps[i + startStepsPtr], steps[i + endStepsPtr]) == CFI.NSOrderedSame) {
                prefixLen = i + 1;
            } else {
                break;
            }
        }
        if (prefixLen > 0) {
            // We have identical steps at the start of both sub-paths.
            // Move over our start step counter, then overwrite the prefix on the end steps (after freeing them)
            startStepsPtr += prefixLen;
            if ((endStepsPtr + prefixLen) < stepsEnd) {
                // Remove the shared steps from the end range
                steps.splice(endStepsPtr, prefixLen);
            }
            // TODO fixup rootStepCount, startStepCount.
            stepsEnd -= prefixLen;
        }
    }
    
    // Calculate our CFI string and return
    var cfi = ["epubcfi("];
    CFI._formatSteps(cfi, steps, 0, startStepsPtr);
    if (stepsEnd > startStepsPtr) {
        cfi.push(',');
        CFI._formatSteps(cfi, steps, startStepsPtr, endStepsPtr);
        cfi.push(',');
        CFI._formatSteps(cfi, steps, endStepsPtr, stepsEnd);
    }
    cfi.push(')');
    
    var result = cfi.join('');
    
    if (!CFI._isValid(steps,startStepsPtr,endStepsPtr,stepsEnd))
    {
        console.error("CFI {" + result + "} is invalid and may cause problems.");
    }
    
    return result;
}

// commonly used regular expressions. All anchored for efficiency.
CFI.FORWARD_SLASH = /^\//;
CFI.DECIMAL_DIGITS = /^[0-9]+/;
CFI.COLON =/^:/;
CFI.TILDE = /^~/;
CFI.AT_SIGN = /^@/;
CFI.LEFT_SQUARE = /^\[/;
CFI.RIGHT_SQUARE = /^\]/;
CFI.NOT_RIGHT_SQUARE = /^[^\]]+/;
CFI.BANG = /^!/;
CFI.COMMA = /^,/;
CFI.NOT_EQUAL = /^(?:\^.|[^=])+/;
CFI.EQUAL = /^=/;
CFI.SEMI = /^;/;
CFI.NOT_SEMI = /^(?:\^.|[^;])+/;
CFI.NEITHER_RIGHT_SQUARE_NOR_SEMI = /^(?:\^.|[^\];])+/;
CFI.NEITHER_COMMA_NOR_SEMI = /^(?:\^.|[^,;])+/;

CFI._parseTypeAssertion = function(steps, scanner) {
    var value = CFI._unescapeString(scanner.match(CFI.NEITHER_RIGHT_SQUARE_NOR_SEMI));
    var parameters = null;
    if (scanner.match(CFI.SEMI)) {
        parameters = new Object();
        do {
            var key = CFI._unescapeString(scanner.match(CFI.NOT_EQUAL));
            var eq = scanner.match(CFI.EQUAL);
            console.assert(eq);
            var value = CFI._unescapeString(scanner.match(CFI.NEITHER_RIGHT_SQUARE_NOR_SEMI));
            console.assert(value);
            parameters[key] = value;
        } while (scanner.match(CFI.SEMI));
    }
    var rb = scanner.match(CFI.RIGHT_SQUARE);
    steps.push({type : CFI.kEpubCFIStepTypeAssertion, 'value' : value, 'parameters' : parameters});
}

CFI._parseCharacterOffsets = function(steps, scanner) {
    // any text assertions following?
    var digits = scanner.match(CFI.DECIMAL_DIGITS);
    console.assert(digits);
    steps.push({type : CFI.kEpubCFIStepTypeCharacterOffset, 'offset' : Number(digits)});
    if (scanner.match(CFI.LEFT_SQUARE)) {
        var textAssertions = scanner.match(CFI.NOT_RIGHT_SQUARE);
        var prefix = CFI._unescapeString(scanner.match(CFI.NEITHER_COMMA_NOR_SEMI));
        var suffix = CFI._unescapeString(scanner.match(CFI.COMMA) ? scanner.match(CFI.NOT_SEMI) : null);
        var parameters = null;
        if (scanner.match(CFI.SEMI)) {
            parameters = new Object();
            do {
                var key = CFI._unescapeString(scanner.match(CFI.NOT_EQUAL));
                var eq = scanner.match(CFI.EQUAL);
                console.assert(eq);
                var value = CFI._unescapeString(scanner.match(CFI.NEITHER_RIGHT_SQUARE_NOR_SEMI));
                console.assert(value);
                parameters[key] = value;
            } while (scanner.match(CFI.SEMI));
        }
        scanner.match(']');
        steps.push({type : CFI.kEpubCFIStepTypeTextAssertion, 'prefix' : prefix, 'suffix' : suffix, 'parameters' : parameters});
    }
}

/*
    // TODO:  file a bug on WebKit's DOM tree walker, which apparently isn't working at all.
    // for some reason, using NodeFilter.SHOW_ELEMENT is also returning comment nodes.
    var nodeFilter = {
        acceptNode: function(node) {
            return (node.nodeType == Node.ELEMENT_NODE ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP);
        }
    };
    var elements = document.createTreeWalker(document.documentElement.firstChild, NodeFilter.SHOW_ELEMENT, nodeFilter, false);
*/

CFI._fixCharacterOffsetOverrun = function(leafContext)
{
    var success = false;
    
    // TODO: Maybe there are multiple ignored elements?
    
    var foundNode = leafContext.foundNode;
    var foundOffset = leafContext.foundOffset;
    var foundNodeLength = foundNode.length;
    var nextSibling = foundNode.nextSibling;
    var candidateSibling = nextSibling != null ? nextSibling.nextSibling : null;
    
    if ((CFI._isNodeHiddenFromCFI(nextSibling) || nextSibling.nodeType == Node.COMMENT_NODE)
        && candidateSibling != null &&
        !CFI.isElementNode(candidateSibling))
    {
        // Skip the next sibling that is hidden from CFI and use the next non-element sibling
        leafContext.foundNode = candidateSibling;
        
        // The delta that extends into candidateSibling
        leafContext.foundOffset = foundOffset - foundNodeLength;
        
        // Assume success before we double check below.
        success = true;
        
        if (leafContext.foundOffset > leafContext.foundNode.length)
        {
            // Something went wrong. Probably a bad CFI here and it would actually need to be fixed like the non-hidden case. - fettes
            console.error("Overran the following sibling by " + (leafContext.foundOffset - leafContext.foundNode.length) + " when attempting to overrun a hidden element.");
            success = false;
        }
    }
    
    return success;
}


CFI.parseCFI = function(cfi) {
    if (!cfi || cfi.substring(0,"epubcfi(".length) != "epubcfi(") {
        // guard against an empty string, but a malformed epubcfi can still cause a web process spin
        return null;
    }
    // strip off "epubcf(", ")" parts.
    var scanner = {
        text: cfi.substring("epubcfi(".length, cfi.length - ")".length),
        eof: false,
        match: function(expr) { // returns the token matched, if it's at the front of the scanner, and pops it off the scanner
            var text = this.text;
            var hit = text.match(expr);
            if (hit != null && hit.index == 0) {
                text = text.substring(hit[0].length); // advance to next token
                this.text = text; // update scanner text
                this.eof = (text.length == 0);
                return hit[0]; // return matched token
            }
            return null;
        },
        advance : function(length) { // advances the pointer in the string by length.
            var text = this.text.substring(length);
            this.text = text;
            this.eof = (text.length == 0);
        }
    }
    var steps = null, spineSteps = null, chapterSteps = null, prefixSteps = null, suffixSteps = null;
    spineSteps = steps = new Array();
    while (!scanner.eof) {
        // CFI elements start with '/', '!' or ','.
        if (scanner.match(CFI.FORWARD_SLASH)) {
            // each component starts with a numeric index. even, even, ..., odd
            var digits = scanner.match(CFI.DECIMAL_DIGITS);
            var index = Number(digits);
            steps.push({ type : CFI.kEpubCFIStepTypeChild, 'index' : index});
            if (scanner.match(CFI.LEFT_SQUARE)) {
                CFI._parseTypeAssertion(steps, scanner);
                continue;
            }
            if (scanner.match(CFI.COLON)) {
                // TODO: assert that index is odd, since character offsets can only occur in the final position.
                CFI._parseCharacterOffsets(steps, scanner);
                continue;
            }
            if (scanner.match(CFI.TILDE)) {
                // TODO - Temporal Offset
                console.warn("Temporal offsets are not currently supported");
                return null;
            }
            if (scanner.match(CFI.AT_SIGN)) {
                // TODO - Spatial Offset
                console.warn("Spatial offsets are not currently supported");
                return null;
            }
            continue;
        }
        if (scanner.match(CFI.BANG)) {
            // indirection step.
            // start accumulating into chapterSteps.
            chapterSteps = steps = new Array();
            continue;
        }
        if (scanner.match(CFI.COMMA)) {
            // a simple range.
            if (prefixSteps == null) {
                prefixSteps = steps = new Array();
            } else if (suffixSteps == null) {
                suffixSteps = steps = new Array();
            } else {
                console.error("Too many components in the CFI range");
                return null;
            }
            continue;
        }
        if (prefixSteps) {
            if (scanner.match(CFI.COLON)) {
                // these can appear as simple ranges.
                CFI._parseCharacterOffsets(steps, scanner);
                continue;
            }
        }
    }
    // find the last node along the path we've parsed so far.
    // a little state machine for locating CFI nodes.
    // Returns the indexedNode object.
    var indexedNode = {
        init: function(node, found, valid) {
            this.node = node; // the node, or the one following if the node doesn't exist
            this.found = found; // whether the node exists
            this.valid = valid; // false if the index is invalid
            // if node is null and valid is true, collapse to the end of the parent's children
            return this;
        }
    };
    var nodeForIndex = function(parent, index) {
        var node = parent.firstChild;
        if (index == 0) {
            // proposed extension to CFI
            return indexedNode.init(node, false, true);
        }
        var i = 0;
        var skipTextIncrement = false;
        var skipNextIncrement = false;
        while (node != null) {
            if (skipNextIncrement || CFI._isNodeHiddenFromCFI(node))
            {
                skipNextChild = CFI._isNodeHiddenFromCFI(node) && CFI._skipNodeAfterPageBreak;
                node = node.nextSibling;
                continue;
            }
            if (node.nodeType == Node.ELEMENT_NODE) {
                ++i;   // always increment for elements
                if ((i & 1) == 1) { // index is odd
                    if (i == index) break;
                    ++i;
                }
            } else if (node.nodeType != Node.COMMENT_NODE) {
                if ((i & 1) == 0) { // index is even
                    ++i;
                }
                skipTextIncrement = false;
            }
            if (i == index) break;
            node = node.nextSibling;
        }
        return indexedNode.init(node, node && (node.nodeType == Node.ELEMENT_NODE) == ((i & 1) == 0), ((i&~1)+2 >= index));
    };
    var leafContext = {
        init : function(parent) {
            this.parent = parent.parentNode;
            this.foundNode = parent;
            this.nodeIsGood = true;
            this.foundOffset = null;
            this.collapseAtFront = true;
            this.valid = true;
        }
    };
    leafContext.init(document.documentElement);
    var locateLeaves = function(step, idx) {
        if (step.type == CFI.kEpubCFIStepTypeAssertion) {
            // Check the current node
            var node = leafContext.foundNode;
            var isCorrectNode = node && node.hasAttribute("id") && node.getAttribute("id") == step.value;
            
            // Fixup the current node.
            if (!isCorrectNode)
            {
                var foundNode = document.getElementById(step.value);
                if (foundNode)
                {
                    leafContext.foundNode = foundNode;
                    leafContext.nodeIsGood = true;
                    leafContext.valid = true;
                }
                return;
            }
        }
        if (step.type == CFI.kEpubCFIStepTypeChild) {
            if (!leafContext.nodeIsGood) {
                // TODO: implement CFI repairing
                leafContext.valid = false;
                console.warn("Stepping into zero-length text node group; CFI repairing not implemented");
                return;
            }
            if (leafContext.foundOffset != null) {
                // we can't have a child after a character offset
                leafContext.valid = false;
                console.error("Child step found after character offset");
                return;
            }
            // find the node for this level.
            var index = step.index;
            var foundNode = nodeForIndex(leafContext.foundNode, index);
            if (!foundNode.valid) {
                leafContext.valid = false;
                console.warn("Stepping past end of children array; CFI repairing not implemented");
                return;
            }
            leafContext.parent = leafContext.foundNode;
            leafContext.foundNode = foundNode.node;
            leafContext.nodeIsGood = foundNode.found;
            leafContext.collapseAtFront = (foundNode.node != null);
            
            if (!foundNode.found)
            {
                var msg = ["Unable to find node for step "];
                CFI._formatStep(msg,step);
                console.warn(msg.join());
            }
            
        } else if (step.type == CFI.kEpubCFIStepTypeCharacterOffset) {
            if (!leafContext.nodeIsGood) {
                // TODO: implement CFI repairing
                leafContext.valid = false;
                console.warn("Character offset into zero-length text node group; CFI repairing not implemented");
                return;
            }
            if (leafContext.foundOffset != null) {
                // we can't have two character offsets
                console.error("Character offset found after character offset");
                leafContext.valid = false;
                return;
            }
            if (leafContext.foundNode.nodeType != Node.TEXT_NODE && leafContext.foundNode.nodeType != Node.CDATA_SECTION_NODE) {
                // We can't have a character offset if the node isn't a text node
                console.error("Character offset found after element node");
                leafContext.valid = false;
                return;
            }
            leafContext.foundOffset = step.offset;
            // we may need to adjust the pointed-to node to point to another node in the text-node group
            var offset = step.offset;
            for (var cursor = leafContext.foundNode; cursor != null && (cursor.nodeType != Node.ELEMENT_NODE || CFI._isNodeHiddenFromCFI(cursor)); cursor = cursor.nextSibling) {
                // skip the element being hidden from CFI and allow the CFI to expand into the following text node.
                if (CFI._isNodeHiddenFromCFI(node))
                {
                    continue;
                }
                if (cursor.nodeType == Node.TEXT_NODE || cursor.nodeType == Node.CDATA_SECTION_NODE) {
                    if (offset <= cursor.length) {
                        leafContext.foundNode = cursor;
                        leafContext.foundOffset = offset;
                        break;
                    }
                    offset -= cursor.length;
                }
            }
        }
    };
    if (chapterSteps.length) {
        chapterSteps.forEach(locateLeaves);
        if (!leafContext.valid)
        {
            console.warn("Leaf context is not valid.");
            return null;
        }
    } else {
        // chapterSteps will be empty for range.selectNode(document.documentElement)
        leafContext.foundNode = document.documentElement;
        leafContext.nodeIsGood = true;
    }
    var range = document.createRange();
    if (prefixSteps && suffixSteps) {
        // parse the sub-paths as well.
        if (!leafContext.nodeIsGood) {
            console.warn("Leaf context node is no good.");
            return null;
        }
        var rootElement = leafContext.foundNode;  // start at the bottom of the common sub-tree.
    
        // find the prefix node/offset.
        leafContext.init(rootElement);
        prefixSteps.forEach(locateLeaves);
        if (!leafContext.valid) return null;
        if (leafContext.foundOffset != null) {
            if (leafContext.foundOffset > leafContext.foundNode.length)
            {
                if (!CFI._fixCharacterOffsetOverrun(leafContext))
                {
                    // TODO: repair text
                    console.warn("Character offset past end of text node group; CFI repairing not implemented.");
                    return null;
                }
            }
            range.setStart(leafContext.foundNode, leafContext.foundOffset);
        } else {
            if (leafContext.foundNode == null) {
                range.selectNodeContents(leafContext.parent);
            } else if (leafContext.collapseAtFront) {
                range.setStartBefore(leafContext.foundNode);
            } else {
                range.setStartAfter(leafContext.foundNode);
            }
        }

        // find the suffix node/offset.
        leafContext.init(rootElement);
        suffixSteps.forEach(locateLeaves);
        if (!leafContext.valid) return null;
        if (leafContext.foundOffset != null) {
            if (leafContext.foundOffset > leafContext.foundNode.length)
            {
                if (!CFI._fixCharacterOffsetOverrun(leafContext))
                {
                    // TODO: repair text
                    console.warn("Character offset past end of text node group; CFI repairing not implemented.");
                    return null;
                }
            }
            range.setEnd(leafContext.foundNode, leafContext.foundOffset);
        } else {
            if (leafContext.foundNode == null) {
                range.setEnd(leafContext.parent, leafContext.parent.childNodes.length);
            } else if (leafContext.collapseAtFront) {
                range.setEndBefore(leafContext.foundNode);
            } else {
                range.setEndAfter(leafContext.foundNode);
            }
        }
    } else {
        if (leafContext.foundOffset != null) {
            if (leafContext.foundOffset > leafContext.foundNode.length)
            {
                if (!CFI._fixCharacterOffsetOverrun(leafContext))
                {
                    // TODO: repair text
                    console.warn("Character offset past end of text node group; CFI repairing not implemented.");
                    return null;
                }
            }
            range.setStart(leafContext.foundNode, leafContext.foundOffset);
            range.setEnd(leafContext.foundNode, leafContext.foundOffset);
        } else {
            if (leafContext.foundNode == null) {
                range.selectNodeContents(leafContext.parent);
            } else {
                range.selectNode(leafContext.foundNode);
            }
        }
        range.collapse(leafContext.collapseAtFront);
    }
    return range;
}

CFI.ESCAPED_CHAR = /\^(.|$)/g;

CFI._unescapeString = function(str) {
    return str ? str.replace(CFI.ESCAPED_CHAR, "$1") : str;
}

CFI.SPECIAL_CHARS = /[\^\[\](),;=]/g;

CFI._escapeString = function(str) {
    return str ? str.replace(CFI.SPECIAL_CHARS, "^$&") : str;
}

function CFIUtilities() {
    // CFIUtilities is a singleton for doing things with CFI's. It has no instances.
}

CFIUtilities._rubylessStringFromSelection = function(selection)
{
    var rubylessString = "";
    var rangeContents = selection.getRangeAt(0).cloneContents();
    
    // See: http://www.w3.org/TR/ruby/#ruby
    var rubyNodes = rangeContents.querySelectorAll("rb, rt, rp");
    if (rubyNodes.length > 0)
    {
        for (var i = 0; i < rubyNodes.length; i++)
        {
            var parentNode = rubyNodes[i].parentNode;
            if (parentNode)
                parentNode.removeChild(rubyNodes[i]);
        }
        rubylessString = rangeContents.textContent;
    }
    else
    {
        rubylessString = selection.toString();
    }
    
    return rubylessString;
}

CFIUtilities._ancestorElementWithTagName = function(node, elementName)
{
    var result;
    
    if (node != null)
    {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName == elementName))
            result = node;
        else
            result = CFIUtilities._ancestorElementWithTagName(node.parentNode, elementName);
    }
    
    return result;
}

CFIUtilities._contextForSelection = function ()
{
	// Save off the original selection range.
	var selection = getSelection ();
	var initialRange = selection.getRangeAt(0).cloneRange();
	
    // Find the start of the context string.
    selection.collapseToStart();
    selection.modify ("extend", "forward", "character");
    selection.modify ("extend", "backward", "sentence");
    var contextStartRange = selection.getRangeAt(0).cloneRange();
    var selectionOffset = CFIUtilities._rubylessStringFromSelection(selection).length;

    // Find the end of the context.
    selection.empty ();
    selection.addRange (initialRange);
    selection.collapseToEnd ();
    selection.modify ("extend", "backward", "character");
    selection.modify ("extend", "forward", "sentence");
    
    // Construct the final context range and set the selection.
    var contextRange = selection.getRangeAt(0).cloneRange();
    contextRange.setStart(contextStartRange.startContainer, contextStartRange.startOffset);
    selection.empty();
    selection.addRange(contextRange);
    
    // Get a ruby-less context string.
    var contextString = CFIUtilities._rubylessStringFromSelection(selection);
    
    // Restore the original selection.
    selection.empty();
    selection.addRange(initialRange);
    
    // Due to a WebKit bug (<rdar://problem/14690019>) related to selection ranges,
    // we don't always calculate the right offset into the context string. As a last
    // ditch hacky effort, detect the condition and try to recover by scanning the
    // context string for the selection string. Good times. If the WebKit bug gets fixed
    // then this can go away.
    var selectionString = CFIUtilities._rubylessStringFromSelection(selection);
    var selectionLength = selectionString.length;
    if (selectionString != contextString.substr(selectionOffset, selectionLength))
    {
        var bestDelta = 0;
        var bestOffset = selectionOffset;
        var nextOffset = contextString.indexOf(selectionString, 0);
        while (nextOffset != -1)
        {
            var delta = Math.abs(selectionOffset - nextOffset);
            if ((bestDelta == 0) || (delta < bestDelta))
            {
                bestDelta = delta;
                bestOffset = nextOffset;
            }
            
            // If the offsets are moving away, we're not going to find a better
            // candidate so just break out now.
            if (bestOffset > selectionOffset)
            {
                break;
            }
            
            nextOffset = contextString.indexOf(selectionString, nextOffset + selectionLength);
        }
        selectionOffset = bestOffset;
    }
    
    return {string:contextString, start:selectionOffset};
}

CFIUtilities.contextForSelectionInBook = function ()
{
	// Get contextual string for selection.
	var context = CFIUtilities._contextForSelection ();
	
	return JSON.stringify ({context: context.string, offset: context.start});
}

CFIUtilities.getSelectedRange = function() {
    var sel = window.getSelection();
    if (sel.type == "Range") {
        var range = sel.getRangeAt(0);
        var selectedText = CFIUtilities._rubylessStringFromSelection(sel);
        var contextText = CFIUtilities.contextForSelectionInBook();
        
        // <rdar://problem/14729094> Triple click + highlight annotates next paragraph
        // Triple-clicks put the end container as the next element (like a <p> tag)
        // but have the range's endOffset == 0. Because there's no offset into the
        // end, there's no reason to have the container be the end, so just set
        // it before so the range don't over-extend its bounds and getClientRects()
        // subsequently gets an extra bounding rect of the end element.
        var trimmedRange = range;
        if (trimmedRange.endOffset == 0)
        {
            trimmedRange.setEndBefore(range.endContainer);
        }

        var cfiLocation = CFI.computeCFI(null, null, null, trimmedRange);
        var rangeRects = CFIUtilities._rectsForRange(trimmedRange);
        var selectionSnippet = {selectionText: selectedText, contextText: contextText, cfi:cfiLocation, rects:rangeRects}
        return JSON.stringify(selectionSnippet);
    }
    return null;
}

CFIUtilities.selectedText = function() {
	var selection = getSelection ();
	return selection.toString ();
}

CFIUtilities.setSelectedRange = function(locationCFI) {
    var range = CFI.parseCFI(locationCFI);
    if (range) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
    }
    return false;
}

CFIUtilities.clearSelection = function() {
    var sel = window.getSelection();
    sel.removeAllRanges();
    return true;
}

CFIUtilities._rectsForRange = function (range)
{
    var clientRects = new Array();
    var rlist = range.getClientRects();
    for (var i = 0; i < rlist.length; ++i) {
        var r = rlist[i];
        
        clientRects.push({left: window.pageXOffset + r.left, // Adjust for scroll within web view
                         top:r.top, width: r.width, height: r.height});
    }
    return clientRects;
}

CFIUtilities.getClientRects = function(cfiArray) {
    var resultRects = [];
    for (var i = 0; i < cfiArray.length; i++)
    {
        var cfi = cfiArray[i];
        var rects = CFIUtilities.getClientRectsForCFI(cfi) || [];
        resultRects.push(rects);
    }
    return JSON.stringify(resultRects);
}

CFIUtilities.getClientRectsForCFI = function(locationCFI) {
    var range = CFI.parseCFI(locationCFI);

    var clientRects = null;
    if (range) {
        // Find all the ruby rects we need to reject
        var rubies = document.querySelectorAll("ruby > rt");
        
        var allRubyRects = [];
        for (var i = 0; i < rubies.length; i++)
        {
            var rubyRange = document.createRange();
            rubyRange.selectNode(rubies[i]);
            var rubyRects = CFIUtilities._rectsForRange(rubyRange);
            for (var j = 0; j < rubyRects.length; j++)
            {
                allRubyRects.push(rubyRects[j]);
            }
        }

        // Get the client rects for the CFI's range
        clientRects = CFIUtilities._rectsForRange(range);
        
        // Filter the rects by rejecting ruby rects
        var filteredRects = [];
        for (var i = 0; i < clientRects.length; i++)
        {
            var clientRect = clientRects[i];
            
            // indexOf() doesn't work, so compare the dictionary
            // values to determine equality.
            var found = false;
            for (var j = 0; j < allRubyRects.length; j++)
            {
                var rubyRect = allRubyRects[j];
                found = (rubyRect.left == clientRect.left) && (rubyRect.top == clientRect.top) && (rubyRect.width == clientRect.width) && (rubyRect.height == clientRect.height);
                if (found)
                {
                    break;
                }
            }
            
            // Only add rects that aren't ruby.
            if (!found)
            {
                filteredRects.push(clientRects[i]);
            }
        }
        
        // Reset to the filtered rects.
        clientRects = filteredRects;
    }
    
    if (clientRects)
    {
        return clientRects;
    }
    else
    {
        return null;
    }
}

CFIUtilities.getCFILocations = function(pointsJSON,isRTL) {
    var points = JSON.parse(pointsJSON);
    var count = points.length;
    var locations = new Array();
    var isVertical = BKDOMCleanup.getEffectiveWritingMode().indexOf("vertical") != -1;
    for (var i = 0; i < count; i += 2) {
        var x = points[i], y = points[i + 1];
        try {
            var range = document.caretRangeFromPoint(x, y);

            if (range)
            {
                // --- experiment to turn range from a caret into something with width
                
                // Set the selection to where the caret would be for the x,y points
                CFIUtilities.clearSelection();
                var selection = getSelection ();
                selection.addRange (range);
                
                var originalX = range.getClientRects().length == 0 ? x : range.getClientRects()[0].left;
                var clientRectsInRange = function(testRange)
                {
                    var kAnchorPointXOffset = 5;
                    var inRange = false;
                    if (testRange.getClientRects().length == 0)
                    {
                        // No client rects, assume in range due to no footprint
                        inRange = true;
                    }
                    else if (isRTL)
                    {
                        // Moving the range backwards in content and shifting it to a previous page will
                        // increase the clientRect.left coordinate, not decrease it.
                        inRange = testRange.getClientRects()[0].left <= originalX;
                    }
                    else
                    {
                        // Moving the range backwards and shifting it to a previous page will
                        // move the clientRect.left coordinate past the current 'page boundary' (x - paddingOffset).
                        inRange = testRange.getClientRects()[0].left >= x - kAnchorPointXOffset;
                    }
                    
                    return inRange;
                }
                
                // Check if there are any preceeding characters on the page that were
                // missed because the input point takes padding into account.
                
                var shiftedRange = range;
                selection.modify ("move", "backward", "character");
                
                if (selection.rangeCount > 0)
                {
                    var testRange = selection.getRangeAt(0);
                    
                    // Conditions for range shifting:
                    // 1. Make sure the ranges are actually different. i.e. there actually are preceding chars.
                    // 2. Make sure the testRange actually has client rects before we check it's coordinates in #3 (ex. page break <hr> has no client rects)
                    // 3. Finally, if the clientRect X is within the same page, shift backwards by 1 character.
                    //
                    // <rdar://problem/17348220> OSX: Opening attached Japanese ePub is very slow
                    // getClientRects() is returning an empty list for particular japanese documents.  Protect against
                    // infinite looping.
                    var maxCharactersToMove = 40;
                    
                    for (var shiftedCount = 0;
                         !(testRange.startContainer == shiftedRange.startContainer && testRange.startOffset == shiftedRange.startOffset)
                         && clientRectsInRange(testRange) && (shiftedCount < maxCharactersToMove);
                         shiftedCount++)
                    {
                        shiftedRange = testRange;
                        selection.modify ("move", "backward", "character");
                        testRange = selection.getRangeAt(0);
                    }
                }
                
                // When we're all done, reset the selection to our shifted range,
                // then extend the range forward to be 1 character long
                // then get the CFI for the resulting range.
                selection.removeAllRanges();
                selection.addRange (shiftedRange);
                selection.modify ("extend", "forward", "character");
                
                if (selection.rangeCount > 0)
                {
                    // Only update our range if we were able to shift it and get a real
                    // selection.
                    range = selection.getRangeAt(0);
                }
                // --- end experiment
            }
            else
            {
                // Somethings don't generate ranges with
                // caretRangeFromPoint(x,y)
                //
                // See the cover for this radar:
                // <rdar://problem/14432638>
                range = document.createRange();
                range.selectNodeContents(document.body);
            }
            
            var cfi = CFI.computeCFI(null, null, null, range);
            if (cfi == null)
            {
                console.error("No CFI computed for (" + x + "," + y + ") and  range {" + range + "}." );
            }
            locations.push(cfi);
        }
        catch(err) {
            console.error("Error occured calculating CFI location for (" + x + "," + y + "). " + err.message);
            locations.push("");
        }
    }
    CFIUtilities.clearSelection();
    return JSON.stringify(locations);
}

CFIUtilities.getAsideHTMLForID = function(elementId) {
    var element = document.getElementById(elementId);
    var html = "";
    if (element)
    {
        html = html + element.innerHTML;
    }
    
    return html;
}

var lastClickedAnchorID = null;
CFIUtilities.getAsideIDList = function() {
    var asideElements = document.querySelectorAll("a");
    var asideList = [];
    
    var count = asideElements.length;
    for (var i = 0; i < count; i++) {
        var anchor = asideElements[i];
        var epubType = anchor.getAttribute("epub:type");
        if (epubType && epubType.toLowerCase() == "noteref") {
            var href = anchor.getAttribute("href");
            var splitComponents = href.split("#");
            var anchorID = splitComponents[splitComponents.length - 1];
            
            var range = document.createRange();
            range.selectNodeContents(anchor);
            var cfi = CFI.computeCFI(null, null, null, range);
            
            var title = anchor.textContent;
            
            asideList.push({"anchorId":anchorID, "anchorCFI":cfi, "anchorTitle":title});
            
            // Workaround JS callbacks being missed due to the document already being "at" the location. Instead,
            // tweak a non-essential field so we re-trigger the logic to display the popover.
            anchor.__bk_original_addEventListener("click", function(event) {
                                                  var a = event.target; a.href = a.href.split("?")[0] + "?" + (new Date().getTime()) })
        }
    }
    
    return JSON.stringify(asideList);
}

CFIUtilities.clearInsertedBreak = function()
{
    var retVal = "false";
    
    // Clear other tracking issues
    if (CFI._insertedPageBreak != null)
    {
        var insertedPageBreak = CFI._insertedPageBreak;
        insertedPageBreak.parentNode.removeChild(insertedPageBreak);
        CFI._insertedPageBreak = null;
        retVal = "true";
    }
    else
    {
        console.warn("No inserted break to clear.");
    }
    
    return retVal;
}

CFIUtilities.breakAtCFI = function(cfi)
{
    // Clear other tracking issues
    if (CFI._insertedPageBreak != null)
    {
        CFIUtilities.clearInsertedBreak();
        console.error("Adding a new page break when one already existed.");
    }
    
    // Make a range to insert at the start of from the CFI
    var range = CFI.parseCFI(cfi);
    var insertedCFI = null;
    var containerLength = null;
    if (range)
    {
        containerLength = (range.endContainer.length || 0);
        
        // Using HR instead of BR because BR tags don't do page breaks
        var hr = document.createElement("hr");
        hr.setAttribute("style", "width: 0 !important; height: 0 !important; padding: 0 !important; margin: 0 !important; page-break-before:always !important");
        hr.appendChild(document.createTextNode(" "));
        range.insertNode(hr);
        
        // Detect insertion into middle of text node, splitting that text node in two. (Potentially naive)
        CFI._skipNodeAfterPageBreak = CFI.isTextNode(hr.previousSibling) && CFI.isTextNode(hr.nextSibling);
        
        // Inserted CFI
        var newRange = document.createRange();
        newRange.selectNodeContents(hr.childNodes[0]);
        newRange.startOffset = 0;
        newRange.endOffset = 1;
        
        // NOTE: This CFI will not have the inserted element hidden from computeCFI. Order is important here. - fettes
        insertedCFI = CFI.computeCFI(null, null, null, newRange);
        
        // Add for tracking. insertedCFI will include this element due to us hiding it after we calculated the CFI. - fettes
        CFI._setNodeHiddenFromCFI(hr);
    }

    // Package up data to send back
    var result = {};
    if (insertedCFI)
    {
        result["insertedCFI"] = insertedCFI;
    }
    if (containerLength)
    {
        result["containerLength"] = containerLength;
    }
    return JSON.stringify(result);
}

CFIUtilities.getAnchorCFIs = function() {
    var anchorToCFI = {};
    
    // Alright, here's the current priority.
    // - first element with an id
    // - first element with a name (if no id was found)
    
    var addElements = function(elements)
    {
        var count = elements.length;
        for (var i = 0; i < count; i++) {
            var anchor = elements[i];
            var name = anchor.id;
            if (!name) {
                name = anchor.getAttribute("name");
            }
            
            // Collapse the element to the start
            var range = document.createRange();
            range.selectNodeContents(anchor);
            range.collapse(true);
            
            // Select the first character (like page CFIs)
            var selection = getSelection ();
            selection.empty ();
            selection.addRange (range);
            selection.modify ("extend", "forward", "character");
            if (selection.rangeCount > 0)
            {
                range = selection.getRangeAt(0);
            }
            
            // Add it if it's the first into the lookup
            if (!anchorToCFI[name])
            {
                anchorToCFI[name] = CFI.computeCFI(null, null, null, range);
            }
        }
    }
    
    // ID is first
    var idElements = document.querySelectorAll("*[id]");
    addElements(idElements);
    
    // Names are second
    var nameElements = document.querySelectorAll("*[name]");
    addElements(nameElements);
    
    // Clear selection
    CFIUtilities.clearSelection();
    
    return JSON.stringify(anchorToCFI);
}


// NOT to be used from iBooks in general.
CFIUtilities.elementFromCFI = function (cfi) {
    var range = CFI.parseCFI(cfi);
    var element = null;
    if (range)
    {
        element = range.startContainer;
    }
    return element;
}

CFIUtilities.pauseAudioVideoCFI = function (cfi) {
    var element = CFIUtilities.elementFromCFI(cfi);
    var retVal = "false"; // string for the bridge
    if (element)
    {
        element.pause();
        retVal = "true";
    }
    return retVal;
}

CFIUtilities.playAudioVideoCFI = function (cfi) {
    var element = CFIUtilities.elementFromCFI(cfi);
    var retVal = "false"; // string for the bridge
    if (element)
    {
        element.play();
        retVal = "true";
    }
    return retVal;
}

CFIUtilities.getAudioAndVideoCFIs = function() {
    var avList = [];
    
    var elements = document.querySelectorAll("video[ibooksautoplay=true], audio[ibooksautoplay=true]");
    
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        
        var avData = {};
        avData["type"] = (element.tagName || "").toLowerCase();
        
        // Collapse the <audio>/<video> tag to the start
        var range = document.createRange();
        range.selectNodeContents(element);
        
        
        // Generate a CFI for this element
        avData["cfi"] = CFI.computeCFI(null, null, null, range);
        
        // Add to the list
        avList.push(avData);
    }
    
    return JSON.stringify(avList);
}

// Wrapper tool to only execute JS once
CFIUtilities.getAnchorsAndAsides = function() {
    var retVal = {};
	retVal["anchors"] = CFIUtilities.getAnchorCFIs();
	retVal["asides"]  = CFIUtilities.getAsideIDList();
    retVal["av"]      = CFIUtilities.getAudioAndVideoCFIs();
	return JSON.stringify(retVal);
}

/*
Experimental code, doesn't work with way iBook's views are set up. The client rects don't easily
transform from here into canvas coordinates. Left here for historical reasons.
CFIUtilities._getHighlightContext = function(container) {
    // associate a canvas with the specified container.
    var ctx = null;
    var contexts = CFIUtilities.contexts;
    if (!contexts) {
        CFIUtilities.contexts = contexts = new Object();
    } else {
        ctx  = contexts[container];
        if (ctx) return ctx;
    }
    // set up a new context for our container.
    container.style.background = '-webkit-canvas(CFIUtilities)';
    ctx = document.getCSSCanvasContext("2d", "CFIUtilities", container.clientWidth, window.innerHeight);
    ctx.fillStyle = "yellow";
    contexts[container] = ctx;
    return ctx;
}

CFIUtilities.annotateSelectedRange = function(spineIndex, chapterIndex, manifestId) {
    var sel = window.getSelection();
    if (sel.type == "Range") {
        var range = sel.getRangeAt(0);
        var annotationCFI = CFI.computeCFI(spineIndex, chapterIndex, manifestId, range);
        if (annotationCFI) {
            var container = document.body;
            var ctx = CFIUtilities._getHighlightContext(container);
            var rlist = range.getClientRects();
            var r0 = rlist[0];
            console.log('r0 = { left: ' + r0.left + ', top: ' + r0.top + ', width: ' + r0.width + ', height: ' + r0.height + ' }');
            for (var i = 0; i < rlist.length; ++i) {
                var r = rlist[i];
                ctx.fillRect(r.left % window.innerWidth, r.top, r.width, r.height);
            }
            sel.removeAllRanges();
            return annotationCFI;
        }
    }
    return null;
}

CFIUtilities.addAnnotation = function(annotationCFI) {
    var range = CFI.parseCFI(annotationCFI);
    if (range) {
        var container = document.documentElement;
        var ctx = CFIUtilities._getHighlightContext(container);
        var rlist = range.getClientRects();
        for (var i = 0; i < rlist.length; ++i) {
            var r = rlist[i];
            ctx.fillRect(r.left + container.scrollLeft, r.top + container.scrollTop, r.width, r.height);
        }
    }
}

CFIUtilities.removeAnnotation = function(annotationCFI) {
    var range = CFI.parseCFI(annotationCFI);
    if (range) {
        var container = document.documentElement;
        var ctx = CFIUtilities._getHighlightContext(container);
        var rlist = range.getClientRects();
        for (var i = 0; i < rlist.length; ++i) {
            var r = rlist[i];
            ctx.clearRect(r.left + container.scrollLeft, r.top + container.scrollTop, r.width, r.height);
        }
    }
}
*/

// Captures the CFI of elements that were clicked on.
var stashedCFI = null;

var stashCFIForClickedElement = function (event) {
    var element = event.target;
    var range = document.createRange();
    range.setStart(element, 0);
    range.setEndAfter(element);
    // Stash the computed CFI
    stashedCFI = CFI.computeCFI(null, null, null, range);
}

this.StyledClone = {};

StyledClone.cloneStyleIntoStyle = function(srcStyle, dstStyle)
{
	for (var index = 0, length = srcStyle.length; index < length; ++index)
	{
		var property = srcStyle[index];
		dstStyle.setProperty(property, srcStyle.getPropertyValue(property), srcStyle.getPropertyPriority(property));
	}
}

StyledClone.cloneElementWithStyle = function(element)
{
	var clone = element.cloneNode(false);
    
	if(element.nodeType == 1)
	{
		var matched = getMatchedCSSRules(element, '');
        
		if (matched)
		{
			// todo -- verify that we're iterating in the right direction
			for (var index = 0, length = matched.length; index < length; ++index)
			{
				var style = matched[index].style;
				StyledClone.cloneStyleIntoStyle(style, clone.style);
			}
            
			StyledClone.cloneStyleIntoStyle(element.style, clone.style);
		}
	}
    
	return clone;
}

StyledClone.cloneSubtreeIntoElementUntil = function(firstChild, destinationContainer, endContainer, endOffset)
{
	var foundEnd = false;
    
	for (var child = firstChild; foundEnd == false && child != null; child = child.nextSibling)
	{
        if (CFI._isNodeHiddenFromCFI(child))
            continue;
        
		var childClone = StyledClone.cloneElementWithStyle(child);
		foundEnd = StyledClone.cloneSubtreeIntoElementUntil(child.firstChild, childClone, endContainer, endOffset);
		destinationContainer.appendChild(childClone);
        
		if (child == endContainer)
		{
            if (childClone.deleteData != undefined)
                childClone.deleteData(endOffset, childClone.length - endOffset);
			foundEnd = true;
		}
	}
    
	return foundEnd;
}

StyledClone.cloneFontFaceRules = function(htmlElement)
{
	var fontFaces = [];

	var styleSheets = document.styleSheets;
	for (var index = 0, length = styleSheets.length; index < length; ++index)
	{
		var rules = styleSheets[index].cssRules;
		for (var ruleIndex = 0, rulesLength = rules.length; ruleIndex < rulesLength; ++ruleIndex)
		{
			var rule = rules[ruleIndex];
			if (rule.type == CSSRule.FONT_FACE_RULE)
			{
				fontFaces.push(rule);
			}
		}
	}

	var head = document.createElement('head')
	htmlElement.insertBefore(head, htmlElement.firstChild);

	var style = document.createElement('style')
	style.type = 'text/css';
	for (var ruleIndex = 0, rulesLength = fontFaces.length; ruleIndex < rulesLength; ++ruleIndex)
	{
		var rule = fontFaces[ruleIndex];
		style.innerText += rule.cssText;
	}
	head.appendChild(style);
}

StyledClone.cloneRangeWithStyle = function(range)
{
	var startContainer = StyledClone.cloneElementWithStyle(range.startContainer);
    
	var foundEnd = range.startContainer == range.endContainer;
	if (foundEnd)
	{
		// if the start and the end are the same container, trim the end (and do it before
		//	trimming the beginning so that our offset is accurate)
        if (startContainer.deleteData != undefined)
            startContainer.deleteData(range.endOffset, startContainer.length - range.endOffset);
	}
    
	var trimStart = range.startOffset > 0 && startContainer.deleteData != undefined;
    var trimBreakBeforeAlways = startContainer.deleteData != undefined;

	// trim the start
	if (trimStart)
	{
        startContainer.deleteData(0, range.startOffset);
	}
    
	var rootElement = range.startContainer;
	var rootClone = startContainer;
    
	// clone children of the start container, watching for the end container
	foundEnd = StyledClone.cloneSubtreeIntoElementUntil(rootElement.firstChild, rootClone, range.endContainer, range.endOffset) || foundEnd;
    
	// iterate up
	while (rootElement.parentNode != document)
	{
		// clone the parent
		var newRootClone = StyledClone.cloneElementWithStyle(rootElement.parentNode);
		newRootClone.appendChild(rootClone);
		rootClone = newRootClone;

		if (trimStart)
		{
			if (window.getComputedStyle(rootElement.parentNode).getPropertyValue('display') == 'block')
			{
				rootClone.style.textIndent = '0';
				trimStart = false;
			}
		}
        if (trimBreakBeforeAlways)
        {
            if (window.getComputedStyle(rootElement.parentNode).getPropertyValue('page-break-before') == 'always')
            {
                rootClone.style.pageBreakBefore = '';
            }
        }

		if (foundEnd == false)
		{
			// if we haven't found end end container yet, clone this node's siblings
			foundEnd = StyledClone.cloneSubtreeIntoElementUntil(rootElement.nextSibling, rootClone, range.endContainer, range.endOffset);
		}

		if (rootElement.parentNode.tagName.toLowerCase() == 'html')
		{
			StyledClone.cloneFontFaceRules(rootClone);
		}

		rootElement = rootElement.parentNode;
	}
    
	return rootClone;
}


CFIUtilities.getCFIForLastClickedElement = function () {
    return stashedCFI;
}

CFIUtilities.styledHTMLForCFI = function(cfi,styletext) {
    var range = CFI.parseCFI(cfi);
    var rootClone = StyledClone.cloneRangeWithStyle(range);
    
    if (styletext)
    {
        var child = rootClone.firstChild;
        if (child)
        {
            var head = document.createElement("head");
            var style = document.createElement("style");
            style.setAttribute("type", "text/css");
            style.innerText = styletext;
            head.appendChild(style);
            rootClone.insertBefore(head,child);
        }
    }
    
    return rootClone.outerHTML;
}

CFIUtilities.styledHTMLForCFIs = function(startCFI, endCFI)
{
    var range = CFI.parseCFI(startCFI);
    var endRange = CFI.parseCFI(endCFI);
    
    if (range.startOffset == endRange.startOffset)
    {
        endRange = document.createRange();
        endRange.selectNode(document.body);
        endRange.collapse(false);
    }
    
    range.setEnd(endRange.endContainer, endRange.endOffset);
    
//    range = window.getSelection().getRangeAt(0);

    var content = StyledClone.cloneRangeWithStyle(range);

    return content.outerHTML;
}

CFIUtilities.pausePlayingMedia = function() {
    var elements = document.querySelectorAll("video,audio");
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        if (!element.paused) {
            element.pause();
            element.webkitExitFullscreen();
        }
    }
}

var __booksMediaElementPlayEventListener = function (event) {
    window.location = "xxbooksmediaplaybackstarted://started";
}

var __booksMediaElementPauseEventListener = function (event) {
    window.location = "xxbooksmediaplaybackfinished://finished";
}

document.__bk_original_addEventListener("play", __booksMediaElementPlayEventListener, true);
document.__bk_original_addEventListener("pause", __booksMediaElementPauseEventListener, true);

function BKEpubLocation() {
    // BKEpubLocation is a singleton for doing things with CFI's. It has no instances.
}

BKEpubLocation.getCFI = function(location)
{
    var cfiOrError = null;
    try
    {
        var ordinal = location.super.ordinal;
        if (ordinal)
        {
            cfiOrError = ordinal;
            var startPath = location.startPath;
            if (startPath)
            {
                var startNode = BKEpubLocation.getNode(startPath);
                if (startNode)
                {
                    var startOffset = location.startOffset;
                    if (!startOffset)
                    {
                        startOffset = 0;
                    }
                    var range = document.createRange();
                    range.setStart(startNode,startOffset);
                    
                    var endPath = location.endPath;
                    if (endPath)
                    {
                        var endNode = BKEpubLocation.getNode(endPath);
                        
                        if (endNode)
                        {
                            var endOffset = location.endOffset;
                            if (!endOffset)
                            {
                                if (endNode == startNode)
                                {
                                    endOffset = startOffset;
                                }
                                else
                                {
                                    endOffset = 0;
                                }
                            }
                            range.setEnd(endNode,endOffset);
                        }
                        else
                        {
                            cfiOrError = "ERROR: Failed to create node for path " + endPath;
                        }
                        
                        cfi = CFI.computeCFI(null,null,null,range);
                        
                        if (cfi)
                        {
                            cfiOrError = cfi;
                        }
                        else
                        {
                            cfiOrError = "ERROR: Failed to create cfi from range " + range.toString();
                        }
                    }
                    else
                    {
                        range.setEnd(startNode,startOffset);
                    }

                }
                else
                {
                    cfiOrError = "ERROR: Failed to get node from path " + startPath.toString();
                }
            }
            else
            {
                cfiOrError = "ERROR: missing startPath";
            }
        }
        else
        {
            cfiOrError = "ERROR: Missing ordinal";
        }
    }
    catch (e)
    {
        cfiOrError = "ERROR: Exception -- " + e
    }
    return cfiOrError;
}



BKEpubLocation.getNode = function(path) {
	var pathLength = path.length;

	//	Find the "id" node
	var node;
	var pathIndex;
	for (pathIndex = pathLength - 1 ; pathIndex >= 0; pathIndex --)
	{
		var pathNode = path[pathIndex]
		var idString = pathNode.id
		if (idString)
		{
			node = document.getElementById(idString)
			if (node)
			{
				break;
			}
		}
	}
	if (!node)
		node = document.body;
	if (!node) {
        // there's no "id", there's no document.body
        // Our first step should identify the document element. Double-check the tag name
        // and skip the step
        node = document.documentElement;
        if (pathLength == 0) {
            // there's no path at all, which shouldn't be possible in a bodyless document
            return node;
        }
        pathIndex = 0
        var pathNode = path[pathIndex]
        var stepTagName = pathNode.tagName
        if (stepTagName) {
        	if (node.tagName != stepTagName) {
                // document element doesn't match
                // But we really have no choice
                return node;
            }
        }
    }
    pathIndex++;
    
    //	Resolve the rest of the path
	while (pathIndex < pathLength)
	{
		var pathNode = path[pathIndex]
		index = pathNode.index
		
		//	Find the child
		var childNode = node.firstChild;
		var index = pathNode.index
		for (var childIndex = 1; childNode && childIndex < index; childIndex++)
		{
			childNode = childNode.nextSibling;
		}
		
		if (childNode)
			node = childNode;
		
		var childElement;
		if (childNode.nodeType == 1)
			childElement = childNode;
		
		if (!childElement)
			break;
		
		//	Make sure the attributes of the child are correct
		tagName = pathNode.tagName
		if (tagName)
		{
			if (childElement.tagName != tagName)
				break;
		}
		
		var className = pathNode.className
		if (className)
		{
			if (!(childElement instanceof HTMLElement))
			{
				break;
			}
			
			var htmlChild = childElement;
			
			if (htmlChild.className != className)
			{
				break;
			}
		}
		
		pathIndex++;
	}
	return node
}


var loadFunction = function (event) {
    document.__bk_original_addEventListener("click", stashCFIForClickedElement, true /* capture instead of bubble */);
}
window.__bk_original_addEventListener("load", loadFunction)
