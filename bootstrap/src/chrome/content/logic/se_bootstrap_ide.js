/*
 * Copyright 2009, 2010, 2011 Samit Badle, Samit.Badle@gmail.com
 * Copyright 2012 Peter Kehl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * This is a simple bootstrap reloader of javascript files that extend Selenium Core.
 * @TODO Since it re-loads javascript file(s), they must be written in a way that allows it.
 * Especially, don't chain existing methods, unless you chain them on the first load only.
 * - compare the current handler and your new handler functions
 * 
 * Or
 * 
 *   If we have a file that tail-intercepts an existing method, then split it to two files
 *   - one: the tail intercept setup, that calls the original method and a new method
 *   - second: the implementation of the new method that performs tail intercept extra tasks
 *   Then only bootstrap modify the second file.
 *   
 *   Or:
 *   
 *   Use just one file if you want, but make it bootstrap-friendly, e.g.
 *   if( (typeof originalMethod)==="undefined" ) {
 *      var originalMethod= Selenium.prototype.<methodName>;
 *   }
 *   Selenium.prototype.<methodName>= function(pqr...) {
 *      originalMethod.call(this);
 *      // extra new tasks...
 *   }
 *   
 *   then we need to reload more of them; or: cache the Javascript contents and just re-run it all
 */
"use strict";
throw new Error('not to be yused');
// This file can't access 'Selenium' class. But ../extensions/se_bootstrap.js can access 'SeBootstrap' class.
// Therefore here (in SeBootstrap class) I define method(s) that are called from ../extensions/se_bootstrap.js

function SeBootstrap(editor) {
  var options = editor.getOptions();
  if (!options.se_bootstrap_scriptFileName) {
    //Full name of options key is extensions.selenium-ide.se_bootstrap_scriptFileName
    options['se_bootstrap_scriptFileName'] = '';	//default to empty
  }
  this.editor = editor;
  this.optionsChanged(options);
  editor.app.addObserver(this);
}

(
    function() {
        // This gets called
        // 1. at start of Se IDE (invoked by SeBootstrap constructor)
        // 2. whenever you save Se IDE options, whether scriptFileName changed or not
        SeBootstrap.prototype.optionsChanged= function optionsChanged(options) {
          //this.scriptFileName = options.se_bootstrap_scriptFileName;
        };
    }
)();
/** This will be the (only) instance of SeBootstrap, once instantiated.
 **/
SeBootstrap.instance= null;

// Init the Se Bootstrap extension
try {
  SeBootstrap.instance= this.editor.seBootstrap = new SeBootstrap(this.editor);
} catch (error) {
  alert('Error in SeBootstrap: ' + error);
  //SeleniumIDE.Loader.getTopEditor().log.error('Error in SeBootstrap: ' + error); // @TODO try this?
}