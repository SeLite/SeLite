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
            SeLiteSettings.clearTestSuiteFolderChangeHandlers();
        }
        //console.log( 'Editor.proto.confirmClose passed');
        return result;
    };
    StandaloneEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    SidebarEditor.prototype.confirmClose= Editor.prototype.confirmClose;
    //console.log( 'Editor.prototype.confirmClose intercept set up' );
})();