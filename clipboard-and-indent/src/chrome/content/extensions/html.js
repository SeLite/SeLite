/*
 * Copyright 2005 Shinya Kasatani and/or Selenium IDE team
 * Copyright 2015, 2016 Peter Kehl
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
 * Based on Selenium code of chrome/content/formats/html.js. This adds parseCommandsAndHeader(), it adjusts parse() respectively, and it changes option 'commandLoadPattern'.
 * parseCommandsAndHeader() and related code in ide-extension.js, makes Selenium IDE accept HTML from native clipboard, regardless of its souce (potentially another Selenium IDE instance, or a file), as far as it fits the format.
 * Changes to 'commandLoadPattern' fix https://github.com/SeleniumHQ/selenium/issues/1636 and https://github.com/SeleniumHQ/selenium/issues/1546.
 */
// Characters that should be escaped when saving.
var EncodeToXhtmlEntity = ["amp", "gt", "lt", "quot", "nbsp"];

var XhtmlEntityFromChars = {};
for (var i = 0; i < EncodeToXhtmlEntity.length; i++) {
    var entity = EncodeToXhtmlEntity[i];
    XhtmlEntityFromChars[XhtmlEntities[entity]] = entity;
}

// A regular expression that matches characters that can be converted to entities.
var XhtmlEntityChars = "[";
for (var code in XhtmlEntityFromChars) {
    var c = parseInt(code).toString(16);
    while (c.length < 4) {
        c = "0" + c;
    }
    XhtmlEntityChars += "\\u" + c;
}
XhtmlEntityChars += "]";

