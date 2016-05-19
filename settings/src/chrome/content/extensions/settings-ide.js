/*  Copyright 2013, 2014, 2015 Peter Kehl
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

(function(global) { // Anonymous function to make the variables local
    var FileUtils= Components.utils.import("resource://gre/modules/FileUtils.jsm", {} ).FileUtils; // This must be local - otherwise it overrides FileUtils defined/loaded by Se IDE, and it causes problems at Se IDE start
    var console= Components.utils.import("resource://gre/modules/Console.jsm", {}).console;
    Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );

    // Tail intercept of Editor.prototype.confirmClose and the same for its subclasses StandaloneEditor and SidebarEditor
    var originalConfirmClose= Editor.prototype.confirmClose;
    Editor.prototype.confirmClose= function confirmClose() {
        //console.log( 'Editor.prototype.confirmClose intercept invoked' );
        var result= originalConfirmClose.call(this);
        // result===true means that the window was closed (whether saved or not)
        if( result ) {
            window.location.href!=='chrome://selenium-ide/content/selenium-ide.xul' || SeLiteSettings.setTestSuiteFolder(undefined);
            SeLiteSettings.closingIde();
        }
        //console.log( 'Editor.proto.confirmClose passed');
        return result;
    };
    // 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
    StandaloneEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    SidebarEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    //console.log( 'Editor.prototype.confirmClose intercept set up' );

    if( typeof XUL_NS=== "undefined" )  {
        var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    }
    var optionsPopup= document.getElementById('options-popup');
    
    var seLiteSettingsMenuItem= document.createElementNS( XUL_NS, 'menuitem' );
    seLiteSettingsMenuItem.setAttribute( 'label', 'SeLite Settings for this suite' );
    seLiteSettingsMenuItem.setAttribute( 'oncommand', 'openTabOrWindow("chrome://selite-settings/content/tree.xul" + (SeLiteSettings.testSuiteFolder ? "?folder="+escape(SeLiteSettings.testSuiteFolder) : "") )' );
    optionsPopup.appendChild(seLiteSettingsMenuItem);
    
    /** Reload the database file(s). It copies the files.
     *  If called with no parameters, by default it copies appDB over testDB. Maximum one of the parameters can be true.
     *  @param reloadAppAndTest boolean, whether to reload both appDB and testDB from vanillaDB. Optional, false by default.
     *  @param reloadVanillaAndTest boolean, whether to reload both appDB and testDB from vanillaDB. Optional, false by default.
     *  @return void
     * */
    global.editor.reload_databases= function reload_databases( reloadAppAndTest, reloadVanillaAndTest ) {
        if( !SeLiteSettings.getTestSuiteFolder() ) {
            alert("Please open or save a test suite first, so that SeLite can collect configuration for it. Then use the button again." );
            return;
        }
        if( SeLiteSettings.moduleForReloadButtons.testDbKeeper===undefined ) {
            alert( "Please run one (any) single Selenese test command first. Then use the button again. If that doesn't help, ensure that you load a framework which calls SeLiteSettings.setTestDbKeeper(...). See http://selite.github.io/GeneralFramework#creating-a-new-framework" );
            return;
        }
        SeLiteSettings.moduleForReloadButtons || SeLiteMisc.fail( 'This requires your Core extension to call SeLiteSettings.setModuleForReloadButtons().' );
        var fields= SeLiteSettings.moduleForReloadButtons.getFieldsDownToFolder();

        var testDbField= SeLiteSettings.moduleForReloadButtons.fields['testDB'];
        var appDbField= SeLiteSettings.moduleForReloadButtons.fields['appDB'];
        var vanillaDbField= SeLiteSettings.moduleForReloadButtons.fields[ 'vanillaDB' ];
        var tablePrefixField= SeLiteSettings.moduleForReloadButtons.fields['tablePrefix'];
        
        var appDB= fields['appDB'].entry;
        var testDB= fields['testDB'].entry;
        if( !testDB ) {
            alert( 'Please configure testDB (and appDB' +(
                        reloadAppAndTest || reloadVanillaAndTest
                        ? ' and vanillaDB'
                        : ''
                    )
                    + ') and as per http://selite.github.io/InstallFramework' );
            return;
        }
        if( !appDB ) {
            alert( 'Please configure appDB (and testDB' +(
                        reloadAppAndTest || reloadVanillaAndTest
                        ? ' and vanillaDB'
                        : ''
                    )
                    + ') and as per http://selite.github.io/InstallFramework' );
            return;
        }
        var vanillaDB;
        if( reloadAppAndTest || reloadVanillaAndTest ) {
            vanillaDB= fields['vanillaDB'].entry;
            if( !vanillaDB ) {
                alert( 'Please configure vanillaDB as per http://selite.github.io/InstallFramework' );
                return;
            }
        }        
        var appStorage;
        if( reloadAppAndTest ) {
            // @TODO why should test need app DB storage? See check for vanillaDB storage below
            appStorage= SeLiteData.getStorageFromSettings( appDbField, undefined, true/*dontCreate*/ );
            // appStorage.connection() may be null, if the app DB file doesn't exist yet
            !appStorage || !appStorage.connection() || appStorage.close( true );
        }
        var testStorage= SeLiteData.getStorageFromSettings( testDbField, tablePrefixField, true/*dontCreate*/ );
        // Load test data to be preserved into memory. See e.g. SeLiteSettings.TestDbKeeper.Columns.prototype.load()
        !testStorage || !SeLiteSettings.moduleForReloadButtons.testDbKeeper || SeLiteSettings.moduleForReloadButtons.testDbKeeper.load();
        // testStorage.connection() may be null, if the test DB file doesn't exist yet
        !testStorage || !testStorage.connection() || testStorage.close(true); // When I called testStorage.close() without parameter true, things failed later on unless there was a time break (e.g. when debugging)
        
        !(reloadAppAndTest && reloadVanillaAndTest) || SeLiteMisc.fail( "Maximum one parameter can be true for reload_databases()." );
        
        // Reloading sequence is one of:
        // appDB =>             testDB
        // vanillaDB => appDB => testDB
        // appDB => vanillaDB => testDB
        var sourceDB= reloadAppAndTest
            ? vanillaDB
            : appDB;
        if( reloadAppAndTest || reloadVanillaAndTest ) {
            // next line only performs validation
            !SeLiteData.getStorageFromSettings( vanillaDbField, undefined, true/*dontCreate*/ )
                || SeLiteMisc.fail( 'vanillaDB should not be accessed by tests, yet there is SeLiteSettings.StorageFromSettings instance that uses it - ' +vanillaDbField );
            reload( sourceDB, reloadAppAndTest
                ? appDB
                : vanillaDB
            );
        }
        reload( sourceDB, testDB );
        !appStorage || appStorage.open();
        !testStorage || testStorage.open();
        !testStorage || !SeLiteSettings.moduleForReloadButtons.testDbKeeper || SeLiteSettings.moduleForReloadButtons.testDbKeeper.testStorage===testStorage || SeLiteMisc.fail();
        !testStorage || !SeLiteSettings.moduleForReloadButtons.testDbKeeper || SeLiteSettings.moduleForReloadButtons.testDbKeeper.store();
        !appStorage || appStorage.close( true ); // The web application shouldn't use SQLiteConnectionManager, so let's close the connection here.
    };
    
    /** Shorthand to make caller's intention clear.
     * */
    global.editor.reload_test= function reload_test() {
        global.editor.reload_databases();
    };
    
    /** @private
    When reloading, the target file doesn't need to exist, but its immediate parent directories must exist
     * */
    function reload( fromFileName, toFileName ) {
        var fromFile= new FileUtils.File(fromFileName); // Object of class nsIFile        
        var toFile= new FileUtils.File(toFileName);
        toFile.parent.exists() || SeLiteMisc.fail( 'Target folder ' +toFile.parent.path+ ' does not exist' );
        console.log( 'Copying ' +fromFileName+ ' to ' +toFileName );
        // This copies the file even if the target file exists already - contrary to https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile#copyToFollowingLinks%28%29
        fromFile.copyToFollowingLinks( toFile.parent, toFile.leafName );
    }
    
    /** Reload testDB and appDB from vanillaDB: vanilla -&gt; green  -&gt; blue.
     * */
    global.editor.reload_app_and_test= function reload_app_and_test() {
        this.reload_databases( true );
    };
    /** Reload vanillaDB and testDB from appDB: green -&gt; vanilla  -&gt; blue.
     * */
    global.editor.reload_vanilla_and_test= function reload_vanilla_and_test() {
        this.reload_databases( false, true );
    };

})(this);