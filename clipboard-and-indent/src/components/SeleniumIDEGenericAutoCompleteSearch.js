/*
 * Copyright 2005 Shinya Kasatani  and/or Selenium IDE team
 * Copyright 2015 Peter Kehl
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
 * 
 * Based on Selenium code of components/SeleniumIDEGenericAutoCompleteSearch.js. This fixes https://github.com/SeleniumHQ/selenium/issues/1546
 */
function SeleniumIDEGenericAutoCompleteSearch() {
	this.candidates = {};
}

SeleniumIDEGenericAutoCompleteSearch.prototype = {
	startSearch: function(searchString, searchParam, prevResult, listener) {
		var result = new AutoCompleteResult(searchString, this.candidates[searchParam] || []);
		listener.onSearchResult(this, result);
	},

	stopSearch: function() {
	},

    setCandidates: function(key, values) {
        this.setCandidatesWithComments(key, values, null);
	},

    setCandidatesWithComments: function(key, values, comments) {
		var count = values.Count();
        var candidates = this.candidates[key] = new Array(count);
		for (var i = 0; i < count; i++) {
            candidates[i] = [values.GetElementAt(i).QueryInterface(Components.interfaces.nsISupportsString).data,
                             comments ? comments.GetElementAt(i).QueryInterface(Components.interfaces.nsISupportsString).data : null];
		}
	},

    clearCandidates: function(key) {
        if (this.candidates[key]) {
            delete this.candidates[key];
        }
    },

    QueryInterface: function(uuid) {
		if (uuid.equals(Components.interfaces.nsISeleniumIDEGenericAutoCompleteSearch) ||
                        /*uuid.equals(Components.interfaces.nsISeLiteGenericAutoCompleteSearch) ||*/
			uuid.equals(Components.interfaces.nsIAutoCompleteSearch) ||
			uuid.equals(Components.interfaces.nsISupports)) {
			return this;
		}
        Components.returnCode = Components.results.NS_ERROR_NO_INTERFACE;
        return null;
    }
};

// Commands (other than ones starting with 'end') that suggest indentation to the left: decrease of indentation as compared to the previous command. Some of them are also 'opening' commands - see ide-extension.js
var closingCommands= ['else', 'elseIf', 'catch', 'finally'];

function AutoCompleteResult(search, candidates) {
        this.search = search;
	this.result = [];
        
        // Preserving any indentation
        var indentationPrefix= '';
        var indented= /^(\s+)/.exec(search);
        if( indented ) {
            indentationPrefix= indented[1];
        }
        search= search.trimLeft();
        
	var lsearch = search.toLowerCase();
    //Samit: Enh: add support for strict camel case as well as relaxed camel case autocompletion
    if (lsearch != search && search.match(/^!?[A-Za-z]+$/)) {
        var searchSrc = search;
        var pattern = "[a-z]*$1";
        if (searchSrc.match(/^!/)) {
            //use relaxed camel case if the search expression begins with an "!"
            pattern = ".*$1";
            searchSrc = searchSrc.replace(/^!/, '');
        }
        var searchRegExp = new RegExp(searchSrc.replace(/([A-Z]|$)/g, pattern));
        for (var i = 0; i < candidates.length; i++) {
            if (searchRegExp.test(candidates[i][0])) {
                this.result.push( candidates[i] );
            }
        }
    }else {
        for (var i = 0; i < candidates.length; i++) {
            if( candidates[i][0].toLowerCase().indexOf(lsearch)===0 ) {
                this.result.push( candidates[i] );
            }
        }
    }
    if( indentationPrefix ) {
        var isFullyTyped= false; // Whether search (excluding any indentation) fully matches a command, rather than just its prefix.
        for( var i=0; i<this.result.length; i++ ) {//@TODO for(..of..)
            var candidate= this.result[i][0];
            if( search===candidate ) {
                isFullyTyped= true;
                break;
            }
        }
        var matchesClosingCommand= false; // Whether search matches at least three letter prefix of any of closingCommands
        if( search.length>=3 ) {
            for( var i=0; i<closingCommands.length; i++ ) {//@TODO for(..of..)
                if( closingCommands[i].indexOf(search)===0 ) {
                    matchesClosingCommand= true;
                    break;
                }
            }
        }
        if( indentationPrefix.length>=2 && !isFullyTyped &&
            ( search.startsWith('end') || matchesClosingCommand )
        ) {
            // Unindent endXXX or any closing command when it is typed (i.e. hwen it doesn't fully match any command yet)
            indentationPrefix= indentationPrefix.substr( 2 );
        }
        for( var i=0; i<this.result.length; i++ ) {
            var candidateCopy= this.result[i].slice();
            candidateCopy[0]= indentationPrefix+candidateCopy[0];
            this.result[i]= candidateCopy;
            // This adds much more indentation than the above: this.result[i][0]= indentationPrefix+this.result[i][0];
        }
    }
}

