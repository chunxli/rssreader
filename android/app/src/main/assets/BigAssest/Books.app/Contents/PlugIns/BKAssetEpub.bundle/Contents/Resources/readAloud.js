
readAloud.kEPUBNameSpace = "http://www.idpf.org/2007/ops";
readAloud.kiBooksNameSpace = "http://apple.com/ibooks/html-extensions";
readAloud.kiBooksNameSpace2 = "http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0"
readAloud.hasMediaOverlayActiveStyle = false;

function readAloud ()
{
    //this is a javascript class
}

readAloud.init = function ()
{
    readAloud._installActionHandlers();
    
    return readAloud._soundTrack();
}

readAloud.highlightElement = function (elementID, className)
{
	var element = document.getElementById(elementID);
    
    element.classList.add(className);
    element.classList.add("-epub-media-overlay-active");
    
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('ibooksMediaOverlayActive', true, false, true);
    element.dispatchEvent(evt);
}

readAloud.removeHighlightElement = function (elementID, className)
{
	var element = document.getElementById(elementID);
    
    element.classList.remove(className);
    element.classList.remove("-epub-media-overlay-active");
    
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent('ibooksMediaOverlayActive', true, false, false);
    element.dispatchEvent(evt);
}

readAloud.installClickHandler = function (elementID, documentHref)
{
    var element = document.getElementById(elementID);
    
    readAloud._wrapAction(element, "read?" + elementID + "&" + documentHref);
}

readAloud.removeClickHandler = function (elementID)
{
    var element = document.getElementById(elementID);
    
    readAloud._wrapAction(element, null);
}

readAloud._soundTrack = function ()
{
    var audioElements = document.getElementsByTagName("audio");
    
    for (var i = 0; i < audioElements.length; i++)
    {
        var element = audioElements[i];
        if (element.getAttributeNS(readAloud.kEPUBNameSpace, "type").indexOf("ibooks:soundtrack") !== -1)
        {
            element.parentNode.removeChild(element);
            return element.getAttribute("src");
        }
    }
    
    return "";
}

readAloud._installActionHandlers = function ()
{
    var allElements = document.getElementsByTagName("*");
    
    for (var i = 0; i < allElements.length; i++)
    {
        var element = allElements[i];
        var attribute = element.getAttributeNS(readAloud.kiBooksNameSpace, "readaloud");
        if (!attribute)
            attribute = element.getAttributeNS(readAloud.kiBooksNameSpace2, "readaloud");
        if (attribute)
        {
            var autoTurn = element.getAttributeNS(readAloud.kiBooksNameSpace, "readaloud-turn-style");
            if (!autoTurn)
                autoTurn = element.getAttributeNS(readAloud.kiBooksNameSpace2, "readaloud-turn-style");
            
            readAloud._wrapAction(element, attribute + "?" + autoTurn);
        }
    }
}

readAloud._wrapAction = function (element, actionName)
{
    if (actionName)
    {
        if (element.classList.contains("hoverHand") == false)
            element.classList.add("hoverHand");
        
        element.onclick = function ()
        {
            window.location = "readAloud://" + actionName;
        };
    }else
    {
        element.classList.remove("hoverHand");
        element.onclick = null;
    }
}
