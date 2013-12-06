/*  Copyright 2013 Peter Kehl
    This file is part of SeLite Settings.
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

(function() { // Anonymous function to make the variables local
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    var SeLiteSettings= Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
    
    // Tail intercept of Editor.prototype.confirmClose and the same for its subclasses StandaloneEditor and SidebarEditor
    var originalConfirmClose= Editor.prototype.confirmClose;
    Editor.prototype.confirmClose= function() {
        //console.log( 'Editor.prototype.confirmClose intercept invoked' );
        var result= originalConfirmClose.call(this);
        // result===true means that the window was closed (whether saved or not)
        if( result ) {
            SeLiteSettings.setTestSuiteFolder(undefined);
            // I don't empty whole testSuiteFolderChangeHandlers here because
            // some handlers are set from within JS components (e.g. SeLiteSettings), which get loaded in memory only once (per Firefox run), so if I removed such handler(s) here, they will be missed until next Firefox restart.
            // @TODO
            // 1. change testSuiteFolderChangeHandlers to be an associative array
            // 2. accept handler name
            // 3. when re-registering a handler with the same name, remove the old handler
        }
        //console.log( 'Editor.proto.confirmClose passed');
        return result;
    };
    StandaloneEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    SidebarEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    //console.log( 'Editor.prototype.confirmClose intercept set up' );
})();