function decodeText(text) {
    if (text == null) return "";
	text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/&(\w+);/g, function(str, p1) {
            var c = XhtmlEntities[p1];
            if (c) {
                return String.fromCharCode(c);
            } else {
                return str;
            }
        });
    // Following has to replace '&#160;' (XML for non-breakable space). Otherwise &#160; showed up in Selenium IDE 'Table' mode/tab (rather than just in 'Source' mode/tab).
    text = text.replace(/&#(\d+);/g, function(str, p1) { 
            return String.fromCharCode(parseInt(p1));
        });
    text = text.replace(/&#x([0-9a-f]+);/gi, function(str, p1) { 
            return String.fromCharCode(parseInt(p1, 16));
        });
    text = text.replace(/ +/g, " "); // truncate multiple spaces to single space
    text = text.replace(/\xA0/g, " "); // treat nbsp as space (A0 is hexadecimal of 160 - unicode for nbsp)
	if ('true' == options.escapeDollar) {
		text = text.replace(/([^\\])\$\{/g, '$1$$$${'); // replace [^\]${...} with $${...}
		text = text.replace(/^\$\{/g, '$$$${'); // replace ^${...} with $${...}
		text = text.replace(/\\\$\{/g, '$${'); // replace \${...} with ${...}
	}
	return text;
}

function encodeText(text, asComment=false ) {
    if (text == null) return "";
    // & -> &amp;
    // &amp; -> &amp;amp;
    // &quot; -> &amp;quot;
    // \xA0 -> &#160; (which is XML hexadecimal for &nbsp;)
    text = text.replace(new RegExp(XhtmlEntityChars, "g"),
                        function(c) {
            var entity = XhtmlEntityFromChars[c.charCodeAt(c)];
            if (entity) {
                return "&" + entity + ";";
            } else {
                throw "Failed to encode entity: " + c;
            }
        });
    if( !asComment ) { // Following is not indented, to keep it comparable to original Selenium IDE code
    text = text.replace(/ {2,}/g, function(str) { // convert multiple spaces to XML non-breakable space &#160;
            var result = '';
            for (var i = 0; i < str.length; i++) {
                result += '&#160;';
            }
            return result;
        });
    text = text.replace( /&nbsp;/g, '&#160;' ); // To make existing non-XML files XML-compliant.
    
	if ('true' == options.escapeDollar) {
		text = text.replace(/([^\$])\$\{/g, '$1\\${'); // replace [^$]${...} with \${...}
		text = text.replace(/^\$\{/g, '\\${'); // replace ^${...} with \${...}
		text = text.replace(/\$\$\{/g, '${'); // replace $${...} with ${...}
	}
    }
    text = text.replace(/\n/g, "<br />"); // Not sure how this can happen, since Selenium IDE 2.9.1.1 doesn't allow to enter (or paste from clipboard) text with new lines.
	return text;
}

function convertText(command, converter) {
	var props = ['command', 'target', 'value'];
	for (var i = 0; i < props.length; i++) {
		var prop = props[i];
		command[prop] = converter(command[prop]);
	}
}

/** Parse & extract any header, command(s) and/or comment(s). Used to parse test case .html files, and also to parse from HTML from native clipboard. Factored out from original parse().
 * @param {string} doc HTML source to parse.
 * @returns {object} {commands: Array commands, header: string or undefined header, lastIndex: number }
 */
function parseCommandsAndHeader( doc ) {
    var commandRegexp = new RegExp(options.commandLoadPattern, 'i');
    var commentRegexp = new RegExp(options.commentLoadPattern, 'i');
    var commandOrCommentRegexp = new RegExp("((" + options.commandLoadPattern + ")|(" + options.commentLoadPattern + "))", 'ig');
    var commandFound = false;
    
    var commands = [];
    var lastIndex;
    var header;
    while (true) {
            //log.debug("doc=" + doc + ", commandRegexp=" + commandRegexp);
            lastIndex = commandOrCommentRegexp.lastIndex;
            var docResult = commandOrCommentRegexp.exec(doc);
            if (docResult) {
                    if (docResult[2]) { // command
                            var command = new Command();
                            command.skip = docResult.index - lastIndex;
                            command.index = docResult.index;
                            var result = commandRegexp.exec(doc.substring(lastIndex));
                            eval(options.commandLoadScript);
                            convertText(command, decodeText);
                            commands.push(command);
                            if (!commandFound) {
                                    // remove comments before the first command or comment
                                    for (var i = commands.length - 1; i >= 0; i--) {
                                            if (commands[i].skip > 0) {
                                                    commands.splice(0, i);
                                                    break;
                                            }
                                    }
                                    header = doc.substr(0, commands[0].index);
                                    commandFound = true;
                            }
                    } else { // comment
                            var comment = new Comment();
                            comment.skip = docResult.index - lastIndex;
                            comment.index = docResult.index;
                            var result = commentRegexp.exec(doc.substring(lastIndex));
                            eval(options.commentLoadScript);
                            comment.comment= decodeText( comment.comment );
                            commands.push(comment);
                    }
            } else {
                    break;
            }
    }
    return {
        commands: commands,
        header: header,
        lastIndex: lastIndex
    };
}

var originalValues= {
    // Following values are from Selenium IDE's content/formats/html.js, with exact same indentation.
    // Selenium IDE 2.9.1.1 doesn't save commentXyz options, hence no need to modify them. If it does so in the future, then here list its originals for: commentLoadPattern, commentLoadScript and commentTemplate
    commandLoadPattern:
    "<tr\s*[^>]*>" +
	"\\s*(<!--[\\d\\D]*?-->)?" +
	"\\s*<td\s*[^>]*>\\s*([\\w]*?)\\s*</td>" +
	"\\s*<td\s*[^>]*>([\\d\\D]*?)</td>" +
	"\\s*(<td\s*/>|<td\s*[^>]*>([\\d\\D]*?)</td>)" +
	"\\s*</tr>\\s*",
    
	testTemplate:
    '<?xml version="1.0" encoding="${encoding}"?>\n' +
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n' +
	'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n' +
	'<head profile="http://selenium-ide.openqa.org/profiles/test-case">\n' +
	'<meta http-equiv="Content-Type" content="text/html; charset=${encoding}" />\n' +
    '<link rel="selenium.base" href="${baseURL}" />\n' +
	"<title>${name}</title>\n" +
	"</head>\n" +
	"<body>\n" +
	'<table cellpadding="1" cellspacing="1" border="1">\n'+
	'<thead>\n' +
	'<tr><td rowspan="1" colspan="3">${name}</td></tr>\n' +
	"</thead><tbody>\n" +
	"${commands}\n" +
	"</tbody></table>\n" +
	"</body>\n" +
	"</html>\n"
};

function replaceTraditionalHeader( testCase ) {
    var template= originalValues.testTemplate;
    var tbodyStart= template.indexOf( '<tbody>');
    if( tbodyStart>=0 ) {
        template= template.substring( 0, tbodyStart );
        template= template.replace( /\$\{[a-zA-Z]+\}/g, '(.*)' );
        var regexp= new RegExp( template );
        debugger;
        var match= regexp.exec( testCase.header );
        if( match ) {
            var startOfCommands= this.options.testTemplate.indexOf( '${commands}' );
            testCase.header= this.options.testTemplate.substr( 0, startOfCommands );
            
            testCase.header= testCase.header.replace( '${encoding}', match[1] );
            testCase.header= testCase.header.replace( '${encoding}', match[2] );
            testCase.header= testCase.header.replace( '${baseURL}', match[3] );
            testCase.header= testCase.header.replace( '${name}', match[4] );
            testCase.header= testCase.header.replace( '${name}', match[5] );
            log.debug("replaced traditional header");
        }
    }
}

/**
 * Parse source and update TestCase. Throw an exception if any error occurs.
 *
 * @param testCase TestCase to update
 * @param source The source to parse
 */
function parse(testCase, source) {
	var doc = source;
    var commandsAndHeader= parseCommandsAndHeader( doc );
    // Removed old condition: if( 'header' in commandsAndHeader ), because it is always true (commandsAndHeader.header is always set, even though it can be undefined).
    testCase.header= commandsAndHeader.header;
	if (commandsAndHeader.commands.length > 0) {
        replaceTraditionalHeader( testCase );
		testCase.footer = doc.substring(commandsAndHeader.lastIndex);
		log.debug("header=" + testCase.header);
		log.debug("footer=" + testCase.footer);
		if (testCase.header &&
		    /<link\s+rel="selenium\.base"\s+href="(.*)"/.test(testCase.header)) {
		    testCase.baseURL = decodeURI(RegExp.$1);
		}
		//log.debug("commands.length=" + commands.length);
		testCase.commands = commandsAndHeader.commands;
	}else {
		//Samit: Fix: Atleast try to allow empty test cases, before screaming murder
		//Note: This implementation will work with empty test cases saved with this formatter only
		var templateVars = matchTemplateAndExtractVars(source, options.testTemplate);
		if (templateVars) {
			//Since the matching has succeeded, update the test case with found variable values
			if (templateVars["baseURL"]) {
				testCase.baseURL = templateVars["baseURL"][0];
			}
			if (templateVars["commands"]) {
				testCase.header = doc.substring(0, templateVars["commands"][1]);
                replaceTraditionalHeader( testCase );
				testCase.footer = doc.substring(templateVars["commands"][1]);
				log.debug("header=" + testCase.header);
				log.debug("footer=" + testCase.footer);
			}
			testCase.commands = commandsAndHeader.commands;
		}else {
			throw "no command found";
		}
	}
}

//Samit: Enh: Utility function to match the document against a template and extract the variables marked as ${} in the template
function matchTemplateAndExtractVars(doc, template) {
	var matchTextRa = template.split(/(\$\{\w+\})/g);
	var templateVars = {};
	var captureVar;
	var matchIndex = 0;
		
	for (var i=0; i<matchTextRa.length; i++) {
		var matchedVar = matchTextRa[i].match(/\$\{(\w+)\}/i);
		if (matchedVar) {
			//Found variable!
			if (templateVars[matchedVar[1]]) {
				//already captured, treat as static text and match later
				matchTextRa[i] = templateVars[matchedVar[1]][0];
			}else {
				//variable capture required
				if (captureVar) {
					//Error: Capture failed as there is no way to delimit adjacent variables without static text between them
					log.debug("Error: Capture failed as there is no way to delimit adjacent variables without static text between them");
					return null;
				}
				captureVar = matchedVar[1];
				continue;
			}
		}
		//static text
		if (captureVar) {
			//search for static string
			var index = doc.indexOf(matchTextRa[i], matchIndex);
			if (index >= 0) {			
				//matched
				templateVars[captureVar] = [doc.substring(matchIndex, index), matchIndex];
				matchIndex = matchTextRa[i].length + index;
				captureVar = null;
			}else {
				//Error: Match failed
				log.debug("Error: Match failed");
				return null;
			}
		}else {
			//match text
			if (doc.substr(matchIndex, matchTextRa[i].length) == matchTextRa[i]) {
				//matched!
				matchIndex += matchTextRa[i].length;
			}else {
				//Error:  Match failed
				log.debug("Error: Match failed");
				return null;
			}
		}
	}
	if (captureVar) {
		// capture the final variable if any
		templateVars[captureVar] = [doc.substring(matchIndex), matchIndex];
	}
	return templateVars;
}

function getSourceForCommand(commandObj) {
	var command = null;
	var comment = null;
	var template = '';
	if (commandObj.type == 'command') {
		command = commandObj;
		command = command.createCopy();
		convertText(command, this.encodeText);
		template = options.commandTemplate;
	} else if (commandObj.type == 'comment') {
		comment = commandObj;
        comment.comment= encodeText( comment.comment, true );
		template = options.commentTemplate;
	}
	var result;
	var text = template.replace(/\$\{([a-zA-Z0-9_\.]+)\}/g, 
        function(str, p1, offset, s) {
            result = eval(p1);
            return result != null ? result : '';
        });
	return text;
}

/**
 * Format an array of commands to the snippet of source.
 * Used to copy the source into the clipboard.
 *
 * @param The array of commands to sort.
 */
function formatCommands(commands) {
	var commandsText = '';
	for (i = 0; i < commands.length; i++) {
		var text = getSourceForCommand(commands[i]);
		commandsText = commandsText + text;
	}
	return commandsText;
}

/**
 * Format TestCase and return the source.
 * The 3rd and 4th parameters are used only in default HTML format.
 *
 * @param testCase TestCase to format
 * @param name The name of the test case, if any. It may be used to embed title into the source.
 */
function format(testCase, name) {
	var text;
	var commandsText = "";
	var testText;
	var i;
	
	for (i = 0; i < testCase.commands.length; i++) {
		var text = getSourceForCommand(testCase.commands[i]);
		commandsText = commandsText + text;
	}
	
	var testText;
	if (testCase.header == null || testCase.footer == null) {
		testText = options.testTemplate;
		testText = testText.replace(/\$\{name\}/g, name);
		var encoding = options["global.encoding"];
		if (!encoding) encoding = "UTF-8";
		testText = testText.replace(/\$\{encoding\}/g, encoding);
		testText = testText.replace(/\$\{baseURL\}/g, encodeURI(testCase.getBaseURL()));
		var commandsIndex = testText.indexOf("${commands}");
		if (commandsIndex >= 0) {
			var header = testText.substr(0, commandsIndex);
			var footer = testText.substr(commandsIndex + "${commands}".length);
			testText = header + commandsText + footer;
		}
	} else {
		testText = testCase.header + commandsText + testCase.footer;
	}
	
	return testText;
}

function defaultExtension() {
  return this.options.defaultExtension;
}

// Following changes commandLoadPattern setting from the original. That fixes https://github.com/SeleniumHQ/selenium/issues/1636 and https://github.com/SeleniumHQ/selenium/issues/1546. This change of default settings has effect, even if the user used Selenium IDE before she installed this SeLite extension (as far as didn't modify these settings in Selenium IDE menu Options > Options... > Formats).
/*
 * Optional: The customizable option that can be used in format/parse functions.
 */
this.options = {
	commandLoadPattern:
	"<tr\\s*[^>]*>" +
	"\\s*(<!--[\\d\\D]*?-->)?" +
	"\\s*<td\\s*[^>]*>\\s*((?:&#160;|&#xA0;|&nbsp;)*[\\w]*?)\\s*</td>" +
	"\\s*<td\\s*[^>]*>([\\d\\D]*?)</td>" +
	"\\s*(<td\\s*/>|<td\\s*[^>]*>([\\d\\D]*?)</td>)" +
	"\\s*</tr>\\s*",
	
	commandLoadScript:
	"command.command = result[2];\n" +
	"command.target = result[3];\n" +
	"command.value = result[5] || '';\n",

	commentLoadPattern:
	'(?:<!--([\\d\\D]*?)-->|<tr><td colspan="3" class="comment">([\\d\\D]*?)</td></tr>)\\s*',

	commentLoadScript:
	"comment.comment = result[1]!==undefined ? result[1] : result[2];\n",

	testTemplate:
    '<?xml version="1.0" encoding="${encoding}"?>\n' +
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n' +
	'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n' +
	'<head profile="http://selenium-ide.openqa.org/profiles/test-case">\n' +
	'<meta http-equiv="Content-Type" content="text/html; charset=${encoding}" />\n' +
    '<link rel="selenium.base" href="${baseURL}" />\n' +
	"<title>${name}</title>\n" +
    '<style type="text/css">.comment {color: #AA33AA}</style>'+ // From chrome/skin/classic/selenium-ide.css: treechildren::-moz-tree-cell-text(comment)
	"</head>\n" +
	"<body>\n" +
	'<table cellpadding="1" cellspacing="1" border="1">\n'+
	'<thead>\n' +
	'<tr><td rowspan="1" colspan="3">${name}</td></tr>\n' +
	"</thead><tbody>\n" +
	"${commands}\n" +
	"</tbody></table>\n" +
	"</body>\n" +
	"</html>\n",

	commandTemplate:
	"<tr>\n" +
	"\t<td>${command.command}</td>\n" +
	"\t<td>${command.target}</td>\n" +
	"\t<td>${command.value}</td>\n" +
	"</tr>\n",

	commentTemplate:
	'<tr><td colspan="3" class="comment">${comment.comment}</td></tr>\n',
	
	escapeDollar:
	"false",
	
	defaultExtension: "html"
};

/*** Unless you install SeLite and Selenium IDE at the exact same time, Selenium IDE stores the 'default' formatter options in Firefox preferences. Then commandLoadPattern and commentLoadPattern from the above won't have effect, even though this file (later) overrides Selenium IDE's html.js (as it was in version 2.9.1.1). Hence here we change that Firefox preference, but only if it was equal to the old value from Selenium IDE's html.js (and not if it were changed by the user).
 * <br/>This doesn't compare the preferences to original default options of the Selenium IDE current installed. Instead, it compares it to values used in Selenium IDE 2.9.1.1 (copied as hard-coded here). If the current Selenium IDE has different default values, re-assess this.
 * <br/>This doesn't use Selenium API, because it was impractical/impossible.
 * <br/>When this is being processed, Selenium IDE already loaded preferences. Therefore this will only have an effect after you restart Selenium IDE.
 */
( ()=>{ // closure to keep prefs local
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService); // -> instance of nsIPrefBranch
    var prefsBranch= prefs.getBranch( 'extensions.selenium-ide.formats.default.' );
    // @TODO retest - is originalValues, or it is this.originalValues? if this.originalValues, then don't use an arrow function, but a classic function.
    for( var optionName in originalValues ) {
        if( prefsBranch.prefHasUserValue(optionName) ) {
            if( prefsBranch.getCharPref( optionName )===originalValues[optionName] ) {
                prefsBranch.setCharPref( optionName, this.options[optionName] );
            }
        }
    }
} ) ();

/*
 * Optional: XUL XML String for the UI of the options dialog
 */
this.configForm = 
	//'<tabbox flex="1"><tabs orient="horizontal"><tab label="Load"/><tab label="Save"/></tabs>' +
	//'<tabpanels flex="1">' +
	//'<tabpanel orient="vertical">' +
	'<description>Regular expression for each command entry</description>' +
	'<textbox id="options_commandLoadPattern" flex="1"/>' +
	'<separator class="thin"/>' +
	'<description>Script to load command from the pattern</description>' +
	'<textbox id="options_commandLoadScript" multiline="true" flex="1" rows="2"/>' +
	//'<separator class="thin"/>' +
	//'<description>Regular expression for comments between commands</description>' +
	//'<textbox id="options_commentLoadPattern" flex="1"/>' +
	//'<separator class="thin"/>' +
	//'<description>Script to load comment from the pattern</description>' +
	//'<textbox id="options_commentLoadScript" multiline="true" flex="1" rows="2"/>' +
	'<separator class="groove"/>' +
	//'</vbox><vbox>' +
	//'</tabpanel>' +
	//'<tabpanel orient="vertical">' +
	'<description>Template for new test html file</description>' +
	'<textbox id="options_testTemplate" multiline="true" flex="1" rows="3"/>' +
	'<separator class="thin"/>' +
	'<description>Template for command entries in the test html file</description>' +
	'<textbox id="options_commandTemplate" multiline="true" flex="1" rows="3"/>' +
	'<separator class="groove"/>' +
  '<checkbox id="options_escapeDollar" label="Escape \'$' + '{\' as \'\\$' + '{\' (useful for JSP 2.0)"/>';
	//'<separator class="thin"/>' +
	//'<description>Template for comment entries in the test html file</description>' +
	//'<textbox id="options_commentTemplate" multiline="true" flex="1"/>' +
	//'</tabpanel></tabpanels></tabbox>';
