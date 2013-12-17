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

(function(self) { // Anonymous function to make the variables local
    var FileUtils= Components.utils.import("resource://gre/modules/FileUtils.jsm", {} ); // This must be local - otherwise it overrides FileUtils defined/loaded by Se IDE, and it causes problems at Se IDE start
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );

    // Tail intercept of Editor.prototype.confirmClose and the same for its subclasses StandaloneEditor and SidebarEditor
    var originalConfirmClose= Editor.prototype.confirmClose;
    Editor.prototype.confirmClose= function() {
        //console.log( 'Editor.prototype.confirmClose intercept invoked' );
        var result= originalConfirmClose.call(this);
        // result===true means that the window was closed (whether saved or not)
        if( result ) {
            SeLiteSettings.setTestSuiteFolder(undefined);
            SeLiteSettings.closingIde();
        }
        //console.log( 'Editor.proto.confirmClose passed');
        return result;
    };
    StandaloneEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    SidebarEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    //console.log( 'Editor.prototype.confirmClose intercept set up' );

    if (typeof(XUL_NS) == "undefined")  {
        var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    }
    var seLiteSettingsMenuItem= document.createElementNS( XUL_NS, 'menuitem' );
    seLiteSettingsMenuItem.setAttribute( 'label', 'SeLiteSettings module(s)' );
    seLiteSettingsMenuItem.setAttribute( 'oncommand', 'window.editor.showInBrowser("chrome://selite-settings/content/tree.xul", true/*in a new window*/)' );
    seLiteSettingsMenuItem.setAttribute( 'accesskey', 'S' );
    var optionsPopup= document.getElementById('options-popup');
    optionsPopup.appendChild(seLiteSettingsMenuItem);
    
    seLiteSettingsMenuItem= document.createElementNS( XUL_NS, 'menuitem' );
    seLiteSettingsMenuItem.setAttribute( 'label', 'SeLiteSettings per folder' );
    seLiteSettingsMenuItem.setAttribute( 'oncommand', 'window.editor.showInBrowser("chrome://selite-settings/content/tree.xul?selectFolder", true/*in a new window*/)' );
    optionsPopup= document.getElementById('options-popup');
    optionsPopup.appendChild(seLiteSettingsMenuItem);

    /** Reload
     *  - the appDB from given vanillaDbField (if set; this is optional), and
     *  - the testDB from appDB
     *  @param vanillaDbField SeLiteSettings.Field.SQLite (for extensions.selite-settings.basic.vanillaDB), or null
     *  @return void
     * */
    self.editor.reload_test= function( vanillaDbField ) {
        var appDbField= SeLiteSettings.getField( 'extensions.selite-settings.basic.appDB' );
        var testDbField= SeLiteSettings.getField( 'extensions.selite-settings.basic.testDB' );

        var appDB= SeLiteData.getStorageFromSettings( appDbField, true );
        !appDB || appDB.close();
        var testDB= SeLiteData.getStorageFromSettings( testDbField, true );
        !testDB || testDB.close();

        vanillaDbField===null || SeLiteMisc.ensureInstance( vanillaDbField, SeLiteSettings.Field.SQLite, 'SeLiteSettings.Field.SQLite' );
        var vanillaDbField= SeLiteData.getField( 'extensions.selite-settings.basic.vanillaDB' );
        // next two lines only perform validation
        var vanillaDB= SeLiteData.getStorageFromSettings( vanillaDbField, true );
        !vanillaDB || fail( 'vanillaDB should not be accessed by tests' ); 

        var module= SeLiteSettings.Module.forName( 'extensions.selite-settings.basic' );
        var fields= module.getFieldsDownToFolder();
        var appDBvalue= fields['appDB'].entry;

        var file= new FileUtils.File(filePath); // Object of class nsIFile
        if( vanillaDbField ) {

        }

        !appDB || appDB.open();
        !testDB || testDB.open();
    };

    /** Reload testDB and appDB from vanillaDB.
     * */
    self.editor.reload_app_and_test= function() {
        this.reload_test( true );
    };

})(this);