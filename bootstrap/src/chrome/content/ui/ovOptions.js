/*
 * Copyright 2009, 2010 Samit Badle, Samit.Badle@gmail.com
 * Copyright 2012 Peter Kehl
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
function chooseScriptFile(target) {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, "Select script file", nsIFilePicker.modeOpen); // @TODO modeOpenMultiple
	fp.appendFilter( "Javascript", "*.js");
    fp.appendFilters( nsIFilePicker.filterAll);
    
    var profileDir= Components.classes["@mozilla.org/file/directory_service;1"].getService( Components.interfaces.nsIProperties)
        .get("ProfD", Components.interfaces.nsIFile);
    fp.displayDirectory= profileDir;
	var res = fp.show();
	if (res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace) {
		var e = document.getElementById(target);
		e.value = fp.file.path; // @TODO When in multiple file mode, use fp.files
        // But it'd be nice to show each file on a separate line in Options>SeBootstrap; the same for IDE/Core extensions.
        // and/or: have a flag 'bootstrap' next to each file in Core extension file list
	}
}

function focusSeBootstrapTab() {
	if (window.arguments && window.arguments[1] && window.arguments[1] == 'se-bootstrap') {
		document.getElementById('optionsTabs').selectedItem = document.getElementById('SeBootstrapTab');
	}
}
window.addEventListener("load", function(e) { focusSeBootstrapTab(); }, false);