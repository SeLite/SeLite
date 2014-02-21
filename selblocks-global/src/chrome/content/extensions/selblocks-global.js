/* Copyright 2011 Chris Noe
 * Copyright 2011, 2012, 2013, 2014 Peter Kehl
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 1.1. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/1.1/.
 */
/**
 * SelBlocks Global = SelBlocks with functions callable across test cases.
 * Based on SelBlocks 1.3 with 'script' renamed to 'function' as per SelBlocks 2.0.1.
 * SelBlocksGlobal change log, as compared to SelBlocks, in chronological order:
 * - made functions (formerly scripts) callable across test cases
 * - made it compatible with Javscript strict mode - "use strict";
 * -- for that I've removed automatic access to stored variables (without using $). That affects mostly 'for' loop and right side of parameter assignments of 'call'. See SelBlocksGlobal.wiki.
 * - added some syntax sugar to Selenese: string{..}, object{..}, eval{..}, array[..]. See EnhancedSyntax.wiki.
 * - if/while/for, call, string{}, object{}, eval{} and array[] now recognise object "window" - just like getEval() did. 
 * -- therefore evalWithExpandedStoredVars, dropToLoop, returnFromFunction, parseArgs are now a part of Selenium.prototype
 * 
 * Provides commands for javascript-like looping and callable functions,
 *   with scoped variables, and XML driven parameterization.
 *
 * Features:
 *  - Commands: if/else, loadVars, forXml, foreach, for, while, call/script/return
 *  - Script and loop parameters use regular selenium variables that are local to the block,
 *    overriding variables of the same name, and are restored when the block exits.
 *  - Variables can be set via external XML file(s).
 *  - Command parameters are javascript expressions that are evaluated with the selenium
 *    variables in scope, which can therefore be referenced by their simple names, e.g.: i+1
 *  - A script definition can appear anywhere; they are skipped over in normal execution flow.
 *  - Script functions can be invoked recursively.
 *
 * Concept of operation:
 *  - selenium.reset() is intercepted to initialize the block structures. 
 *  - testCase.nextCommand() is overriden for flow branching.
 *  - The static structure of commands & blocks is stored in cmdAttrs[], by command index.
 *  - The execution state of blocks is pushed onto cmdStack, with a separate instance
 *    for each callStack frame.
 *
 * Limitations:
 *  - Incompatible with flowControl (and derivatives), which unilaterally override
 *    selenium.reset(). Known to have this issue: 
 *        selenium_ide__flow_control-1.0.1-fx.xpi
 *        goto_while_for_ide.js 
 *
 * Acknowledgements:
 *  SelBlocks reuses bits & parts of extensions: flowControl, datadriven, and include.
 *
 * Wishlist:
 *  - try/catch
 *  - switch/case
 *
 * Changes since 1.2:
 * - Added continue & break for loops
 */

"use strict";
// =============== global functions as script helpers ===============
// getEval script helpers

// find an element via locator independent of any selenium commands
// (selenium can only provide the first if multiple matches)
function $e(locator) {
  return selenium.browserbot.findElementOrNull(locator);
}

// return the singular XPath result as a value of the appropriate type
function $x(xpath, contextNode, resultType) {
  var doc = selenium.browserbot.getDocument();
  var result = doc.evaluate(xpath, contextNode || doc, null, resultType || XPathResult.ANY_TYPE, null);
  switch (result.resultType) {
    case result.NUMBER_TYPE:  return result.numberValue;
    case result.STRING_TYPE:  return result.stringValue;
    case result.BOOLEAN_TYPE: return result.booleanValue;
  }
  return result.singleNodeValue;
}

