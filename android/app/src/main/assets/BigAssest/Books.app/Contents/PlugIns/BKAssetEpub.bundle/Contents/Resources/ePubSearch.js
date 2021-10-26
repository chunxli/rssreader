// ========================================================================================================== ePubSearch

function ePubSearch ()
{
	// ePubSearch is a singleton ePub search service. It has no instances.
}

// ------------------------------------------------------------------------------------------------------- searchForTerm
// Search entire document for 'searchTerm'. 'cfi' returned in result is partial (realtive).

ePubSearch.searchForTerm = function (searchTerm)
{
	return ePubSearch.searchForTermInBook (searchTerm, null, null, null);
}

// ------------------------------------------------------------------------------------------------- searchForTermInBook
// Search entire document for 'searchTerm'. 'cfi' returned in result is fully qualified.

ePubSearch.searchForTermInBook = function (searchTerm, spineIndex, chapterIndex, manifestId)
{
	var	resultsArray = null;
	
	rangesArray = ePubSearch._rangesContainingSearchTerm2 (searchTerm);
	if (rangesArray)
	{
		for (i = 0; i < rangesArray.length; i++)
		{
			// Select range.
			var selection = getSelection ();
			selection.empty ();
			selection.addRange (rangesArray[i]);
			
			// Get contextual string for range.
            var padded = CFIUtilities._contextForSelection ();
            
			// Generate CFI for range.
			var cfi = CFI.computeCFI (spineIndex, chapterIndex, manifestId, rangesArray[i]);

            // Get the rects for the range.
            const rangeRects = CFIUtilities._rectsForRange(rangesArray[i]);

			// Lazily allocate array to store search results.
			if (resultsArray == null)
				resultsArray = [];
            resultsArray.push ({context: padded.string, offset: padded.start, cfi: cfi, rects: rangeRects});
		}
	}
	
	return JSON.stringify (resultsArray);
}

// -------------------------------------------------------------------------------------------------------- readableText
// Search entire document for 'searchTerm'. 'cfi' returned in result is partial (realtive).

ePubSearch.readableText = function ()
{
	var walker = document.createTreeWalker (document.body, NodeFilter.SHOW_TEXT, null, false);
	var allText = "";
	
	// Walk text nodes.
	while (walker.nextNode ())
	{
		var textNode = walker.currentNode;
		allText = allText + textNode.data;
	}
	
	return allText;
}

// -------------------------------------------------------------------------------------------------------- selectedText

ePubSearch.selectedText = function ()
{
	var selection = getSelection ();
	return selection.toString ();
}

// ------------------------------------------------------------------------------------- contextAndCFIForSelectionInBook

ePubSearch.contextAndCFIForSelectionInBook = function (spineIndex, chapterIndex, manifestId)
{
	// Initial range.
	var selection = getSelection ();
	var initialRange = selection.getRangeAt(0).cloneRange();
	
	// Get contextual string for selection.
	var context = CFIUtilities._contextForSelection ();
	
	// Generate CFI for range.
	var cfi = CFI.computeCFI (spineIndex, chapterIndex, manifestId, initialRange);
	
	return JSON.stringify ({context: context.string, offset: context.start, cfi: cfi});
}

// ---------------------------------------------------------------------------------------------- _paddedStringFromRange
// From 'range' extracts text padded out 'padding' both before and after the text within 'range'.
// Object returned has padded string for .string and offset to the original text for .start.
// Passing 0 (zero) for 'padding' will return only the text within 'range'. If there is not
// enough text in the document to pad out either before ro following 'range' as much padded text as
// is possible will be returned.

ePubSearch._paddedStringFromRange = function (padding, range)
{
	var paddedRange = range.cloneRange();
	var container;
	var remaining;
	var start;
	
	// Pad out to the left first (characters preceding range).
	// Remaining number of character to pad out to the left.
	remaining = padding;
	container = paddedRange.startContainer;
	while (remaining > 0)
	{
		// Do we have enough offset to handle all the padding?
		if (paddedRange.startOffset > remaining)
		{
			paddedRange.setStart (container, paddedRange.startOffset - remaining);
			start = padding;
			remaining = 0;
		}
		else
		{
			remaining = remaining - paddedRange.startOffset;
			paddedRange.setStart (container, 0);
			start = padding - remaining;
			console.log ("--- need more left");
			remaining = 0;	// <-- TEMP TOSS
		}
	}
	
	// Pad out to the right (characters following range).
	// Remaining number of character to pad out to the right.
	remaining = padding;
	container = paddedRange.endContainer;
	while (remaining > 0)
	{
		var containerSize = container.length;
		var remainInContainer = containerSize - paddedRange.endOffset;
		
		if (remainInContainer > remaining)
		{
			paddedRange.setEnd (container, paddedRange.endOffset + remaining);
			remaining = 0;
		}
		else
		{
			paddedRange.setEnd (container, paddedRange.endOffset + remainInContainer);
			remaining = remaining - remainInContainer;
			console.log ("--- need more right");
			remaining = 0;	// <-- TEMP TOSS
		}
	}
	
	return {string : paddedRange.toString (), start : start};
}

