(function() { // Anonymous function to make the variables local
    //var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    var SeLiteSettings= Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
  
    //@TODO Store the test suite folder via JS component. Have API to return via SeLiteSettings JS component.
    // Tail-intercept of TestSuite.loadFile(file)
    var originalLoadFile= TestSuite.loadFile;
    TestSuite.loadFile= function(file) {
        var result= originalLoadFile.call( this, file );
        //SeLiteSettings.TestSuiteFolderInfo.path= file.parent.path;
        return result;
    };
    
    // Tail-intercept of TestSuite.prototype.save(newFile)
    var originalSave= TestSuite.prototype.save;
    TestSuite.prototype.save= function(newFile) {
        var result= originalSave.call(this, newFile);
        // If !this.file or newFile, then the original function call is not saving the file, but it calls itself recursively.
        // That recursive call has this.file and newFile. See the original code in IDE's chrome/content/testSuite.js
        if( this.file && !newFile ) {
            //SeLiteSettings.TestSuiteFolderInfo.path= this.file.parent.path;
        }
        return result;
    };
    
    // Tail-intercept TestSuite constructor itself. Copy all the fields (i.e. static methods & prototype).
    // That (as of Se IDE 2.4.0) is compatible with how original IDE's chrome/content/testSuite.js applies observable(TestSuite) - see also IDE's chrome/content/tools.js
    var originalTestSuite= TestSuite;
    TestSuite= function() {
        originalTestSuite.call(this);
        SeLiteSettings.TestSuiteFolderInfo.path= undefined;
    };
    for( var i in originalTestSuite ) {
        TestSuite[i]= originalTestSuite[i];
    }
    TestSuite.prototype= originalTestSuite.prototype;
} )();