// return the XPath result set as an array of elements
function $X(xpath, contextNode) {
  var doc = selenium.browserbot.getDocument();
  var nodeSet = doc.evaluate(xpath, contextNode || doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  var elements = [];
  for (var i = 0, n = nodeSet.snapshotItem(i); n; n = nodeSet.snapshotItem(++i))
    elements.push(n);
  return elements;
}

// Anonymous function serves as a wrapper, to keep any variables defined directly by it private
(function(){
    //Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );
    //var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;


    // =============== javascript extensions as script helpers ===============

    // eg: "dilbert".isOneOf("dilbert","dogbert","mordac") => true
    String.prototype.isOneOf = function(values)
    {
      if( !Array.isArray(values) ) // copy function arguments into an array
        values = Array.prototype.slice.call(arguments);
      for (var i = 0; i < this.length; i++) {
        if (values[i] == this) {
          return true;
        }
      }
      return false;
    };

    // eg: "red".mapTo("primary", ["red","green","blue"]) => primary
    String.prototype.mapTo = function(/* pairs of: string, array */)
    {
      var errMsg = " The map function requires pairs of argument: string, array";
      assert(arguments.length % 2 == 0, errMsg + "; found " + arguments.length);
      for (var i = 0; i < arguments.length; i += 2) {
        assert((typeof arguments[i].toLowerCase() == "string") && Array.isArray(arguments[i+1]),
          errMsg + "; found " + typeof arguments[i] + ", " + typeof arguments[i+1]);
        if (this.isOneOf(arguments[i+1])) {
          return arguments[i];
        }
      }
      return this;
    };

    /** @param TestCase optional
     *  @return int 0-based index of given test case within the list of test cases
     *  of the test suite
     **/
    function testCaseIdx( givenTestCase ) {
      givenTestCase= givenTestCase || testCase;
      // Must not use assert() here, because that calls notifyFatalHere() which calls hereGlobIdx()
      //  which calls globIdx() which calls testCaseIdx()
      if( typeof givenTestCase !=='object' ) {
          var msg= "SelBlocks error: in testCaseIdx(), param givenTestCase is not an object, neither global testCase is.";
          LOG.error( msg );
          throw new Error(msg);
      }
      if( editor.app.testSuite.tests.length==0 ) {
          var msg= "SelBlocks error: in testCaseIdx(), bad editor.app.testSuite.tests.length==0.";
          LOG.error( msg );
          throw new Error(msg);
      }
      for( var caseIndex=editor.app.testSuite.tests.length-1; caseIndex>=0; caseIndex-- ) {
          if( editor.app.testSuite.tests[caseIndex].content===givenTestCase ) {
              break;
          }
      }
      if( caseIndex<0 ) {
          var msg= "SelBlocks error: in testCaseIdx(), givenTestCase was not matched.";
          LOG.error( msg );
          throw new Error(msg);
      }
      return caseIndex;
    }

    function logAndThrow(msg) {
          var error= new Error(msg);
          LOG.error( msg+ "\n" +error.stack );
          throw error;    
    }

    /** This serves to generate unique global identifiers for test script commands.
     *  Results of this functions are usually values of symbols[] and other structures.
     *  @param {number} commandIndex
     *  @param {TestCase} [givenTestCase] optional; using testCase by default
    // I'd rather use objects, but Javascript doesn't compare objects field by field
    // - try javascript:a={first: 1}; b={first: 1}; a==b
     @returns {string} global index of the command, in form testCaseIndex/commandIndex
    */
    function globIdx( commandIndex, givenTestCase) {
      givenTestCase= givenTestCase || testCase;
      // Must not use assert() here, because that calls notifyFatalHere() which calls hereGlobIdx() which calls globIdx()
      if( typeof commandIndex !=='number' || commandIndex<0 ) {
          logAndThrow( "SelBlocks error: in globIdx(), bad type/value of the first parameter commandIndex: " +commandIndex );
      }
      if( typeof givenTestCase !=='object' ) {
          logAndThrow( "SelBlocks error: in globIdx(), bad type of the optional second parameter givenTestCase (or global testCase)." );
      }
      var caseIndex= testCaseIdx(givenTestCase);
      return '' +caseIndex+ '/' +commandIndex;
    }
    // @return numeric (not a Number object) 0-based index of the respective command within its test case
    function localIdx( globIdxValue ) {
      // Can't use assert() here, since assert indirectly calls fmtCmdRef() which calls localIdx() - recursion
      SeLiteMisc.ensureType( globIdxValue, 'string', 'globIdxValue must be a string' );
      if( typeof globIdxValue !== 'string' ) {
          SeLiteMisc.fail( 'globIdxValue must be a string, but got ' +(typeof globIdxValue)+ ': ' +globIdxValue );
          LOG.error( msg );
          throw new Error(msg);
      }
      var lastSlashIndex= globIdxValue.lastIndexOf('/');
      if( lastSlashIndex<=0 ) {
          var msg= 'globIdxValue must contain "/" and not as the first character.';
          LOG.error( msg );
          throw new Error(msg);
      }
      if( lastSlashIndex>=globIdxValue.length ) {
          var msg= 'globIdxValue must contain "/" and not as the last character.';
          LOG.error( msg );
          throw new Error(msg);
      }
      var afterSlash= globIdxValue.substr( lastSlashIndex+1 );
      var afterSlashNumber= new Number( afterSlash );
      if( afterSlash !== ''+afterSlashNumber ) {
          var msg= 'The part after "/" must be numeric.';
          LOG.error( msg );
          throw new Error(msg);
      }
      var result= afterSlashNumber.valueOf();
      //"TODO:"
      if( result<0 || result>=editor.app.testSuite.tests[localCaseIdxPart(globIdxValue)].content.commands.length ) {
          var msg= 'In localIdx("' +globIdxValue+ '"), result ' +result+ ' is not a valid command index';
          LOG.error( msg );
          throw new Error(msg);
      }
      return result;
    }
    /**@param string result of globIdx() or of labelIdx()
     * @return numeric (not a Number object) of 0-based index of the test case (for the given global index)
     *  within the list of test cases (i.e. editor.app.testSuite.tests)
     */
    function localCaseIdxPart( globIdxValue ) {
      assert( typeof globIdxValue ==='string', 'globIdxValue must be a string.' );
      var lastSlashIndex= globIdxValue.lastIndexOf('/');
      assert( lastSlashIndex>0, 'globIdxValue must contain "/" and not as the first character.');
      assert( lastSlashIndex<globIdxValue.length-1, 'globIdxValue must contain "/" and not as the last character.');
      var beforeSlash= globIdxValue.substring( 0, globIdxValue.lastIndexOf('/') );
      var beforeSlashNumber= new Number( beforeSlash );
      assert( beforeSlash == ''+beforeSlashNumber, 'The part after "/" must be numeric.');
      var result= beforeSlashNumber.valueOf();
      assert( result>=0 && result<editor.app.testSuite.tests.length, 'result not a valid index into editor.app.testSuite.tests.');
      return result;
    }

    /** global array of _usable_ test cases, set in compileSelBlocks().
     *  It contains test cases in the same order as in editor.app.testSuite.tests[],
     *  but here they are as they come from editor.getTestCase()
     **/
    var testCases= [];

    // @return TestCase test case for the given global index
    function localCase( globIdxValue ) {
      var index= localCaseIdxPart(globIdxValue);
      assert( index<testCases.length, 'case index: ' +index+ ' but testCases[] has length ' +testCases.length );
      return testCases[ index ];
      /* Following didn't work:
       return editor.app.testSuite.tests[ localCaseIdxPart(globIdxValue) ].content;
      */
    }
    /** This serves to generate and compare keys in symbols[] for label commands
     *  @param string label name
     *  @param TestCase test case where the label is; optional - using testCase by default
     *  @return string global label identifier in form 'test-case-index/label'
     **/
    function labelIdx( label, givenTestCase ) {
        assert( typeof label ==='string', 'label must be a string.');
        givenTestCase= givenTestCase || testCase;
        return ''+testCaseIdx(givenTestCase)+ '/'+ label;
    }

    // @TODO on insert, validate that function names are unique, i.e. no function overriding
    /** @var object symbols {
     *    string equal to function's name => globIdx value
     *    string 'testCaseIndex:label-name' => globIdx value
     * }
     */
    var symbols = {};

    var cmdAttrs = new CmdAttrs();  // static command attributes stored by globIdx value
    /** @var {Stack} callStack Command execution stack */
    var callStack;

    function hereGlobIdx() {
      // Must not use assert() here, because that calls notifyFatalHere() which calls hereGlobIdx()
      // @TODO cross-test case??
      return globIdx( testCase.debugContext.debugIndex);
    }
    /*function hereIdx() {
      return testCase.debugContext.debugIndex;
    }*/

    // command attributes, stored by command global index
    function CmdAttrs() {
      var cmds = {}; // changed this from [] @TODO check whether good; Do we use .length anywhere?
      /** @param {string} i A result of globIdx() function
       *  @param {Object} [attrs] Extra details to add.
       *  @return {TODO} Entry just added to this collection.
       **/
      cmds.init = function(i, attrs) {
        assert( typeof testCase.commands ==='object', 'CmdAttrs::init() - testCase.commands is of bad type.');
        // @TODO assert regex numeric/numeric
        assert( typeof i ==='string', 'CmdAttrs::init() - param i must be a globIdx() result.');
        // @TODO change to use 'this' instead of 'cmds' - it will be clearer.
        cmds[i] = attrs || {};
        cmds[i].idx = i;
        cmds[i].cmdName = localCase(i).commands[ localIdx(i) ].command;
        return cmds[i];
      };
      cmds.here = function() {
        var curIdx = hereGlobIdx();
        if (!cmds[curIdx])
          LOG.warn("No cmdAttrs defined curIdx=" + curIdx);
        return cmds[curIdx];
      };
      return cmds;
    }

    // an Array object with stack functionality
    function Stack() {
      var stack = [];
      stack.isEmpty = function() { return stack.length == 0; };
      stack.top = function()     { return stack[stack.length-1]; };
      stack.find = function(_testfunc) { return stack[stack.indexWhere(_testfunc)]; };
      stack.indexWhere = function(_testfunc) { // undefined if not found
        for (var i = stack.length-1; i >= 0; i--) {
          if (_testfunc(stack[i]))
            return i;
        }
        return undefined;
      };
      stack.unwindTo = function(_testfunc) {
        while (!_testfunc(stack.top()))
          stack.pop();
        return stack.top();
      };
      stack.isHere = function() {
        return stack.length>0 && stack.top().idx==hereGlobIdx();
      };
      return stack;
    }

    Stack.isLoopBlock = function(stackFrame) {
      return (cmdAttrs[stackFrame.idx].blockNature == "loop");
    };

    // Body of this currentCommand() was copied verbatim from Selenium's content/testCase.js

    // This is a global index of the next command - set to a result of globIdx()
    var branchIdx = null;

    // @param globIdx value
    function setNextCommand(cmdIdx) {
      var idx= localIdx(cmdIdx);
      var localTestCase= localCase(cmdIdx);
      assert( idx>=0 && idx< localTestCase.commands.length,
        " Cannot branch to non-existent command @" +cmdIdx );
      branchIdx = cmdIdx;
    }

    // @TODO Not sure we need a tail intercept here, because we are within one already. Or: factor out into a separate tail intercept.
    // tail intercept of Selenium.reset()
    // this is called before: execute a single command / run a testcase / run each testcase in a testsuite
    (function () { // wrapper makes origReset and origTestCaseDebugContextNextCommand private
      var origReset = Selenium.prototype.reset;
      var origTestCaseDebugContextNextCommand;

      Selenium.prototype.reset = function() {// this: selenium
        //console.error( 'Selenium.prototype.reset() called as overriden by SelBlocksGlobal: ' +SeLiteMisc.stack() );
        origReset.call(this);

        // TBD: skip during single command execution
        try {
          compileSelBlocks();
        }
        catch (err) {
          notifyFatalErr("In " + err.fileName + " @" + err.lineNumber + ": " + err);
        }
        callStack = new Stack();
        callStack.push( {cmdStack: new Stack()} ); // top-level execution state
        
        // This is too late to override TestCase! It's instantiated already!
        // @TODO See if I can move override of nextCommand() to be outside of override of reset()
        if( origTestCaseDebugContextNextCommand===undefined ) {
            origTestCaseDebugContextNextCommand= TestCaseDebugContext.prototype.nextCommand; //@TODO This fails - TestCaseDebugContext is not defined
            /**/
            LOG.debug("SelBlocks Global replacing (by a head-intercept): TestCaseDebugContext.prototype.nextCommand()");
            LOG.debug("SelBlocksGlobal: typeof origTestCaseDebugContextNextCommand: " +typeof origTestCaseDebugContextNextCommand );
            // See Selenium's {a6fd85ed-e919-4a43-a5af-8da18bda539f}/chrome/content/testCase.js
            // flow control - we don't just alter debugIndex on the fly, because the command
            // preceeding the destination would falsely get marked as successfully executed.
            // This tail-intercepts testCase.nextCommand(), and it adds support for SelBlocksGlobal branches (across test cases).
            // We can't redefine/tail-intercept testCase.debugContext.nextCommand() at the time
            // this SelBlocksGlobal source file is loaded, because testCase is not defined yet. Therefore we do it here
            // on the first run of the enclosing tail intercept of Selenium.prototype.reset().
            // Based on nextCommand() from Selenium 1.9.0: chrome/content/testCase.js
            // TBD: this needs to be revisited if testCase.nextCommand() ever changes
            TestCaseDebugContext.prototype.nextCommand= function() {
                LOG.debug( 'SelBlocks nextCommand() starting');
                if (!this.started) {
                  // Hook for SeBootstrap
                  if( this.selenium!==undefined && typeof this.selenium.doReloadScripts=='function' ) {
                      this.selenium.doReloadScripts();
                  }
                }
                else {
                  if( branchIdx!=null ) {
                    LOG.debug("Selblocks branch => " + fmtCmdRef(branchIdx));
                    // Following uses -1 because the original nextCommand() will increase this.debugIndex by 1 when invoked below
                    this.debugIndex = localIdx(branchIdx)-1;
                    
                    testCase= this.testCase= localCase(branchIdx);
                    testCase.debugContext= this;
                    branchIdx = null;
                  }
                }
                LOG.debug( 'SelBlocks Global nextCommand() calling previous definition of nextCommand()');
                return origTestCaseDebugContextNextCommand.call(this);
            };
            /* */
        }
      };
    })();


    // ================================================================================
    // assemble block relationships and symbol locations
    function compileSelBlocks()
    {
      symbols= {}; // Let's clear symbols
      // Currently, this is called multiple times when Se IDE runs the whole test suite
      // - once per each test case. No harm in that, only a bit of wasted CPU.

        //alert( 'testCase===editor.suiteTreeView.getCurrentTestCase(): ' +(testCase===editor.suiteTreeView.getCurrentTestCase()) ); // --> false!
        //alert( 'testCase==editor.getTestCase(): ' +(testCase==editor.getTestCase()) ); //--> true!
      var testCaseOriginal= testCase;
      var testCaseOriginalIndex= -1;
      testCases= [];
      //alert( 'editor.app.getTestSuite()===editor.app.testSuite: ' +editor.app.getTestSuite()===editor.app.testSuite ); // => false
      //alert( 'editor.app.testSuite.tests.indexOf( testCase): ' +editor.app.testSuite.tests.indexOf( testCase) ); // => -1
      for( var testCaseIndex=0; testCaseIndex<editor.app.testSuite.tests.length; testCaseIndex++ ) {

        // Followin call to showTestCaseFromSuite() sets gobal variable testCase
        editor.app.showTestCaseFromSuite( editor.app.getTestSuite().tests[testCaseIndex] );
        var curCase= editor.getTestCase();
        if( curCase===testCaseOriginal ) {
            testCaseOriginalIndex= testCaseIndex;
        }
        assert( curCase.debugContext && curCase.debugContext.currentCommand, 'curCase.debugContext.currentCommand not present!' );
        testCases.push( curCase );

        //@TODO switch testCase here && Keep the case list!

            /*var msg='testCase ' +testCaseIndex+ ": \n";
            for( var i in editor.app.testSuite.tests[testCaseIndex] ) {
                msg+= i+ ': ' +editor.app.testSuite.tests[testCaseIndex][i]+ "\n";
            }
            alert( msg);*/
        var lexStack = new Stack(); // local per testCase, so we don't mix up structural errors between test cases

        for (var i = 0; i < curCase.commands.length; i++)
        {
          if( curCase.commands[i].type=="command" )
          {
            var curCmd = curCase.commands[i].command;
            var aw = curCmd.indexOf("AndWait");
            if (aw != -1) {
              // just ignore the suffix for now, this may or may not be a Selblocks commands
              curCmd = curCmd.substring(0, aw);
            }
            var cmdTarget = curCase.commands[i].target;
            //alert( 'globIdx ha');
            var cmdIdx= globIdx(i, curCase);

            switch(curCmd)
            {
              case "label":
                assertNotAndWaitSuffix(cmdIdx);
                symbols[ labelIdx(cmdTarget, curCase) ] = cmdIdx;
                break;
              case "goto": case "gotoIf": case "skipNext":
                assertNotAndWaitSuffix(cmdIdx);
                break;

              case "if":
                assertNotAndWaitSuffix(cmdIdx);
                lexStack.push(cmdAttrs.init(cmdIdx));
                break;
              case "else":
                assertNotAndWaitSuffix(cmdIdx);
                assertBlockIsPending("if", cmdIdx, lexStack, ", is not valid outside of an if/endIf block");
                var ifAttrs = lexStack.top();
                assertMatching(ifAttrs.cmdName, "if", cmdIdx, ifAttrs.idx);
                cmdAttrs.init(cmdIdx, { ifIdx: ifAttrs.idx }); // else -> if
                cmdAttrs[ifAttrs.idx].elseIdx = cmdIdx;        // if -> else
                break;
              case "endIf":
                assertNotAndWaitSuffix(cmdIdx);
                assertBlockIsPending("if", cmdIdx, lexStack);
                var ifAttrs = lexStack.pop();
                assertMatching(ifAttrs.cmdName, "if", cmdIdx, ifAttrs.idx);
                cmdAttrs.init(cmdIdx, { ifIdx: ifAttrs.idx }); // endIf -> if
                cmdAttrs[ifAttrs.idx].endIdx = cmdIdx;         // if -> endif
                if (ifAttrs.elseIdx)
                  cmdAttrs[ifAttrs.elseIdx].endIdx = cmdIdx;   // else -> endif
                break;

              case "while":    case "for":    case "foreach":    case "forXml":
                assertNotAndWaitSuffix(cmdIdx);
                lexStack.push(cmdAttrs.init(cmdIdx, { blockNature: "loop" }));
                break;
              case "continue": case "breakLoop":
                assertNotAndWaitSuffix(cmdIdx);
                assertCmd(cmdIdx, lexStack.find(Stack.isLoopBlock), ", is not valid outside of a loop");
                cmdAttrs.init(cmdIdx, { hdrIdx: lexStack.top().idx }); // -> header
                break;
              case "endWhile": case "endFor": case "endForeach": case "endForXml":
                assertNotAndWaitSuffix(cmdIdx);
                var expectedCmd = curCmd.substr(3).toLowerCase();
                assertBlockIsPending(expectedCmd, cmdIdx, lexStack);
                var hdrAttrs = lexStack.pop();
                assertMatching(hdrAttrs.cmdName.toLowerCase(), expectedCmd, cmdIdx, hdrAttrs.idx);
                cmdAttrs[hdrAttrs.idx].ftrIdx = cmdIdx;          // header -> footer
                cmdAttrs.init(cmdIdx, { hdrIdx: hdrAttrs.idx }); // footer -> header
                break;

              case "loadVars":
                assertNotAndWaitSuffix(cmdIdx);
                break;

              case "call":
                assertNotAndWaitSuffix(cmdIdx);
                cmdAttrs.init(cmdIdx);
                break;
              case "function":
                assertNotAndWaitSuffix(cmdIdx);
                symbols[cmdTarget] = cmdIdx;
                lexStack.push(cmdAttrs.init(cmdIdx, { name: cmdTarget }));
                break;
              case "return":
                assertNotAndWaitSuffix(cmdIdx);
                assertBlockIsPending("function", cmdIdx, lexStack, ", is not valid outside of a function/endFunction block");
                var scrpt = lexStack.find(function(attrs) { return (attrs.cmdName == "function"); });
                cmdAttrs.init(cmdIdx, { functionIdx: scrpt.idx });    // return -> function
                break;
              case "endFunction":
                assertNotAndWaitSuffix(cmdIdx);
                assertBlockIsPending("function", cmdIdx, lexStack);
                var scrAttrs = lexStack.pop();
                assertMatching(scrAttrs.cmdName, "function", cmdIdx, scrAttrs.idx);
                if (cmdTarget)
                  assertMatching(scrAttrs.name, cmdTarget, cmdIdx, scrAttrs.idx); // match-up on function name
                cmdAttrs[scrAttrs.idx].endIdx = cmdIdx;          // function -> endFunction
                cmdAttrs.init(cmdIdx, { functionIdx: scrAttrs.idx }); // endFunction -> function
                break;
              default:
            }
          }
        }
        while (!lexStack.isEmpty()) {
          // unterminated block(s)
          var pend = lexStack.pop();
          var expectedCmd = "end" + pend.cmdName.substr(0, 1).toUpperCase() + pend.cmdName.substr(1);
          throw new Error(fmtCmdRef(pend.idx) + ", without a terminating [" + expectedCmd + "]");
        }
      }
      assert( testCaseOriginalIndex>=0, "testCaseOriginalIndex mut be non-negative!")
      editor.app.showTestCaseFromSuite( editor.app.getTestSuite().tests[testCaseOriginalIndex] );
      testCase= testCaseOriginal;
      testCase.debugContext.testCase= testCase;
    }

    //@TODO check - moved the following functions out of the loop
        //- command-pairing validation
        function assertBlockIsPending(expectedCmd, cmdIdx, lexStack, desc) {
          assertCmd(cmdIdx, !lexStack.isEmpty(), desc || ", without an beginning [" + expectedCmd + "]");
        }
        //- command validation
        function assertNotAndWaitSuffix(cmdIdx) {
          var test= localCase(cmdIdx);
          var commandIdx= localIdx(cmdIdx);
          assertCmd(cmdIdx, (test.commands[commandIdx].command.indexOf("AndWait") == -1),
            ", AndWait suffix is not valid for Selblocks commands");
        }
        function assertMatching(curCmd, expectedCmd, cmdIdx, pendIdx) {
          assertCmd(cmdIdx, curCmd == expectedCmd, ", does not match command " + fmtCmdRef(pendIdx));
        }

    // ==================== commands ====================

    var commandNames = [];

    Selenium.prototype.doLabel = function() {
      // NOOP
    };
    commandNames.push("label");
    
    var expandStoredVarsRegex= /\$(\w[a-zA-Z_0-9]*)/g;
    /** @param {string} expression
     *  @return {string} expression, with any $xyz replaced by storedVars.xyz
     * */
    function expandStoredVars( expression ) {
        return expression.replace( expandStoredVarsRegex, 'storedVars.$1' );
    }
    
    // skip the next N commands (default is 1)
    Selenium.prototype.doSkipNext = function(amount)
    {
      assertRunning();
      var n = parseInt(this.evalWithExpandedStoredVars(amount), 10);
      if (isNaN(n))
        n = 1;
      if (n != 0) {// if n=0, execute the next command as usual
          //alert( 'globIdx gu');
        setNextCommand( globIdx(testCase.debugContext.debugIndex+n+1) );
      }
    };

    Selenium.prototype.doGoto = function(label)
    {
      assertRunning();
      var symbol_index= labelIdx(label);
      assert( symbols[symbol_index], " Target label '" + label + "' is not found.");
      setNextCommand( symbols[symbol_index] ); // goto only works outside of functions, so no global index here
    };

    Selenium.prototype.doGotoIf = function(condExpr, label)
    {
      assertRunning();
      if (this.evalWithExpandedStoredVars(condExpr))
        this.doGoto(label);
    };

    // ================================================================================
    Selenium.prototype.doIf = function(condExpr, locator)
    {
      assertRunning();
      var ifState = { idx: hereGlobIdx() };
      callStack.top().cmdStack.push(ifState);
      if (this.evalWithExpandedStoredVars(condExpr)) {
        ifState.skipElseBlock = true;
        // fall through into if-block
      }
      else {
        // jump to else or endif
        var ifAttrs = cmdAttrs.here();
        if (ifAttrs.elseIdx)
          setNextCommand(ifAttrs.elseIdx);
        else
          setNextCommand(ifAttrs.endIdx);
      }
    };
    Selenium.prototype.doElse = function()
    {
      assertRunning();
      assertActiveCmd(cmdAttrs.here().ifIdx);
      var ifState = callStack.top().cmdStack.top();
      if( ifState.skipElseBlock ) {
        setNextCommand( cmdAttrs.here().endIdx );
      }
    };
    Selenium.prototype.doEndIf = function() {
      assertRunning();
      assertActiveCmd(cmdAttrs.here().ifIdx);
      callStack.top().cmdStack.pop();
      // fall out of loop
    };

    // ================================================================================
    Selenium.prototype.doWhile = function(condExpr)
    {
      var self= this;
      enterLoop(
        function() {    // validate
            assert(condExpr, " 'while' requires a condition expression.");
            return null;
        }
        ,function() { } // initialize
        ,function() { return (self.evalWithExpandedStoredVars(condExpr)); } // continue?
        ,function() { } // iterate
      );
    };
    Selenium.prototype.doEndWhile = function() {
      iterateLoop();
    };

    // ================================================================================
    Selenium.prototype.doFor = function(forSpec, localVarsSpec)
    {
      var self= this;
      enterLoop(
        function(loop) { // validate
            assert(forSpec, " 'for' requires: <initial-val>; <condition>; <iter-stmt>.");
            var specs = forSpec.split(";"); // TBD: parsing can fail on complex expressions containing ;s
            assert(specs.length == 3, " 'for' requires <init-stmt>; <condition>; <iter-stmt>.");
            loop.initStmt = specs[0];
            loop.condExpr = specs[1];
            loop.iterStmt = specs[2];
            var localVarNames = [];
            if (localVarsSpec) localVarNames = localVarsSpec.split(",");
            return localVarNames;
        }
        ,function(loop) { self.evalWithExpandedStoredVars(loop.initStmt); }          // initialize
        ,function(loop) { return (this.evalWithExpandedStoredVars(loop.condExpr)); } // continue?
        ,function(loop) { self.evalWithExpandedStoredVars(loop.iterStmt); }          // iterate
      );
    };
    Selenium.prototype.doEndFor = function() {
      iterateLoop();
    };

    // ================================================================================
    Selenium.prototype.doForeach = function(varName, valueExpr)
    {
      var self= this;
      enterLoop(
        function(loop) { // validate
            assert(varName, " 'foreach' requires a variable name.");
            assert(valueExpr, " 'foreach' requires comma-separated values.");
            loop.values = self.evalWithExpandedStoredVars("[" + valueExpr + "]");
            if (loop.values.length == 1 && Array.isArray(loop.values[0]) ) {
              loop.values = loop.values[0]; // if sole element is an array, than use it
            }
            return [varName, "_i"];
        }
        ,function(loop) { loop.i = 0; storedVars[varName] = loop.values[loop.i]; }       // initialize
        ,function(loop) { storedVars._i = loop.i; return (loop.i < loop.values.length);} // continue?
        ,function(loop) { // iterate
            if (++(loop.i) < loop.values.length)
              storedVars[varName] = loop.values[loop.i];
        }
      );
    };
    Selenium.prototype.doEndForeach = function() {
      iterateLoop();
    };

    // ================================================================================
    Selenium.prototype.doLoadVars = function(xmlfile, selector)
    {
      assert(xmlfile, " 'loadVars' requires an xml file path or URI.");
      var xmlReader = new XmlReader(xmlfile);
      xmlReader.load(xmlfile);
      xmlReader.next(); // read first <vars> and set values on storedVars
      if (!selector && !xmlReader.EOF()) {
        notifyFatal("Multiple var sets not valid for 'loadVars'. (A specific var set can be selected: name=value.)");
      }
      var result = this.evalWithExpandedStoredVars(selector);
      if (typeof result !=="boolean") {
        LOG.warn(fmtCmdRef(hereGlobIdx()) + ", " + selector + " is not a boolean expression");
      }

      // read until specified set found
      var isEof = xmlReader.EOF();
      while (!isEof && this.evalWithExpandedStoredVars(selector) != true) {
        xmlReader.next(); // read next <vars> and set values on storedVars
        isEof = xmlReader.EOF();
      }

      if (!this.evalWithExpandedStoredVars(selector))
        notifyFatal("<vars> element not found for selector expression: " + selector
          + "; in xmlfile " + xmlReader.xmlFilepath);
    };

    // ================================================================================
    Selenium.prototype.doForXml = function(xmlpath)
    {
      enterLoop(
        function(loop) {  // validate
            assert(xmlpath, " 'forXml' requires an xml file path or URI.");
            loop.xmlReader = new XmlReader();
            var localVarNames = loop.xmlReader.load(xmlpath);
            return localVarNames;
        }
        ,function() { }   // initialize
        ,function(loop) { // continue?
            var isEof = loop.xmlReader.EOF();
            if (!isEof) loop.xmlReader.next();
            return !isEof;
        }
        ,function() { }
      );
    };
    Selenium.prototype.doEndForXml = function() {
      iterateLoop();
    };

    // --------------------------------------------------------------------------------
    // Note: Selenium variable expansion occurs before command processing, therefore we re-execute
    // commands that *may* contain ${} variables. Bottom line, we can't just keep a copy
    // of parameters and then iterate back to the first command inside the body of a loop.

    function enterLoop(_validateFunc, _initFunc, _condFunc, _iterFunc)
    {
      assertRunning();
      var loopState;
      if (!callStack.top().cmdStack.isHere()) {
        // loop begins
        loopState = { idx: hereGlobIdx() };
        callStack.top().cmdStack.push(loopState);
        var localVars = _validateFunc(loopState);
        loopState.savedVars = getVarState(localVars);
        initVarState(localVars); // because with-scope can reference storedVars only once they exist
        _initFunc(loopState);
      }
      else {
        // iteration
        loopState = callStack.top().cmdStack.top();
        _iterFunc(loopState);
      }

      if (!_condFunc(loopState)) {
        loopState.isComplete = true;
        // jump to bottom of loop for exit
        setNextCommand(cmdAttrs.here().ftrIdx);
      }
      // else continue into body of loop
    }
    function iterateLoop()
    {
      assertRunning();
      assertActiveCmd(cmdAttrs.here().hdrIdx);
      var loopState = callStack.top().cmdStack.top();
      if (loopState.isComplete) {
        restoreVarState(loopState.savedVars);
        callStack.top().cmdStack.pop();
        // done, fall out of loop
      }
      else {
        // jump back to top of loop
        setNextCommand(cmdAttrs.here().hdrIdx);
      }
    }

    // ================================================================================
    Selenium.prototype.doContinue = function(condExpr) {
      var loopState = this.dropToLoop(condExpr);
      if (loopState) {
        // jump back to top of loop for next iteration, if any
        var ftrCmd = cmdAttrs[loopState.idx];
        setNextCommand( cmdAttrs[ftrCmd.ftrIdx].hdrIdx );
      }
    };

    // This is what original SelBlocks had for doBreak(). That was in conflict with Selenium's doBreak() (which stops the test).
    // I could make doBreak() do either job, depending on the context - i.e. within a loop it would break the loop, otherwise
    // it would stop the test. However, it would make tests unclear, there's no real need for it and it wasn't feasible anyway.
    Selenium.prototype.doBreakLoop = function(condExpr) {
      var loopState = this.dropToLoop(condExpr);
      if (loopState) {
        loopState.isComplete = true;
        // jump to bottom of loop for exit
        setNextCommand( cmdAttrs[loopState.idx].ftrIdx );
      }
    };

    // unwind the command stack to the inner-most active loop block
    // (unless the optional condition evaluates to false)
    // @TODO check that it only unwinds within the current function, if any
    Selenium.prototype.dropToLoop= function(condExpr)
    {
      assertRunning();
      if (condExpr && !this.evalWithExpandedStoredVars(condExpr))
        return;
      var activeCmdStack = callStack.top().cmdStack;
      var loopState = activeCmdStack.unwindTo(Stack.isLoopBlock);
      return loopState;
    };


    // ================================================================================
    Selenium.prototype.doCall = function(scrName, argSpec)
    {
      var loop = currentTest || htmlTestRunner.currentTest; // See Selenium.prototype.doRollup()
      assertRunning(); // TBD: can we do single execution, ie, run from this point then break on return?
      var functionIdx = symbols[scrName];
      assert( functionIdx, " Function does not exist: " + scrName + "." );

      var callAttrs = cmdAttrs.here();
      var callFrame = callStack.top();
      if( callFrame.isReturning && callFrame.returnIdx==hereGlobIdx() ) {
        //console.error( 'doCall returning\n ' +SeLiteMisc.stack() );
        // returning from completed function
        var popped= callStack.pop();
        loop.commandError= popped.originalCommandError;
        restoreVarState( popped.savedVars );
        assert( testCase==popped.testCase, "The popped testCase is different." ); // Not sure why, but this seems to be true.
      }
      else {
        //  console.error( 'doCall calling\n ' +SeLiteMisc.stack() );
        // Support $stored-variablename, just like string{} and getQs, storeQs...
        argSpec= expandStoredVars(argSpec);
        // save existing variable state and set args as local variables
        var args = this.parseArgs(argSpec);
        var savedVars = getVarStateFor(args);
        setVars(args);

        var originalCommandError= loop.commandError;
        // There can be several cascading layers of these calls - one per function call level.
        loop.commandError= function( result ) {
            //console.error( 'doCall: commandError(). editor: ' +(typeof editor)+ '\n ' +SeLiteMisc.stack() );
            var popped= callStack.pop();
            this.commandError= popped.originalCommandError;
            restoreVarState( popped.savedVars );
            //debugger;
            testCase= popped.testCase;
            testCase.debugContext.testCase= testCase;
            editor.selDebugger.pause();
            //selenium.reset(); // This doesn't help
            
            originalCommandError.call( this, result ); // I've restored this.commandError *before* calling originalCommandError(), because if this was a deeper function call then originalCommandError() will restore any previous version of this.commandError, and I don't want to step on its feet here
            //@TODO setNextCommand(??)??
        };
        
        callStack.push( {
            functionIdx: functionIdx,
            name: scrName,
            args: args,
            returnIdx: hereGlobIdx(),
            savedVars: savedVars,
            cmdStack: new Stack(),
            testCase: testCase,
            originalCommandError: originalCommandError
        });
        // jump to function body
        setNextCommand(functionIdx);
      }
    };
    Selenium.prototype.doFunction = function(scrName)
    {
      assertRunning();
      var loop = currentTest || htmlTestRunner.currentTest;
      //LOG.error( 'doFunction: loop.commandError: ' +loop.commandError.toSource() );
      var scrAttrs = cmdAttrs.here();
      var callFrame = callStack.top();
      if( callFrame.functionIdx==hereGlobIdx() ) {
        // get parameter values
        setVars(callFrame.args);
      }
      else {
        // no active call, skip around function body
        setNextCommand(scrAttrs.endIdx);
      }
    };
    Selenium.prototype.doReturn = function(value) {
      this.returnFromFunction(value);
    };
    Selenium.prototype.doEndFunction = function() {
      this.returnFromFunction();
    };

    Selenium.prototype.returnFromFunction= function(returnVal)
    {
      assertRunning();
      var endAttrs = cmdAttrs.here();
      var callFrame = callStack.top();
      if( callFrame.functionIdx==endAttrs.functionIdx ) {
        if( returnVal ) {
            storedVars._result = this.evalWithExpandedStoredVars(returnVal);
        }
        callFrame.isReturning = true;
        // jump back to call command
        setNextCommand(callFrame.returnIdx);
      }
      else {
        // no active call, we're skipping around a function block
      }
    };


    // ========= storedVars management =========

    Selenium.prototype.evalWithExpandedStoredVars= function(expr) {
      try {
        typeof expr==='string' || expr===undefined || SeLiteMisc.fail( 'expr must be a string or undefined' );
        var expanded= expr!==undefined
            ? expandStoredVars(expr)
            : undefined;
        LOG.debug( 'Selenium.prototype.evalWithExpandedStoredVars(): ' +expr+ ' expanded to: ' +expanded );
        var window = this.browserbot.getCurrentWindow();
        // Firefox eval() doesn't return values of some expression strings, including
        // '{field: "value"}' and 'return {field: "value"}'. That's why I assign to local variable 'evalWithExpandedStoredVarsResult' first, and then I return it.
        // EXTENSION REVIEWERS: Use of eval is consistent with the Selenium extension itself.
        // Scripted expressions run in the Selenium window, separate from browser windows.
        var result = eval( "var evalWithExpandedStoredVarsResult= " +expanded+ "; evalWithExpandedStoredVarsResult" );
        LOG.debug( 'result: ' +typeof result+ ': ' +SeLiteMisc.objectToString(result, 2) );
        return result;
      }
      catch (err) {
        notifyFatalErr(" While evaluating Javascript expression: " + expr+ " expanded as " +expanded, err);
      }
    };
    
    // This is not related to parseArgs(str) in chrome/content/selenium-core/test/RemoteRunnerTest.js
    Selenium.prototype.parseArgs= function(argSpec) { // comma-sep -> new prop-set
      var args = {};
      /* @TODO check & document whether I need to care about string{} here. Maybe just don't support string{...} for 'call' command. $variableName should work for 'call' without using string{...}. 'call' works with string{..}, but it's not recommended for now.
      
      @TODO See preprocessParameter() in this file.
        
      // Split argSpec if it is in format fieldA=valueA,fieldB=..string{...},fieldC=..string{..},..
      // This regex allows parameter values within string{..} to contain commas or assignment =.
      // The values within string{...} can't contain curly brackets { and }.
      // @TODO Also support commas within '' or ""? But for now using string{} is a workaround.

      // This regex is optimistic - assuming that argSpec is well-formed
      var spacedRegex= /=\s*([^q][^,]*|string{{[^}]*)\}?\s*,?/;
      var regex= new RegExp( spacedRegex.source.replace( / /g, '') );

      var parms= argSpec.split( regex );
      // The last item in parms[] is an odd empty string, which I ignore
      for( var i = 0; i < parms.length-1; i+=2 ) {
        var key= parms[i].trim();
        var value = parms[i+1];
        if( value.substr(0, 7)==='string{' ) {
            value= value.substr( 7 );
        }
        if( typeof value !=='string' ) {
            // @TODO Log an error instead of an alert:
            alert( 'param ' +key+ ' has value (to evaluate): ' +value+ ' with constructor ' +value.constructor.name );
            // For some reason, LOG.debug() doesn't work here.
        }
        args[ key ] = this.evalWithExpandedStoredVars( value ); // This would fail, since parseArgs() is not a member of Selenium.prototype
      }
      return args;/**/
      // original from SelBlocks:
      var parms = argSpec.split(",");
      for (var i = 0; i < parms.length; i++) {
        var keyValue = parms[i].split("=");
        args[ keyValue[0].trim() ] = this.evalWithExpandedStoredVars(keyValue[1]);
      }
      return args;/**/
    };
    
    function initVarState(names) { // new -> storedVars(names)
      if (names) {
        for (var i = 0; i < names.length; i++) {
          if (!storedVars[names[i]])
            storedVars[names[i]] = null;
        }
      }
    }
    function getVarStateFor(args) { // storedVars(prop-set) -> new prop-set
      var savedVars = {};
      for (var varname in args) {
        savedVars[varname] = storedVars[varname];
      }
      return savedVars;
    }
    function getVarState(names) { // storedVars(names) -> new prop-set
      var savedVars = {};
      if (names) {
        for (var i = 0; i < names.length; i++) {
          savedVars[names[i]] = storedVars[names[i]];
        }
      }
      return savedVars;
    }
    function setVars(args) { // prop-set -> storedVars
      for (var varname in args) {
        storedVars[varname] = args[varname];
      }
    }
    function restoreVarState(savedVars) { // prop-set --> storedVars
      for (var varname in savedVars) {
        if (savedVars[varname] == undefined)
          delete storedVars[varname];
        else
          storedVars[varname] = savedVars[varname];
      }
    }

    // ========= error handling =========

    // TBD: make into throwable Errors
    function notifyFatalErr(msg, err) {
      LOG.error("SelBlocks error " + msg);
      throw new Error(err);
    }
    function notifyFatal(msg) {
      LOG.error("SelBlocks error " + msg);
      throw new Error(msg);
    }
    function notifyFatalCmdRef(idx, msg) { notifyFatal( fmtCmdRef(idx) +msg ); }
    function notifyFatalHere(msg) {
        // This may be called before testCase is set
        var commandRef= testCase===undefined
            ? 'unknown step: '
            : fmtCmdRef(hereGlobIdx())+ ': ';
        notifyFatal( commandRef+msg );
    }

    function assertCmd(idx, cond, msg) { if (!cond) notifyFatalCmdRef(idx, msg); }
    function assert(cond, msg) { if (!cond) notifyFatalHere(msg); }
    // TBD: can we at least show result of expressions?
    function assertRunning() {
      assert(testCase.debugContext.started, " Command is only valid in a running function.");
    }
    function assertActiveCmd(expectedIdx) {
      var activeIdx = callStack.top().cmdStack.top().idx;
      assert(activeIdx == expectedIdx, " unexpected command, active command was " + fmtCmdRef(activeIdx))
    }

    function fmtCmdRef(cmdIdx) {
      var test= localCase(cmdIdx);
      var commandIdx= localIdx(cmdIdx);

      return ("@" +test.filename+ ': ' +(commandIdx+1) + ": " + fmtCommand(test.commands[commandIdx]));
    }
    function fmtCommand(cmd) {
      var c = cmd.command;
      if (cmd.target) c += "|" + cmd.target
      if (cmd.value)  c += "|" + cmd.value
      return '[' + c + ']';
    }

    // ==================== Data Files ====================

    function XmlReader()
    {
      var xmlDoc = null;
      var varNodes = null;
      var curVars = null;
      this.xmlFilepath = null;
      var varsElementIdx = 0;

      this.load = function(xmlpath) {
        loader = new FileReader();
        this.xmlFilepath = uriFor(xmlpath);
        var xmlHttpReq = loader.getIncludeDocumentBySynchronRequest(this.xmlFilepath);
        LOG.info("Reading from: " + this.xmlFilepath);
        xmlDoc = xmlHttpReq.responseXML; // XMLDocument

        varNodes = xmlDoc.getElementsByTagName("vars"); // HTMLCollection

        if (varNodes == null || varNodes.length == 0) {
          throw new Error("A <vars> element could not be loaded, or <testdata> was empty.");
        }

        curVars = 0;
        // get variable names from first entity
        var varnames = [];
        retrieveVarset(0, varnames);
        return varnames;
      }

      this.EOF = function() {
        return (curVars == null || curVars >= varNodes.length);
      };

      this.next = function() {
        if (this.EOF()) {
          LOG.error("No more <vars> elements to read after element #" + varsElementIdx);
          return;
        }
        varsElementIdx++;
        LOG.debug(XML.serialize(varNodes[curVars]));	// log each name & value

        var expected = varNodes[0].attributes.length;
        var found = varNodes[curVars].attributes.length;
        if (found != expected) {
          throw new Error("Inconsistent <testdata> at <vars> element #" + varsElementIdx
            + "; expected " + expected + " attributes, but found " + found + "."
            + " Each <vars> element must have the same set of attributes."
          );
        }
        retrieveVarset(curVars, storedVars);
        curVars++;
      };

      //- retrieve a varset row into the given object, if an Array return names only
      function retrieveVarset(vs, resultObj) {
        var varAttrs = varNodes[vs].attributes; // NamedNodeMap
        for (v = 0; v < varAttrs.length; v++) {
          var attr = varAttrs[v];
          if (null == varNodes[0].getAttribute(attr.nodeName)) {
            throw new Error("Inconsistent <testdata> at <vars> element #" + varsElementIdx
              + "; found attribute " + attr.nodeName + ", which does not appear in the first <vars> element."
              + " Each <vars> element must have the same set of attributes."
            );
          }
          if ( Array.isArray(resultObj) )
            resultObj.push(varAttrs[v].nodeName);
          else
            resultObj[attr.nodeName] = attr.nodeValue;
        }
      }
    }

    /* //This stopped working somewhere after Firefox 19.0.2 and before/in Firefox 20.0.1.
     *  //@TODO Either investigate, or remove this.
     * XML.serialize = function(node) {
      if (typeof XMLSerializer != "undefined")
        return (new XMLSerializer()).serializeToString(node) ;
      else if (node.xml) return node.xml;
      else throw "XML.serialize is not supported or can't serialize " + node;
    }*/


    // ==================== File Reader ====================

    function uriFor(filepath) {
      var URI_PFX = "file://";
      var uri = filepath;
      if (filepath.substring(0, URI_PFX.length).toLowerCase() != URI_PFX) {
        testCasePath = testCase.file.path.replace("\\", "/", "g");
        var i = testCasePath.lastIndexOf("/");
        uri = URI_PFX + testCasePath.substr(0, i) + "/" + filepath;
      }
      return uri;
    }

    function FileReader() {}

    FileReader.prototype.getIncludeDocumentBySynchronRequest = function(includeUrl) {
        var url = this.prepareUrl(includeUrl);
        // the xml http requester to fetch the page to include
        var requester = this.newXMLHttpRequest();
        if (!requester) {
            throw new Error("XMLHttp requester object not initialized");
        }
        requester.open("GET", url, false); // synchron mode ! (we don't want selenium to go ahead)
        try {
            requester.send(null);
        } catch(e) {
          throw new Error("Error while fetching url '" + url + "' details: " + e);
        }
        if ( requester.status != 200 && requester.status !== 0 ) {
            throw new Error("Error while fetching " + url + " server response has status = " + requester.status + ", " + requester.statusText );
        }
        return requester;
    };

    FileReader.prototype.prepareUrl = function(includeUrl) {
        var prepareUrl;
        // htmlSuite mode of SRC? TODO is there a better way to decide whether in SRC mode?
        if (window.location.href.indexOf("selenium-server") >= 0) {
            LOG.debug(FileReader.LOG_PREFIX + "we seem to run in SRC, do we?");
            preparedUrl = absolutify(includeUrl, htmlTestRunner.controlPanel.getTestSuiteName());
        } else {
            preparedUrl = absolutify(includeUrl, selenium.browserbot.baseUrl);
        }
        LOG.debug(FileReader.LOG_PREFIX + "using url to get include '" + preparedUrl + "'");
        return preparedUrl;
    };

    FileReader.prototype.newXMLHttpRequest = function() {
        var requester = 0;
        var exception = '';
        try {
            // for IE/ActiveX
            if(window.ActiveXObject) {
                try {
                    requester = new ActiveXObject("Msxml2.XMLHTTP");
                }
                catch(e) {
                    requester = new ActiveXObject("Microsoft.XMLHTTP");
                }
            }
            // Native XMLHttp
            else if(window.XMLHttpRequest) {
                requester = new XMLHttpRequest();
            }
        }
        catch(e) {
            throw new Error("Your browser has to support XMLHttpRequest in order to use include \n" + e);
        }
        return requester;
    };

}());

(function() {
    var originalPreprocessParameter= Selenium.prototype.preprocessParameter;
    // This sets a head intercept of chrome/content/selenium-core/scripts/selenium-api.js
    // This adds support for
    // - quick object notation using object{ field: value... } - that can't be mixed with anything else in the value,
    // it must be the only content passed as a value of a Se IDE command parameter
    // - 'Quick Stored' - string{javascript-expression-here with $stored-var-name support}
    // and any-prefixstring{expression}postfix (including variations with empty prefix/postfix: any-prefixstring{expression} or string{expression}postfix or string{expression}).
    // Prefix and Postfix must not contain characters { and }. Prefix must not contain character = so that we
    // can use string{} in parameter values for SelBlocks' action call (string{} in a parameter value there doesn't allow any prefix/postfix).
    Selenium.prototype.preprocessParameter = function(value) {
        // @TODO @TODO @TODO Do we need string{..} at all? Standard Se preprocessParameter() supports multiple ${...} for stored vars.
        // string{} was intended only so that there can be prefix and/or postfix around it: prefix... string{expression} postfix...
        // But that can be accomplished with javascript{ 'prefix...' +(expression)+ 'postfix...' }
        // But javascript{..} doesn't replace ${variableName}.
        // Either way, replacing stored variables within Javascript statements/selectors using ${...}
        // may confuse users, if the variable has a string value, because ${...} gets replaced by the value of the variable
        // - they would need to put apostrophes around it (for XPath), or quotes/apostrophes around it (for Javascript).
        // Selenese ${variableName} requires {}, which is good because it separates it from the rest of the target/value,
        // so it's robust yet easy to use.
        // string{ ... $xxx ... } replaces $xxx by the symbol/reference to the stored variable, so its typed and it doesn't need to be quote
        // (unless you're passing it to XPath).
        // 
        // string{ ... ${...} .... } doesn't work. No sure there's a need for it. If it worked substitituing as in other Selenese,
        // it could involve unexpected errors if ${variableName} were a number and later it would become a non-numeric string
        // and if there were no quotes/apostrophes around it.
        
        /** string{} - evaluate the expression and cast it as a string. Access stored variables using $xyz. If the stored
            variable is an object/array, you can access its fields - i.e. $object-var-name.fieldXYZ or $array-var-name[index].
           string{} transforms the evaluated result into a string. This way we can use it with standard Se actions
           click/select/type, even if the evaluated value is a number.
           That limits the usage of string{}: you normally don't want string{} to yield an object/array. For such cases use object{...} or array[...]. E.g. passing an
             object as the second parameter to 'typeRandom' action (function doTypeRandom).
        */
        LOG.debug('SelBlocksGlobal tail override of preprocessParameter(): ' +value );
        // Match object{..} and evaluate as a definition of anonymous Javascript object. Replace $... parts with respective stored variables. There can be no prefix or postfix before/after eval{ and }.
        var match= value.match( /^\s*object(\{(.|\r?\n)+\})\s*$/ );
        if( match ) {
            return this.evalWithExpandedStoredVars( match[1] );
        }
        // Match array[...] and evaluate it as an array of Javascript expressions. Replace $... parts with respective stored variables. There can be no prefix or postfix before/after eval{ and }.
        var match= value.match( /^\s*array(\[(.|\r?\n)+\])\s*$/ );
        if( match ) {
            return this.evalWithExpandedStoredVars( match[1] );
        }
        // Match eval{...} and evaluate it as a Javascript expression. Replace $... parts with respective stored variables. There can be no prefix or postfix before/after eval{ and }.
        var match= value.match( /^\s*eval\{((.|\r?\n)+)\}\s*$/ );
        if( match ) {
            return this.evalWithExpandedStoredVars( match[1] );
        }
        // Match ...string{...}....  Evaluate it as a string with an optional prefix and postfix, replace $... part(s) with respective stored variables.
        // Spaces in the following regex are here only to make it more readable; they get removed.
        var spacedRegex= /^ ( ((?!string\{).)* )  string\{((.|\r?\n)+)\}  (([^}])*)$/;
        var regex= new RegExp( spacedRegex.source.replace( / /g, '') );
        match = value.match( regex );
        if( match ) {
            var prefix= match[1];
            var mainPart= match[3];
            var postfix= match[5];
            LOG.debug( 'string{}: ' +
                (prefix!=='' ? 'prefix: '+prefix+', ' : '')+
                'mainPart: ' +mainPart+
                (postfix!=='' ? ', postfix: '+postfix : '')
            );
            var evalResult= this.evalWithExpandedStoredVars( mainPart );

            if( evalResult!==null && evalResult!==undefined ) {
                evalResult= '' +evalResult;
            }
            else {
                evalResult= this.robustNullToken;//@TODO selite-misc-ide as a separate extension, or as a part of SelBlocks Global
            }
            LOG.debug( '...string{}... transformed to: ' +prefix+evalResult+postfix);
            return prefix+evalResult+postfix;
        }
        return originalPreprocessParameter.call( this, value );
    };
})();