// ----------------------------------------------------------------------------------------- _rangesContainingSearchTerm
// Beginning from 'rootNode', walk text nodes looking for a string matching 'searchTerm'.

ePubSearch._rangesContainingSearchTerm = function (searchTerm)
{
	var walker = document.createTreeWalker (document.body, NodeFilter.SHOW_TEXT, null, false);
	var resultsArray = null;
	
	// Walk text nodes.
	while (walker.nextNode ())
	{
		var offset = 0;
		var textNode = walker.currentNode;
		var text = textNode.data.toLocaleLowerCase ();
		
		do
		{
			// Search current text node for 'searchTerm'.
			offset = text.indexOf (searchTerm, offset);
			
			// If we found 'searchTerm' create a range for it.
			if (offset != -1)
			{
				var range;
				
				// Create range.
				range = document.createRange ();
				range.setStart (textNode, offset);
				range.setEnd (textNode, offset + searchTerm.length);
				
				// Lazily allocate array to store ranges.
				if (resultsArray == null)
					resultsArray = [];
				resultsArray.push (range);
				
				// Move offset past start of word ... we'll continue searching for 'searchTerm' in this text node.
				offset = offset + 1;
			}
		}
		while (offset != -1);
	}
	
	return resultsArray;
}

// ---------------------------------------------------------------------------------------- _rangesContainingSearchTerm2
// Beginning from 'rootNode', walk text nodes looking for a string matching 'searchTerm'.

ePubSearch._rangesContainingSearchTerm2 = function (searchTerm)
{
    // Reject Ruby <rt> completely.  We only want to search the actual text content.
    var filter = { acceptNode: function(node)
        {
            var rtAncestor = CFIUtilities._ancestorElementWithTagName (node, "rt");
            return (rtAncestor == null) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } };
    
	var walker = document.createTreeWalker (document.body, NodeFilter.SHOW_TEXT, filter, false);
	var allText = "";
	var nodeStack = [];
	var offset = 0;
	var resultsArray = null;
	
	// Walk text nodes - concatenate text and build data structure of nodes and text length for each node.
	while (walker.nextNode ())
	{
		var textNode = walker.currentNode;
		var text = textNode.data.toLocaleLowerCase ();
		allText = allText + text;
		nodeStack.push ({node: textNode, count: text.length})
	}
	
	do
	{
		// Search concatenated text for 'searchTerm'.
		offset = BKSearchInsensitively(allText, searchTerm, offset);
		
		// If we found 'searchTerm' create a range for it.
		if (offset != -1)
		{
			var range;
			var nodeIndex = 0;
			var nextNodeOffset = 0;
			var lastNodeOffset = 0;
			
			// Create range.
			range = document.createRange ();
			
			// Find start node and offset for range. We walk our nodeStack to determine this.
            nextNodeOffset = nodeStack[0].count;
			while (nextNodeOffset <= offset)
			{
				lastNodeOffset = nextNodeOffset;
                nodeIndex = nodeIndex + 1;
				nextNodeOffset = nextNodeOffset + nodeStack[nodeIndex].count;
			}
			
			range.setStart (nodeStack[nodeIndex].node, offset - lastNodeOffset);
			
			// Move offset to end of search term.
			offset = offset + searchTerm.length;
			
			// Similar to above, find end node and offset for range.
			while (nextNodeOffset < offset)
			{
				lastNodeOffset = nextNodeOffset;
                nodeIndex = nodeIndex + 1;
				nextNodeOffset = nextNodeOffset + nodeStack[nodeIndex].count;
			}
			
			range.setEnd (nodeStack[nodeIndex].node, offset - lastNodeOffset);
			
			// Lazily allocate array to store ranges.
			if (resultsArray == null)
				resultsArray = [];
			resultsArray.push (range);
		}
	}
	while (offset != -1);
	
	return resultsArray;
}