AutoCompleteResult.prototype = {
	get defaultIndex() {
		return 0;
	},
	get errorDescription() {
		return '';
	},
	get matchCount() {
		return this.result.length;
	},
	get searchResult() {
		return Components.interfaces.nsIAutoCompleteResult.RESULT_SUCCESS;
	},
	get searchString() {
		return this.search;
	},
	getCommentAt: function(index) {
		return this.result[index][1] || '';
	},
	getStyleAt: function(index) {
		return '';
	},
	getValueAt: function(index) {
		return this.result[index][0];
	},
	getImageAt: function (index) {
		return '';
	},
	getLabelAt: function getLabelAt(index) {
		return this.getValueAt(index);
	},
	getFinalCompleteValueAt: function(index) {
		return this.getValueAt(index);
	},
	removeValueAt: function(rowIndex, removeFromDb) {
	},
    QueryInterface: function (uuid) {
		if (uuid.equals(Components.interfaces.nsIAutoCompleteResult) ||
			uuid.equals(Components.interfaces.nsISupports)) {
			return this;
		}
        Components.returnCode = Components.results.NS_ERROR_NO_INTERFACE;
        return null;
    }
};

//Replaced by SeLite:
//const COMPONENT_ID = Components.ID("{4791AF5F-AFBA-45A1-8204-47A135DF9591}");
//const COMPONENT_ID = Components.ID("{E5226A0D-4698-4E15-9D6D-86771AE172C9}");
const COMPONENT_ID = Components.ID("{3d2a8f40-ac09-11e4-ab27-0800200c9a66}");

var SeleniumIDEGenericAutoCompleteModule = {
    registerSelf: function (compMgr, fileSpec, location, type) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
        compMgr.registerFactoryLocation(COMPONENT_ID,
                                        "Selenium IDE Generic Autocomplete",
                                        "@mozilla.org/autocomplete/search;1?name=selenium-ide-generic",
                                        fileSpec,
                                        location,
                                        type);
    },

    getClassObject: function (compMgr, cid, iid) {
        if (!cid.equals(COMPONENT_ID)) throw Components.results.NS_ERROR_NO_INTERFACE;
        if (!iid.equals(Components.interfaces.nsIFactory))
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

		return SeleniumIDEGenericAutoCompleteFactory;
    },

    canUnload: function(compMgr) {
        return true;
    }
};

var SeleniumIDEGenericAutoCompleteFactory = {
	createInstance: function (outer, iid) {
		if (outer != null)
			throw Components.results.NS_ERROR_NO_AGGREGATION;
		return new SeleniumIDEGenericAutoCompleteSearch().QueryInterface(iid);
	}
};

function NSGetModule(compMgr, fileSpec) {
    return SeleniumIDEGenericAutoCompleteModule;
}

function NSGetFactory(cid) {
    if (cid.toString().toUpperCase() != COMPONENT_ID.toString().toUpperCase()) throw Components.results.NS_ERROR_FACTORY_NOT_REGISTERED;
    return SeleniumIDEGenericAutoCompleteFactory;
}
