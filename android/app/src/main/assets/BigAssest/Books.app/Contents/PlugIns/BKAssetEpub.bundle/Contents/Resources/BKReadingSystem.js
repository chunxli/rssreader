//
//  BKReadingSystem.js
//  BKAssetEpub
//
//  Copyright (c) 2013 Apple Inc. All rights reserved.
//
//  See http://www.idpf.org/epub/30/spec/epub30-contentdocs.html#app-epubReadingSystem
//

navigator.epubReadingSystem = {};

navigator.epubReadingSystem.name = "iBooks";
navigator.epubReadingSystem.version = "1.0"; // will be updated after the script is injected
navigator.epubReadingSystem.layoutStyle = "paginated";

navigator.epubReadingSystem.hasFeature = function(feature, version)
{
    var result = undefined;
    
    var isSpine = window.self === window.top;
    
    if (feature == "dom-manipulation")
    {
        result = true;
    }
    else if (feature == "layout-changes")
    {
        result = isSpine ? false : true;
    }
    else if (feature == "touch-events")
    {
        result = false;
    }
    else if (feature == "mouse-events")
    {
        result = true;
    }
    else if (feature == "keyboard-events")
    {
        result = true;
    }
    else if (feature == "spine-scripting")
    {
        result = true;
    }
    else if (feature == "embedded-web-content")
    {
        result = true;
    }
    
    return result;
}
