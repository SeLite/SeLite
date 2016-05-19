"use strict";

// If I don't set 'console', the console and stderr won't show up any messages below.
var console= Components.utils.import("resource://gre/modules/Console.jsm", {}).console;
/*if( !window.location.search ) {
console.error( 'Invoke as: firefox -no-remote -P <testProfileName> -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul?~/selite/extension-sequencer/shell-tests/xxx/fileContainingExpectedOutput.txt' );
}
else {*/
var extensionLoaderScope= {
    runAsCheck: true,
    afterChecks: function afterChecks( problems ) {
        /* Following was when I wanted to compare the actual output and the expected output here. Now I do it in run_tests.sh
        var FileUtils= Components.utils.import("resource://gre/modules/FileUtils.jsm", {} ).FileUtils;            
        var file= new FileUtils.File( window.location.search.substring(1) ); // Object of class nsIFile
        var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
                  createInstance(Components.interfaces.nsIFileInputStream);
        var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                      createInstance(Components.interfaces.nsIConverterInputStream);
        fstream.init(file, -1, -1, 0);
        cstream.init(fstream, "UTF-8", 0, 0);
        var contents= "";
        var str= {};
        var read = 0;
        do {
            read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
            contents += str.value;
        } while (read != 0);
        cstream.close(); // this closes fstream, too
        var expectedProblems= contents.split('\n');
        var expectedProblemsSorted= expectedProblems.splice().sort();
        var problemsSorted= problems.splice().sort();

        var problemsAreDifferent= problemsSorted.length!==expectedProblemsSorted.length;
        if( !problemsAreDifferent ) {
            for( var i=0; i<problemsSorted.length; i++ ) {
                if( problemsSorted[i]!==expectedProblemsSorted[i] ) {
                    problemsAreDifferent= true;
                    break;
                }
            }
        }
        if( problemsAreDifferent ) {
            console.error( 'SeLite ExtensionSequencer Test: actual problems:\n' +problems.join('\nSeLite ExtensionSequencer Test:') );
            console.error( '\n\nSeLite ExtensionSequencer Test: expected problems:\n' +expectedProblems.join('\nSeLite ExtensionSequencer Test:') );
        }*/
        Components.classes['@mozilla.org/toolkit/app-startup;1'].getService( Components.interfaces.nsIAppStartup ).quit( Components.interfaces.nsIAppStartup.eForceQuit );
    },
    registerAndPreActivate: window.location.search.indexOf('registerAndPreActivate')>0
};
Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader).loadSubScript( 'chrome://selite-extension-sequencer/content/extensions/extension-loader.js', extensionLoaderScope, 'UTF-8' );

