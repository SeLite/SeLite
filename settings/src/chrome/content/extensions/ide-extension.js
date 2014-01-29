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

    /** Reload the database file(s). It removes the old file(s). It copies the files. It adjusts permissions on test DB, if there's a setting for it.
     *  If called with no parameters, by default it copies appDB over testDB. Maximum one of the parameters can be true.
     *  @param reloadAppAndTest boolean, whether to reload both appDB and testDB from vanillaDB. Optional, false by default.
     *  @param reloadVanillaAndTest boolean, whether to reload both appDB and testDB from vanillaDB. Optional, false by default.
     *  @return void
     * */
    self.editor.reload_databases= function( reloadAppAndTest, reloadVanillaAndTest ) {
        SeLiteSettings.moduleForReloadButtons || SeLiteMisc.fail( 'This requires your Core extension to call SeLiteSettings.setModuleForReloadButtons().' );
        var fields= SeLiteSettings.moduleForReloadButtons.getFieldsDownToFolder();

        var testDbField= SeLiteSettings.moduleForReloadButtons.fields['testDB'];
        var appDbField= SeLiteSettings.moduleForReloadButtons.fields['appDB'];
        var vanillaDbField= SeLiteSettings.moduleForReloadButtons[ 'vanillaDB' ];

        var appStorage;
        if( reloadAppAndTest ) {
            appStorage= SeLiteData.getStorageFromSettings( appDbField, true/*dontCreate*/ );
            !appStorage || appStorage.close();
        }
        !SeLiteSettings.moduleForReloadButtons.testDbKeeper || SeLiteSettings.moduleForReloadButtons.testDbKeeper.load();
        var testStorage= SeLiteData.getStorageFromSettings( testDbField, true/*dontCreate*/ );
        !testStorage || testStorage.close();
        
        var appDB= fields['appDB'].entry;
        appDB || SeLiteMisc.fail( 'There is no value for SeLiteSettings field ' +appDbField );
        var testDB= fields['testDB'].entry;
        testDB || SeLiteMisc.fail( 'There is no value for SeLiteSettings field ' +testDbField );
        
        !(reloadAppAndTest && reloadVanillaAndTest) || SeLiteMisc.fail( "Maximum one parameter can be true." );
        
        var vanillaDB= fields['vanillaDB'].entry;
        
        // Reloading sequence is one of:
        // appDB =>             testDB
        // vanillaDB => appDB => testDB
        // appDB => vanillaDB => testDB
        var sourceDB= reloadAppAndTest
            ? vanillaDB
            : appDB;
        if( reloadAppAndTest || reloadVanillaAndTest ) {
            // next two lines only perform validation
            vanillaDB || SeLiteMisc.fail( 'There is no value for SeLiteSettings field ' +vanillaDbField );
            !SeLiteData.getStorageFromSettings( 'extensions.selite-settings.basic.vanillaDB', true/*dontCreate*/ )
                || SeLiteMisc.fail( 'vanillaDB should not be accessed by tests, yet there is SeLiteSettings.StorageFromSettings instance that uses it - ' +vanillaDbField );
            reload( sourceDB, reloadAppAndTest
                ? appDB
                : vanillaDB
            );
            if( reloadAppAndTest && 'appDBpermissions' in fields && fields['appDBpermissions'].entry ) {
                new FileUtils.File(appDB).permissions= parseInt( fields['appDBpermissions'].entry, 8 );
            }
        }
        reload( sourceDB, testDB );
        !appStorage || appStorage.open();
        !testStorage || testStorage.open();
        !SeLiteSettings.moduleForReloadButtons.testDbKeeper || SeLiteSettings.moduleForReloadButtons.testDbKeeper.store();
    };
    
    /** Shorthand to make caller's intention clear.
     * */
    self.editor.reload_test= function() {
        self.editor.reload_databases();
    }
    
    /** @private
    When reloading, the target file doesn't need to exist, but its immediate parent directories must exist
     * */
    function reload( fromFileName, toFileName ) {
        var fromFile= new FileUtils.File(fromFileName); // Object of class nsIFile        
        var toFile= new FileUtils.File(toFileName);
        !toFile.exists() || toFile.remove( false/*recursive*/ );
        toFile.parent.exists() || SeLiteMisc.fail( 'Target folder ' +toFile.parent.path+ ' does not exist' );
        console.log( 'Copying ' +fromFileName+ ' to ' +toFileName );
        fromFile.copyTo( toFile.parent, toFile.leafName );
    }
    
    /** Reload testDB and appDB from vanillaDB: vanilla -&gt; green  -&gt; blue.
     * */
    self.editor.reload_app_and_test= function() {
        this.reload_databases( true );
    };
    /** Reload vanillaDB and testDB from appDB: green -&gt; vanilla  -&gt; blue.
     * */
    self.editor.reload_vanilla_and_test= function() {
        this.reload_databases( false, true );
    };

})(this);