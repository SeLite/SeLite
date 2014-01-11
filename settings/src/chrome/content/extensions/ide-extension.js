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
    var FileUtils= Components.utils.import("resource://gre/modules/FileUtils.jsm", {} ).FileUtils; // This must be local - otherwise it overrides FileUtils defined/loaded by Se IDE, and it causes problems at Se IDE start
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
     *  It removes the old file(s). It copies the files, without adjusting permissions or ownership.
     *  @param reloadAppFromVanilla boolean, whether to reload both appDB and testDB from vanlillaDB. Optional, false by default.
     *  @return void
     * */
    self.editor.reload_test= function( reloadAppFromVanilla ) {
        var module= SeLiteSettings.Module.forName( 'extensions.selite-settings.basic' );
        module || fail( 'This requires SeLiteSettings module "extensions.selite-settings.basic" to be registered. It normally comes with SeLiteSettings.' );
        // @TODO replace to use active set, if there is no test suiet
        var fields= module.getFieldsDownToFolder();
        
        var appDB= SeLiteData.getStorageFromSettings( 'extensions.selite-settings.basic.appDB', true/*dontCreate*/ );
        !appDB || appDB.close();
        var testDB= SeLiteData.getStorageFromSettings( 'extensions.selite-settings.basic.testDB', true/*dontCreate*/ );
        !testDB || testDB.close();
        
        var appDBvalue= fields['appDB'].entry;
        appDBvalue || fail( 'There is no value for SeLiteSettings field extensions.selite-settings.basic.appDB.' );
        var testDBvalue= fields['testDB'].entry;
        testDBvalue || fail( 'There is no value for SeLiteSettings field extensions.selite-settings.basic.testDB.' );
        
        //appDB file may not exist, but its immediate parent directories must exist
        var appFile= new FileUtils.File(appDBvalue);
        if( reloadAppFromVanilla ) {
            // next two lines only perform validation
            !SeLiteData.getStorageFromSettings( 'extensions.selite-settings.basic.vanillaDB', true/*dontCreate*/ )
                || fail( 'vanillaDB should not be accessed by tests, yet there is SeLiteSettings.StorageFromSettings instance that uses it.' );
    
            var vanillaDBvalue= fields['vanillaDB'].entry;
            vanillaDBvalue || fail( 'There is no value for SeLiteSettings field extensions.selite-settings.basic.vanillaDB.' );
            var vanillaFile= new FileUtils.File(vanillaDBvalue); // Object of class nsIFile
            vanillaFile.exists() || fail( 'SeLiteSettings field extensions.selite-settings.basic.vanillaDB has value ' +vanillaDBvalue+', but there is no such file.' );
            var appFolder= appFile.parent;
            var appLeafName= appFile.leafName;
            !appFile.exists() || appFile.remove( false/*recursive*/ );
            vanillaFile.copyTo( appFolder, appLeafName );
            appFile= new FileUtils.File(appDBvalue);
        }
        
        //testDB file may not exist, but its immediate parent directories must exist
        var testFile= new FileUtils.File(testDBvalue);
        var testFolder= testFile.parent;
        var testLeafName= testFile.leafName;
        !testFile.exists() || testFile.remove( false/*recursive*/ );
        appFile.copyTo( testFolder, testLeafName );
        
        !appDB || appDB.open();
        !testDB || testDB.open();
    };

    /** Reload testDB and appDB from vanillaDB.
     * */
    self.editor.reload_app_and_test= function() {
        this.reload_test( true );
    };

})(this);