/*  Copyright 2016 Peter Kehl
    This file is part of SeLite Preview.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

// For initialisation mechanism, see ide-extension.js of SeLiteMisc.
if( window.location.href==='chrome://selenium-ide/content/selenium-ide.xul' ) {
    ( function() {
        // This is defined on Editor.prototype, rather than on Selenium.prototype. This way it can access 'editor' object, and through it 'selenium' object, too. Selenese getEval command and custom Selenese commands (defined on Selenium.prototype) can access 'editor' object in order to call editor.openPreview().
        /** @param {string} htmlFilePathOrURL File path or URL of the preview file/template. If it's a file path, you can use either / or \ as directory separators (they will get translated for the current system). To make it portable, use specify it as a relative path and pass it appended to result of SeLiteSettings.getTestSuiteFolder().
         <br/>In the content of that file use SELITE_PREVIEW_CONTENT_PARENT as a URL of its folder. That makes it portable.
         *  @param {object} [config] Configuration with any of fields: {
         *      windowTitle: string Window title
         *      initialContent: string content to show up (plain text or HTML)
         *      initialContentType: 'html' (default) or 'text'
         *  }
         * */
        Editor.prototype.openPreview= function openPreview( htmlFilePathOrURL, data={}, config={} ) {
            var win= window.open( "chrome://selite-preview/content/preview.xul", "SeLite Preview", "chrome,resizable=1"/**/);
            win.addEventListener( 'load', () => {
                // win!==window
                // this===window - thanks to JS ES6 arrow function ()=>{...}
                htmlFilePathOrURL= this.selDebugger.runner.selenium.constructor.urlFor( htmlFilePathOrURL );
                window.alert( 'htmlFilePathOrURL ' +htmlFilePathOrURL);
                win.initialise( htmlFilePathOrURL, this/*i.e. editor*/, data, config );
                config.windowTitle= config.windowTitle || "SeLite Preview from " +htmlFilePathOrURL;
                win.document.title= config.windowTitle;
            } );
        };
        // 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
        SidebarEditor.prototype.openPreview= StandaloneEditor.prototype.openPreview= Editor.prototype.openPreview;
    } ) ();
}
