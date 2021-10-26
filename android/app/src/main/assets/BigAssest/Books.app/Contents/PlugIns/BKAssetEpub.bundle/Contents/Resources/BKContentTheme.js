// <rdar://problem/13729307> OSX: Highlight: change color does not apply
// <rdar://problem/13558560> OSX: title is not properly visible (certain book)

BKContentTheme = function () {};

// This changes with setTheme()
BKContentTheme.currentThemeName = "BKNightStyleTheme";

// Applies the theme
BKContentTheme.applyTheme = function (themeName) {
    var roots = document.querySelectorAll(":root")
    var i = 0;
    
    var overriddenBackgroundColorAttribute = "__ibooks_remove_background_color";
    
    for (i = 0; i < roots.length; i++)
    {
        var root = roots[i];
        
        // Remove any overridden background color
        if (root.getAttribute(overriddenBackgroundColorAttribute))
        {
            root.style.backgroundColor = null;
            root.removeAttribute(overriddenBackgroundColorAttribute);
        }
        
        // Apply theme
        root.setAttribute("__ibooks_internal_theme", themeName);
        
        
        if (window) // Should always be true, but to be safe...
        {
            // Get the actual background color (always in rgb or rgba format, even if "red" was used)
            var backgroundColorStyle = window.getComputedStyle(root, "background-color");
            
            // Test if the background color is transparent
            if (backgroundColorStyle.getPropertyValue("background-color") == "rgba(0, 0, 0, 0)")
            {
                // If so, reset it to white, so sub-pixel AA works properly
                root.style.backgroundColor = "white";
                root.setAttribute(overriddenBackgroundColorAttribute, true);
            }
        }
    }
}

// Use to set the theme.
BKContentTheme.setTheme = function (themeName) {
    BKContentTheme.currentThemeName = themeName
    if ("complete" == document.readyState)
    {
        BKContentTheme.applyTheme(themeName);
    }
}

BKContentTheme.setSelectionColor = function (color) {
    var ss = document.styleSheets[0];
    ss.insertRule('::selection {background: #'+color+';}', 0);
}

BKContentTheme.resetSelectionColor = function () {
    var ss = document.styleSheets[0];
    if (ss.cssRules.length > 0)
        ss.deleteRule(0);
}

// Use to set the theme after the document has loaded
BKContentTheme.setupFirstTheme = function () {
    BKContentTheme.applyTheme(BKContentTheme.currentThemeName);
}

// Execute this once the content has loaded. Since it
// does NOT affect layout, we don't need it loaded synchronously
window.__bk_original_addEventListener("load", BKContentTheme.setupFirstTheme)