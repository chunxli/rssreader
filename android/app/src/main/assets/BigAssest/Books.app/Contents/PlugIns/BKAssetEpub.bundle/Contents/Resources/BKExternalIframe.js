//
//  BKExternalIframe.js
//  BKAssetEpub
//
//  Copyright (c) 2017 Apple Inc. All rights reserved.
//
//

window.BKExternalIframe = {};

// Assume window.BKExternalIframe.contentBlockerUrl exists.

window.BKExternalIframe.blockedLinkSet = {};  // link -> true
window.BKExternalIframe.blockedFrameMap = {};  // link -> [iframe elements]

// Add blocked link and replace the iframe(s) with placeholder.
window.BKExternalIframe.addBlockedLink = function(link) {
    // The URL can come with a trailing slash from native.
    link = link.replace(/\/$/, "");

    var blockedLinkSet = window.BKExternalIframe.blockedLinkSet;
    if (blockedLinkSet == null) {
        // Everything is now unblocked.
        return;
    }
    var iframes = document.getElementsByTagName("iframe");
    blockedLinkSet[link] = true;
    var blockedFrameMap = window.BKExternalIframe.blockedFrameMap;
    var contentBlockerUrl = window.BKExternalIframe.contentBlockerUrl;
    for (var i = 0; i < iframes.length; ++i) {
        var frame = iframes[i];
        var origSrc = frame.getAttribute("src");
        if (blockedLinkSet[origSrc]) {
            // We need to replace with contentBlockerUrl.
            frame.setAttribute("src", contentBlockerUrl);
            if (!blockedFrameMap[origSrc]) {
                blockedFrameMap[origSrc] = [];
            }
            blockedFrameMap[origSrc].push(frame);
        }
    }
}

window.BKExternalIframe.refreshWithoutBlocker = function() {
    var blockedFrameMap = window.BKExternalIframe.blockedFrameMap;
    for (var origSrc in blockedFrameMap) {
        var iframeList = blockedFrameMap[origSrc];
        for (var i = 0; i < iframeList.length; ++i) {
            iframeList[i].setAttribute("src", origSrc);
        }
    }
    window.BKExternalIframe.blockedLinkSet = window.BKExternalIframe.blockedFrameMap = null;
}

