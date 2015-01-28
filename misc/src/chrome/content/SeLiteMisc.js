/*  Copyright 2011, 2012, 2013, 2014 Peter Kehl
    This file is part of SeLite Misc.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

/*var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol=='chrome:');
// runningAsComponent is false when loaded via <script src="file://..."> or <script src="http://..."> rather than via Components.utils.import().
// Used for debugging; limited (because when it's not loaded via Components.utils.import() it can't access other components).
if( runningAsComponent ) {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
}/**/

var SeLiteMisc= {};

/** This throws the given error or a new error (containg the given message, if any). It also appends the stack trace to the message, which is useful since both Firefox Browser Console and Selenium IDE log don't report error stack trace. I do not log here to Browser Console, since that would polute logs when doing negative testing - when using try/catch to validate that incorrect invocation of functionality calls SeLiteMisc.fail().
 *  @param {*} [errorOrMessage] An underlying Error, or a message for a new error.
 *  @param {boolean} [excludeCommonBase] See the same parameter of SeLiteMisc.addStackToMessage().
 *  @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
 *  - as it mentions, the rethrown exception will have incorreect stack information: Note that the thrown MyError will report incorrect lineNumber and fileName at least in Firefox.
 *  and https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FStatements%2Fthrow
*/
SeLiteMisc.fail= function fail( errorOrMessage, excludeCommonBase ) {
    throw SeLiteMisc.addStackToMessage( errorOrMessage, excludeCommonBase );
};

SeLiteMisc.treatError= function treatError( errorOrMessage ) {
    return errorOrMessage!==undefined
        ?(typeof errorOrMessage==='object' &&  errorOrMessage.constructor.name==='Error'
            ? errorOrMessage
            : new Error(errorOrMessage)
         )
        : new Error();
};

/** Add error's stack trace to its message.
 *  @param {Error} error
 *  @param {boolean} [excludeCommonBase] Essentially, this makes it shorten the stack trace by removing parts that come from Firefox code. That makes the stack trace usually more relevant. excludeCommonBase indicates whether to exclude any stack trace (base) that is the same for error's stack and the current stack. This serves to eliminate upper call levels that are of little interest to the end user. If error was already processed by SeLiteMisc.addStackToMessage() with excludeCommonBase==true, then this function doesn't modify error at all (regardless of what excludeCommonBase is now). That previous call (which would normally be at a deeper level) indicated that the shorter stack trace is meaningful, so there is no need to replace it with a longer trace. However, if error was processed by call(s) to SeLiteMisc.addStackToMessage() only with excludeCommonBase being false or undefined, then the first call of SeLiteMisc.addStackToMessage() with excludeCommonBase replaces and shortens the stack trace that is in error.message. This function doesn't modify error.stack itself. 
 *  <br/>If you call this function multiple times (regardless of what <code>excludeCommonBase</code>), any successive call will replace any stack added to the message in the previous call.
 *  @param {Error} error, with a modified message if applicable
 * */
SeLiteMisc.addStackToMessage= function addStackToMessage( error, excludeCommonBase ) {
    error= SeLiteMisc.treatError( error );
    if( !error.originalMessageSavedBySeLiteMisc ) {
        // I make internal fields added to error object non-enumerable, otherwise Selenium IDE shows them in its log.
        Object.defineProperty( error, 'originalMessageSavedBySeLiteMisc', {
          enumerable: false, configurable: false, writable: false,
          value: error.message
        });
    }
    if( !error.messageContainsStackAddedBySeLiteMisc || excludeCommonBase && !error.messageContainsStackWithExcludedCommonBaseBySeLiteMisc ) {
        var stack= '';
        if( excludeCommonBase ) {
            var currentStack;
            try { throw new Error(); }
            catch( e ) { currentStack= e.stack; }
            
            var givenLevels= error.stack.split( '\n' );
            var currentLevels= currentStack.split( '\n' );
            // Error stack starts with the deepest call levels, and ends with the root call. So I iterate from the last to first.
            for( var i=1; i<=givenLevels.length; i++ ) { // variable i is an index starting at 1 into givenLevels[] from its end to the front
                 if( i>currentLevels.length || givenLevels[givenLevels.length-i]!==currentLevels[currentLevels.length-i] ) {
                     break;
                 }
            }
            for( ; i<=givenLevels.length; i++ ) {
                // Concatenate in reverse, so that the result stack section has levels in the same direction as givenLevels[]
                if( stack ) {
                    stack= '\n' + stack;
                }
                stack= givenLevels[givenLevels.length-i] + stack;
            }
            Object.defineProperty( error, 'messageContainsStackWithExcludedCommonBaseBySeLiteMisc', {
              enumerable: false, configurable: false, writable: false,
              value: true
            });
        }
        else {
            stack= error.stack;
        }
        error.message= error.originalMessageSavedBySeLiteMisc+ '\n' +stack;
        Object.defineProperty( error, 'messageContainsStackAddedBySeLiteMisc', {
          enumerable: false, configurable: false, writable: false,
          value: true
        });
    }
    return error;
};

/** This asserts the condition to be true (compared non-strictly). If false, it fails with an error (containg the given message, if any).
 *  It's not called assert(), so that it doesn't conflict with assert() defined by Selenium IDE.
 *  @param bool condition If false, then this fails.
 *  @param string message Optional; see SeLiteMisc.fail(). Note that if you pass a non-constant expression
 *   - e.g. concatenation of strings, a call to a function etc.,
 *  it has to be evaluated before SeLiteMisc.ensure() is called, even if it's not used (i.e. condition is true).
 *  Then you may want to chose to use:
 *  <code>
 *      condition || SeLiteMisc.fail( message expression );
 *  </code>
 *  instead. That evaluates message expression only if condition is not true.
 *  On the other hand, if you have message ready anyway (e.g. a constant string or a value received as a parameter from a caller function),
 *  then by using SeLiteMisc.ensure(..) you make your intention clearer.
 * */
SeLiteMisc.ensure= function ensure( condition, message ) {
    if( !condition ) {
        SeLiteMisc.fail( message );
    }
};

SeLiteMisc.oneOf= function oneOf( item, choices ) {
    Array.isArray(choices) || SeLiteMisc.fail( 'SeLiteMisc.OneOf() expects choices to be an array');
    return choices.indexOf(item)>=0;
};

/** It ensures that item is one of choices.
 * @param {*} item
 * @param {array} choices
 * @param {string} [variableName] If other than undefined/null/false, then it should be name or description of the Javascript parameter that is being validated. If this function throws an error, the message will contain item, choices and variableName.
 * @param {string} [message] Message for the error, if validation fails. Otherwise this generates a message containing item and choices.
 * */
SeLiteMisc.ensureOneOf= function ensureOneOf( item, choices, variableName, message ) {
    SeLiteMisc.oneOf(item, choices) || SeLiteMisc.fail(
        message
        || (variableName
            ? 'Variable ' +variableName+ ' should be one of [' +choices.join(',')+ '], but got ' +item
            : 'Expecting one of [' +choices.join(',')+ '], but got ' +item
            )
    );
};

/** @param {*} [valueOrFunction] Either a non-functional value, or a function that takes no parameters and returns a value. It serves for accepting closures (functions) instead of error messages (or parts of such messages, e.g. variable names/descriptions). That's useful when such a string is not constant and it needs to be generated. In such cases passing a closure (that encapsulates its scope) is more efficient, as that's what the closures are for. (Since we don't store the closure anywhere, there's no problem with scope/memory leaks.)
 *  @return {*} The value, or undefined if none. No other treatment - e.g. if valueOrFunction is a numeric string, this returns it unchanged as a string, not as a number.
 * */
SeLiteMisc.valueOf= function valueOf( valueOrFunction ) {
    return typeof valueOrFunction==='function'
        ? valueOrFunction()
        : valueOrFunction;
};

/** This is exported just for documentation value. Do not modify it.
 * */
SeLiteMisc.TYPE_NAMES= ['number', 'string', 'object', 'function', 'boolean', 'undefined', 'null', 'some-object', 'primitive'];

/** It finds out whether the item's type is one of the given type(s).
 *  @param {*} item
 *  @param {(string|array)} typeStringOrStrings string, one of: 'number', 'string', 'object', 'function', 'boolean', 'undefined' or meta-types 'null', 'some-object' or 'primitive'. 'some-object' stands for a non-null object; 'primitive' stands for number/string/boolean.
 *  @param {(string|function)} [itemName] Name of the item, as it makes sense in the caller's scope (e.g. name of the variable passed as parameter 'item' down here); or a function that returns such a name. Only used for error reporting.
 *  @return {boolean}
 */
SeLiteMisc.hasType= function hasType( item, typeStringOrStrings, itemName ) {
    var typeStringOrStringsWasArray= Array.isArray(typeStringOrStrings);
    if( !typeStringOrStringsWasArray ) {
        if( typeof typeStringOrStrings!=='string' ) {
            SeLiteMisc.fail( (SeLiteMisc.valueOf(itemName) || 'typeStringOrStrings')+ ' must be a string or an array, but it is ' +typeof typeStringOrStrings );
        }
        typeStringOrStrings= [typeStringOrStrings];
    }
    for( var i=0; i<typeStringOrStrings.length; i++ ) {
        SeLiteMisc.ensureOneOf(// Internal validation of each typeStringOrStrings[i] itself
            typeStringOrStrings[i], SeLiteMisc.TYPE_NAMES,
            'typeStringOrStrings'
                +(typeStringOrStringsWasArray
                    ? '[' +i+ ']'
                    : ''
                )
        );
        if( typeof item===typeStringOrStrings[i]
            || typeStringOrStrings[i]==='null' && item===null
            || typeStringOrStrings[i]==='some-object' && typeof item==='object' && item!==null
            || typeStringOrStrings[i]==='primitive' && ['number', 'string', 'boolean'].indexOf(typeof item)>=0
        ) {
            return true;
        }
    }
    return false;
};

/** Validates that typeof item is one of 
 *  @param {*} item
 *  @param {(string|array)} typeStringOrStrings See same parameter of hasType().
 *  @param {(string|function)} [variableName] See same parameter of ensureOneOf(). However, it has to contain a meaningful name/description, even if you provide parameter message.
 *  @param {(string|function)} [message] See same parameter of ensureOneOf().
 * */
SeLiteMisc.ensureType= function ensureType( item, typeStringOrStrings, variableName, message ) {
    if( !SeLiteMisc.hasType(item, typeStringOrStrings, variableName) ) {
        message= SeLiteMisc.valueOf( message );
        if( !message ) {
            variableName= SeLiteMisc.valueOf(variableName);
            typeStringOrStrings= Array.isArray(typeStringOrStrings)
                ? typeStringOrStrings
                : [typeStringOrStrings];
            message= variableName
                ? 'Variable ' +variableName+ ' should have type from within [' +typeStringOrStrings+ '], but the actual type of the item is ' +typeof item+ '. The item: ' +item
                : 'Expecting an item of type from within [' +typeStringOrStrings+ '], but the actual type of the item is ' +typeof item+ '. The item: ' +item;
        }
        SeLiteMisc.fail( message );
    }
};

/** @var array of strings which are names of global classes/objects.
 *  A list of global classes supported by isInstance(), that are separate per each global scope
 *  (and each Javascript module has its own). See a list of them at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects.
 * */
var globalClasses= ['Array', 'Boolean', 'Date', 'Function', 'Iterator', 'Number', 'RegExp', 'String', 'Proxy', 'Error'];

/** Detect whether the given object is an instance of one of the given class(es). It works mostly even if the object is an instance of one of Javascript 'global' classes ('objects') from a different Javascript code module, its class/constructor is different to this scope. That wouldn't work only if the other scope had a custom class/constructor with function name same as one of the global objects, which is a bad practice, e.g.
 * <code>
 *    var MyError= function Error() {... };
 *    var myErrorInstance= new MyError();
 *    SeLiteMisc.isInstance( myErrorInstance, Error ) returns true
 * </code>
 *  @param {object} object Object
 *  @param {function|array} classes Class (that is, a constructor function), or its name, or an array of any number of one or the other.
 *  @param {string} [variableName] See same parameter of ensureOneOf(). Only used on failure, so that the error message is more meaningful.
 */
SeLiteMisc.isInstance= function isInstance( object, classes, variableName ) {
    var classesWasArray= Array.isArray(classes);
    if( !classesWasArray ) {
        typeof classes==='function' || typeof classes==='string' || SeLiteMisc.fail( "Parameter clases must be a constructor method, or an array of them." ); // internal validation
        classes= [classes];
    }
    SeLiteMisc.ensureType( object, 'object', variableName || 'object' ); // semi-internal validation
    for( var i=0; i<classes.length; i++ ) {//@TODO low: use loop for of() once NetBeans supports it
        var clazz= classes[i];
        if( typeof clazz==='function' ) {
            if( object instanceof clazz
                || SeLiteMisc.oneOf(clazz.name, globalClasses) && object.constructor.name===clazz.name ) {
                return true;
            }
        }
        else if( typeof clazz==='string' ) { // Check the object's class and any parent classes.
            // I could start with item= Object.getPrototypeOf(object). That would cover both instances of leaf grand...child classes which should have .constructor.prototype set manually, as well as instances of top-level classes that don't have .constructor.prototype set manually. If clazz is not the exact (leaf) class as the class of object, then the following loop runs one more time than it would if I set item=Object.getPrototypeOf(object). However, the following is more robust (if the programmer forgets to set child prototype's constructor manually).
            var item= object;
            while( item ) {
                if( item.constructor.name===clazz ) {
                    return true;
                }
                item= Object.getPrototypeOf( item );
            }
        }
        else {
            SeLiteMisc.fail( "When checking class of " +(variableName || 'object')+ ", parameter " +
                (classesWasArray
                    ? 'slice classes[' +i+ ']'
                    : 'classes'
                )+ ' is not a function (a constructor), neither a string.'
            );
        }
    }
    return false;
};

/** @param {(object|function)} objectOrConstructor An object (instance), or a constructor of a class (a function).
 *  @return string Either class name (constructor method name), or 'null', or a meaningful short message.
 * */
SeLiteMisc.classNameOf= function classNameOf( objectOrConstructor ) {
    return typeof objectOrConstructor==='object'
        ? (objectOrConstructor!==null
                ? SeLiteMisc.classNameOf( objectOrConstructor.constructor )
                : 'null'
          )
        : (typeof objectOrConstructor==='function'
            ?(objectOrConstructor.name
                        ? objectOrConstructor.name
                        : 'unnamed class' // E.g.: var anonymousConstructor= function() {}; -> it has: anonymousConstructor.name===''
             )
            : 'not an object, neither a function, but ' +typeof objectOrConstructor
        );
};

/** @param {*}
 *  @return {(object|function)} Either 'object of XXX' or 'class XXX', where XXX is objectOrConstructor (if it's a class), or a constructor of objectOrConstructor.
 * */
SeLiteMisc.typeAndClassNameOf= function typeAndClassNameOf( objectOrConstructor ) {
    return (objectOrConstructor!==null
            ? (typeof objectOrConstructor==='object'
                    ? 'object of '
                    : 'class '
              )
            : ''
        )+ SeLiteMisc.classNameOf( objectOrConstructor );
};
        
/** Validate that a parameter is an object and of a given class (or of one of given classes).
 *  @param object Object
 *  @param classes Class (that is, a constructor function), or an array of them.
 *  @param {string} [variableName] See same parameter of ensureOneOf().
 *  @param {string} [message] See same parameter of ensureOneOf().
 *  @see SeLiteMisc.isInstance()
 * */
SeLiteMisc.ensureInstance= function ensureInstance( object, classes, variableName, message ) {
    if( typeof classes==='function' ) {
        classes= [classes];
    }
    if( !SeLiteMisc.isInstance(object, classes, variableName) ) {
        var classNames= [];
        classes.forEach( function(className) {
            classNames.push( SeLiteMisc.classNameOf(className) );
        } );
        SeLiteMisc.fail( message ||
            (variableName
                ? 'Variable ' +variableName+ ' should be an instance of '
                : 'Expecting an instance of '
                )
            +(classNames.length===1
                ? classNames[0]
                : ' one of [' +classNames.join(',')+ ']'
            )+ ', but ' 
            +(object!==null
                ? 'an instance of ' +object.constructor.name
                : 'null'
            )+ ' was given. '
        );
    }
};

SeLiteMisc.PROXY_TARGET_CONSTRUCTOR= 'SELITE_MISC_PROXY_TARGET_CONSTRUCTOR';
SeLiteMisc.PROXY_TARGET_CLASS= 'SELITE_MISC_PROXY_TARGET_CLASS';
SeLiteMisc.PROXY_FIELD_DEFINITIONS= 'SELITE_MISC_PROXY_FIELD_DEFINITIONS';
SeLiteMisc.PROXY_CLASS_INSTANCE_DEFINITIONS= 'SELITE_MISC_PROXY_CLASS_INSTANCE_DEFINITIONS';

/** @private */
var proxyVerifyFieldsOnReadObjectHandler= {
  get: function get(target, name, receiver) {
    // Check whether name is set in target. Don't use target[name]!==undefined for that, because it may be set to undefined. I allow access to 'toJSON' even if not set. That's needed when your code creates new Error(), which (in Firefox) accesses 'toJSON' for all 'this' objects on the stack. I don't need to check for name==='constructor' with objects, since objects have it defined normally. The same for name==='name' when target is a class (a constructor function).
    name in target || name==='toJSON' || SeLiteMisc.fail( 'Accessing an unset field "' +name+ '" in ' +SeLiteMisc.typeAndClassNameOf(target) );
    return target[name];
  }
};

/** @param {object} definitions Definitions of fields. I.e. proxy[SeLiteMisc.PROXY_FIELD_DEFINITIONS].
 *  @return {boolean} Whether the given definitions allows a field with given name and value.
 * */
function checkField( name, value, target ) {
    var definitions= target[SeLiteMisc.PROXY_FIELD_DEFINITIONS];
    var definition= definitions[name];
    if( definition!==undefined ) {
        
        if( definition==='any' ) {
            return true;
        }
        var isObject= typeof value==='object';
        for( var i=0; i<definition.length; i++ ) { //@TODO low: for(..of..)
            var definitionEntry= definition[i];

            if( SeLiteMisc.TYPE_NAMES.indexOf(definitionEntry)>=0 ) {
                if( SeLiteMisc.hasType(value, [definitionEntry]) ) {
                    return true;
                }
            }
            else {
                if( isObject && SeLiteMisc.isInstance(value, definitionEntry) ) {
                    return true;
                }
            }
        }
        return false;
    }
    var catchAll= definitions['*'];
    return catchAll && catchAll.call(null, name, value, target);               
}

/** For verifying on both read and write */
var proxyVerifyFieldsObjectHandler= {
    get: proxyVerifyFieldsOnReadObjectHandler.get,
    
    /** It seems to be supposed to return boolean, but the value is not documented at MDN. So I don't return anything. */
    set: function set(target, name, value, receiver) {
        checkField( name, value, target )
        || SeLiteMisc.fail( "Field '" +name+ "' on " +SeLiteMisc.typeAndClassNameOf(target)+ " is not declared, or it doesn't accept " +typeof value+ ': ' +value );
        target[name]= value;
    }
};

/** @private */
var proxyVerifyFieldsOnReadClassHandler= {
  get: proxyVerifyFieldsOnReadObjectHandler.get,
  construct: function construct( targetConstructor, args ) {
    // Right here we're not in a constructor body yet, so I can't use keyword 'this' as a new instance/object here (since this.constructor.name is 'Object' and not target.name).
    // Following is based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply#Using_apply_to_chain_constructors
    var fNewConstr = function () {};
    fNewConstr.prototype = targetConstructor.prototype;
    var proxy= new Proxy( new fNewConstr(), proxyVerifyFieldsOnReadObjectHandler );
    Object.defineProperty( proxy, SeLiteMisc.PROXY_TARGET_CONSTRUCTOR, {
      enumerable: false, configurable: false, writable: false,
      value: targetConstructor
    });
    // I invoke targetconstructor only after the previous steps, so that targetConstructor has protected access to the fields and it can use this[SeLiteMisc.PROXY_TARGET_CONSTRUCTOR]
    targetConstructor.apply( proxy, args );
    return proxy;
  }
};
function proxyVerifyFieldsClassHandler( chainedTreatedDefinitions ) {
    return {
        get: proxyVerifyFieldsObjectHandler.get,
        set: proxyVerifyFieldsObjectHandler.set,
        // Just like proxyVerifyFieldsOnReadClassHandler.construct(), but this sets field with name equal to SeLiteMisc.PROXY_FIELD_DEFINITIONS on the newly created object
        construct: function construct( targetConstructor, args ) {
          var fNewConstr = function () {
              // Following Object.defineProperty() works, even if 'this' already has field with name equal to SeLiteMisc.PROXY_FIELD_DEFINITIONS (coming from fNewConstr.protype as set below).
              Object.defineProperty( this, SeLiteMisc.PROXY_FIELD_DEFINITIONS, {
                  enumerable: false, configurable: false, writable: false,
                  // I create a protective prototype-chained object, so that each instance keeps its own modifications
                  value: Object.create( chainedTreatedDefinitions )
              });
          };
          fNewConstr.prototype = targetConstructor.prototype;
          var proxy= new Proxy( new fNewConstr(), proxyVerifyFieldsObjectHandler );
          Object.defineProperty( proxy, SeLiteMisc.PROXY_TARGET_CONSTRUCTOR, {
            enumerable: false, configurable: false, writable: false,
            value: targetConstructor
          });
          // I invoke targetconstructor only after the previous steps, so that targetConstructor has protected access to the fields and it can use this[SeLiteMisc.PROXY_TARGET_CONSTRUCTOR]
          targetConstructor.apply( proxy, args );
          return proxy;
        }
    };
}

/** This generates a proxy for the given target object or class (constructor function). The proxy ensures that any fields read have been set already. This serves to prevent typing/renaming accidents that would access non-existing fields, doing which normally returns undefined. Such problems arise when you access fields directly, rather than via accessor methods, and when you don't access any properties/methods on the retrieved fields themselves. An example is when you compare the field values by operators.
 <br/> Instead of using the fields directly you could have accessor methods, but those don't gurarentee correct code anyway (since they may contain typos, too), hence they don't solve the problem; however, they do make code more verbose and less hands-on.
 <br/> This uses Proxy, which decreases execution speed a bit. However, it helps to identify mistakes earlier, while keeping code shorter.
 <br/> If you need the code to determine whether the proxy contains a field with a given name, use expression: fieldName in target.
 @param {object|function} target An object, or a class (a constructor function). If it's a class, it may be an parent class, or a leaf-like. If used for non-leaf classes, then this doesn't protect instances of leaf classes: any classes that inherit from the proxy won't be protected by this mechanism - you need to use SeLiteMisc.proxyVerifyFieldsOnRead() for those subclasses, too. If target is a class (a function), then this covers both access to 'static' properties set on the class itself, and access to properties set on its instances.
If used for multiple or all classes in the inheritance ancestry tree, this slows down access through prototype chain a bit; if that matters, then use it for leaf-classes only.
 @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
 Usage:
    var object= SeLiteMisc.proxyVerifyFieldsOnRead( {...} or new ClassXyz(...) );
 or
    function ClassXyz(...) {...}
    ClassXyz= SeLiteMisc.proxyVerifyFieldsOnRead( ClassXyz );
    var object= new ClassXyz;
 
 When using with a class, following standard invariants work:
    object instanceof ClassXyz===true
    object.constructor.name===ClassXyz
 However, object.constructor refers to the original ClassXyz.
 For classes, this sets proxyClass[SeLiteMisc.PROXY_TARGET_CLASS] pointing to the original class, and for instances it sets proxyInstance[SeLiteMisc.PROXY_TARGET_CONSTRUCTOR] pointing to the original instance (or original new instance). Beware that if you have a subclass of a proxyfied class, but you don't proxyfy that subclass and you sets its prototype to be an instance of the parent (proxyfied) class, then child instances will have proxyInstance[SeLiteMisc.PROXY_TARGET_CONSTRUCTOR] set to the target constructor of the parent class.
 * */
SeLiteMisc.proxyVerifyFieldsOnRead= function proxyVerifyFieldsOnRead( target ) {
    typeof target==='object' && target!==null || typeof target==='function' || SeLiteMisc.fail( 'Parameter target should be an object or a class (constructor function), but it is ' +typeof target );
    if( typeof target==='object' ) {
        return new Proxy( target, proxyVerifyFieldsOnReadObjectHandler );
    }
    
    var result= new Proxy( target, proxyVerifyFieldsOnReadClassHandler );
    Object.defineProperty( result, SeLiteMisc.PROXY_TARGET_CLASS, {
      enumerable: false, configurable: false, writable: false,
      value: target
    });
    return result;
};
/** @private Treat and validate definitions of field(s) for a proxy that will be created, or has been created, by SeLiteMisc.proxyVerifyFields().
 *  @param {object} definitions Like the same parameter for proxyVerifyFields()
 *  @param {object} targetOrProxy Either an existing proxy, or a target (for a proxy that will be created). Only used when reporting an error.
 *  @return {object} Treated definitions.
 * */
function treatProxyFieldDefinitions( definitions, targetOrProxy ) {
    definitions= definitions || [];
    typeof definitions==='object' || SeLiteMisc.fail( 'Parameter definitions must be an object or an array.' );
    !(SeLiteMisc.PROXY_FIELD_DEFINITIONS in definitions) || SeLiteMisc.fail( "You can't declare field with name same as value of SeLiteMisc.PROXY_FIELD_DEFINITIONS." );
    if( Array.isArray(definitions) ) {
        var newDefinitions= {};
        for( var i=0; i<definitions.length; i++ ) {
            newDefinitions[ definitions[i] ]= 'any';
        }
        definitions= newDefinitions;
    }
    for( var fieldName in definitions ) {
        var definition= definitions[fieldName];
        if( definition==='any' ) {
            continue;
        }
        if( fieldName==='*' ) {
            definition===undefined || typeof definition==='function' || SeLiteMisc.fail( "If you use catch-all handler '*', it must be a function." );
            continue;
        }
        var definitionWasArray= Array.isArray(definition);
        if( !definitionWasArray ) {
            definition= [definition];
            definitions[fieldName]= definition;
        }
        for( var i=0; i<definition.length; i++ ) {
            SeLiteMisc.ensureType( definition[i], ['string', 'function'],
                function() {
                    return 'Definition' +
                        (definitionWasArray
                            ? ' slice ' +i
                            : ''
                        )+ ' of field ' +fieldName+ ' on proxy of ' +SeLiteMisc.typeAndClassNameOf(targetOrProxy);
                }
            );
        }
    }
    return definitions;
}

//@TODO low: Change construct handler and here: Set definitions on class's prototype, not on the new instance.
/** Like SeLiteMisc.proxyVerifyFieldsOnRead(), but this creates a proxy that verifies fields on both read and write. If used with a constructor function (i.e. a class), it should define any fields added by that class, and any parent constructors should declare their own fields.
 *  @param {(object|function)} target An object to be proxied, or a class (a constructor function). If it's a child class of a parent class that also went through SeLiteMisc.proxyVerifyFields(), then you must set the prototype of this child class *before* you call SeLiteMisc.proxyVerifyFields() on it. E.g.:
 *  function ChildClass(...) {
 *      ParentClass.call( this, ... );
 *  }
 *  ChildClass.prototype= Object.create(ParentClass.prototype);
 *  ChildClass.prototype.constructor= ParentClass;
 *  ChildClass= SeLiteMisc.proxyVerifyFields( ChildClass, {...} );
 *  @param {(object|array)} [givenObjectOrClassDefinitions] Definition of fields for the proxy for the given target (either the given object, or given class/constructor function itself); optional. It doesn't define fields of instances of the proxy class (if target is a class) - use <code>classInstanceDefinitions</code> for that. It may be modified and/or frozen by this function, therefore don't re-use the same <code>givenObjectOrClassDefinitions</code> object (e.g. from variable in a closure) for different targets. Either an array of field names, or an object {
 *      fieldName: either
 *          - a string: one of SeLiteMisc.TYPE_NAMES or the name of a class, or 
 *          - a function: a constructor function of a class, or
 *          - an array of such strings/functions
 *      ...
 *      and optionally:
 *      '*': function( name, value ) { return boolean }. That is only called for fields that are not specifically declared. So if a field is declared as above, then '*' doesn't apply to it.
 *  }. If you have multiple fields with same definition, you can shorten the code by using SeLiteMisc.Settable instance for <code>givenObjectOrClassDefinitions</code> or <code>classInstanceDefinitions</code>.
 *  @param {(object|Array)} [prototypeDefinitions] Definitions of fields of 'prototype' field of the given class to be proxied. Optional; it must not be present if target is not a class (a constructor function). Structure like that of <code>givenObjectOrClassDefinitions</code>. The actual instances of the class won't inherit thise definition set - so if you need to modify such fields per instance, include definition of those fields in <code>classInstanceDefinitions</code>.
 *  @param {(object|Array)} [classInstanceDefinitions] Definitions of fields of instances of the given class. Optional; it must not be present if target is not a class (a constructor function). Structure like that of <code>givenObjectOrClassDefinitions</code>. Side note: If we didn't have <code>classInstanceDefinitions</code>, the programmer could workaround by calling <code>SeLiteMisc.proxyAllowFields(this)</code> from the constructor function. However, that could be awkward.
 *   */
SeLiteMisc.proxyVerifyFields= function proxyVerifyFields( target, givenObjectOrClassDefinitions, prototypeDefinitions, classInstanceDefinitions ) {
    !(SeLiteMisc.PROXY_FIELD_DEFINITIONS in target) || SeLiteMisc.fail( "target or its [grand..]prototype is already a proxy!" );
    // I treat and validate definitions now, so the proxy's set() doesn't have to.
    
    Object.defineProperty( target, SeLiteMisc.PROXY_FIELD_DEFINITIONS, {
      enumerable: false, configurable: false, writable: false,
      value: treatProxyFieldDefinitions(givenObjectOrClassDefinitions)
    });
    // @TODO low: verify existing fields on target?
    
    if( typeof target==='object' ) {
        return new Proxy( target, proxyVerifyFieldsObjectHandler );
    }
    
    typeof target.prototype==='object' || SeLiteMisc.fail();
    !target.prototype.hasOwnProperty(SeLiteMisc.PROXY_FIELD_DEFINITIONS) || SeLiteMisc.fail( "target.prototype is already a proxy." );
    prototypeDefinitions= treatProxyFieldDefinitions(prototypeDefinitions);
    if( SeLiteMisc.PROXY_FIELD_DEFINITIONS in target.prototype ) {
        prototypeDefinitions= SeLiteMisc.objectCopyFields( prototypeDefinitions, Object.create( target.prototype[SeLiteMisc.PROXY_FIELD_DEFINITIONS] ) );
    }
    Object.defineProperty( target.prototype, SeLiteMisc.PROXY_FIELD_DEFINITIONS, {
      enumerable: false, configurable: false, writable: false,
      value: prototypeDefinitions
    });
    
    classInstanceDefinitions= treatProxyFieldDefinitions(classInstanceDefinitions);
    if( SeLiteMisc.PROXY_CLASS_INSTANCE_DEFINITIONS in target.prototype ) {
        classInstanceDefinitions= SeLiteMisc.objectCopyFields( classInstanceDefinitions, Object.create( target.prototype[SeLiteMisc.PROXY_CLASS_INSTANCE_DEFINITIONS] ) );
    }
    Object.defineProperty( target.prototype, SeLiteMisc.PROXY_CLASS_INSTANCE_DEFINITIONS, {
      enumerable: false, configurable: false, writable: false,
      value: classInstanceDefinitions
    });
    
    var result= new Proxy( target, proxyVerifyFieldsClassHandler(classInstanceDefinitions) );
    Object.defineProperty( result, SeLiteMisc.PROXY_TARGET_CLASS, {
      enumerable: false, configurable: false, writable: false,
      value: target
    });
    return result;
};
/** Add definitions of field(s) to an existing proxy (either an object or a constructor/class), that has been created by SeLiteMisc.proxyVerifyFields() or by a constructor processed by SeLiteMisc.proxyVerifyFields().
 * @param {object} proxy Either an object, or a constructor (a class), that is a proxy.
 * @param {object} definitions See the same parameter of SeLiteMisc.proxyVerifyFields().
 * @param {boolean} [preventDefinitionOverride=false] Whether to prevent override of any existing definition (inherited or own).
 * @return void 
 * */
SeLiteMisc.proxyAllowFields= function proxyAllowFields( proxy, definitions, preventDefinitionOverride ) {
    proxy.hasOwnProperty(SeLiteMisc.PROXY_FIELD_DEFINITIONS) || SeLiteMisc.fail( "Proxy object doesn't have a field with name equal to value of SeLiteMisc.PROXY_FIELD_DEFINITIONS." );
    definitions= treatProxyFieldDefinitions( definitions );
    var existingDefinitions= proxy[SeLiteMisc.PROXY_FIELD_DEFINITIONS];
    if( preventDefinitionOverride ) {
        for( var field in existingDefinitions ) {
            !( field in definitions ) || SeLiteMisc.fail( "Field '" +field+ "' has been declared previously." );
        }
    }
    SeLiteMisc.objectCopyFields( definitions, existingDefinitions );
};

/** An auxilliary class, that allows setting fields with names generated at runtime in one function call, or through a chain of calls.
 * It serves to generate parameter <code>definitions</code> for SeLiteMisc.loadVerifyScope(), SeLiteMisc.proxyVerifyFields() and SeLiteMisc.proxyAllowFields().
 * It also serves e.g. to generate object parts of 'columns' part of the parameter to SeLiteData.RecordSetFormula() constructor, if your table names are not constants, i.e. you have a configurable table prefix string, and you don't want to have a string variable for each table name itself, but you want to refer to .name property of the table object. Then your table name is not a string constant, and you can't use string runtime expressions as object keys in anonymous object construction {}. That's when you can use new SeLiteMisc.Settable().set( tableXYZ.name, ...).set( tablePQR.name, ...) as the value of 'columns' field of SeLiteData.RecordSetFormula()'s parameter. There its usage assumes that no table name (and no value for parameter field) is 'set'. It refuses duplicate entries (field names) and it also refuses to override an already set field.
*/
SeLiteMisc.Settable= function Settable( field, value, etc ) {
    if( arguments.length>0 ) {
        SeLiteMisc.Settable.prototype.set.apply( this, arguments );
    }
};
// I don't want method set() to show up when iterating through SeLiteMisc.Settable instances using for( .. in..), therefore I use defineProperty():
Object.defineProperty( SeLiteMisc.Settable.prototype, 'set', {
    /** It sets fields with given names to given values (on <code>this</code> object). It accepts a flexible number (even number) of parameters. It refuses to override an already set field (and hence it refuses the same field name passed in multiple times).
     *  @param {(string|number|Array)} field. If it's an array, then it represents zero, one or multiple fields, and the value will be assigned to all listed fields.
     *  @param {*} value
     *  @return {Settable} this
     * */
    value: function set( field, value, etc ) {
        arguments.length%2===0 || SeLiteMisc.fail( 'SeLiteMisc.Settable.prototype.set() only accepts an even number of arguments.' );
        for( var i=0; i<arguments.length; i+=2 ) {
            var field= arguments[i];
            if( typeof field==='number' || typeof field==='string' ) {
                !( field in this ) || SeLiteMisc.fail( "Field '" +field+ "' has been set previously." );
                this[ field ]= arguments[i+1];
            }
            else if( Array.isArray(field) ) {
                for( var j=0; j<field.length; j++ ) {// TODO low: for(..of..)
                    !( field[j] in this ) || SeLiteMisc.fail( "Field '" +field[j]+ "' has been set previously." );
                    this[ field[j] ]= arguments[i+1];
                }
            }
            else {
                SeLiteMisc.fail( '' +i+ '-nth parameter is ' +typeof field+ ', but it should be a number, a string or an array.' );
            }
        }
        return this;
    }
} );

/** Used to streamline the code when accessing optional fields on objects that are a result of SeLiteMisc.proxyVerifyFieldsOnRead() or SeLiteMisc.proxyVerifyFields(). That's instead of object.fieldName || defaultValue, which fails for such objects.
 * @param {object} object
 * @param {string} fieldName
 * @param {*} defaultValue
 * @return {*} object[fieldName] if it's present (even if it equals to undefined); defaultValue otherwise
 * */
SeLiteMisc.field= function field( object, fieldName, defaultValue ) {
    return fieldName in object
        ? object[fieldName]
        : defaultValue;
};

/** @param {(object|Array)} [arrayOrItem]
 *  @param {boolean} [encloseInArrayEvenIfUndefined]
 *  @return {Array} arrayOrItem if it's an array; [arrayOrItem] if arrayOrItem is defined but not an array, or it's undefined but encloseInArrayEvenIfUndefined is true; an empty array otherwise.
 * */
SeLiteMisc.asArray= function asArray( arrayOrItem, encloseInArrayEvenIfUndefined ) {
    return arrayOrItem!==undefined || encloseInArrayEvenIfUndefined
        ? (Array.isArray(arrayOrItem)
            ? arrayOrItem
            : [arrayOrItem]
          )
        : [];
};

/** Enumeration-like class.
 * @class
 * @param {string} name
 */
SeLiteMisc.Enum= function Enum( name ) {
    this.name= name;
    // this.constructor is the actual leaf constructor (class). Therefore instances[] is separate between all subclasses of SeLiteMisc.Enum.
    if( !('instances' in this.constructor) ) { // this check is instead of: this.constructor.instances= this.constructor.instances, to make this class compatible with SeLiteMisc.proxyVerifyFieldsOnRead()
        /** Array of instances for the particular leaf subclass. */
        this.constructor.instances= [];
    }
    this.constructor.instances.push( this );
}
SeLiteMisc.Enum.prototype.toString= function toString() {
    return this.constructor.name+ '.' +this.name;
};
SeLiteMisc.Enum= SeLiteMisc.proxyVerifyFields( SeLiteMisc.Enum, {instances: Array}, {}, {name: 'string'} );

var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);

/** This defines a catch-all declaration handler, that allows functions not to be declared through declareGlobals(). This means that you can't set up a catch-all handler yourself.
 * */
function SeLiteMiscClassForVerifiedScope( globalScope ) {
    globalScope instanceof VerifiedScope || SeLiteMisc.fail();
    this.globalScope= globalScope;
}
/** @private Not to be exported.
 *  @class Class (constructor) for special 'version' of SeLiteMisc object(s), that are passed in controlled global scope to files loaded through  SeLiteMisc.loadVerifyScope(). Those special SeLiteMisc objects have an extra method declareGlobals(). */
SeLiteMiscClassForVerifiedScope.prototype= Object.create( SeLiteMisc );
SeLiteMiscClassForVerifiedScope.prototype.constructor= SeLiteMiscClassForVerifiedScope;

/** Declare any global variables (on top of already declared ones). This function is in 'SeLiteMisc' namespace object, but only in files loaded through SeLiteMisc.loadVerifyScope().
 * @param {(object|array)} definitions See SeLiteMisc.proxyAllowFields().
 *  */
SeLiteMiscClassForVerifiedScope.prototype.declareGlobals= function declareGlobals( definitions ) {
    SeLiteMisc.proxyAllowFields( this.globalScope, definitions );
};

/** For use with '*' catch-all declaration through SeLiteMisc.proxyVerifyFields(), to allow any functions to be defined, but not redefined. */
SeLiteMisc.catchAllFunctions= function catchAllFunctions(name, value, target) {
    // Do not check just with target[name], for which the proxy throws an error when target[name] is not set.
    // For some reason, when I use this from VerifiedScope, (name in target) is true even though target[name]===undefined if name is a name of a variable being set for the first time.
    return ( !(name in target) || target[name]===undefined) && typeof value==='function';
};

/** @private Not to be exported.
 *  @class Class for object(s) that serve as verified global scope, passed to files loaded through SeLiteMisc.loadVerifyScope().
 * */
function VerifiedScope() {}
VerifiedScope= SeLiteMisc.proxyVerifyFields( VerifiedScope, {}, {}, {
    SeLiteMisc: SeLiteMiscClassForVerifiedScope,
    '*': SeLiteMisc.catchAllFunctions
} );

/** Load a given file in a 'verified' global scope. Such a scope requires any global variables to be declared first. The scope will contain 'SeLiteMisc' object and any entries from initialScope. The file has to declare any other global variables (other than functions) with SeLiteMisc.declareGlobals(). It allows 'unverified' functions declared/assigned once only. If you assign a function multiple times (e.g. you define a constructor and then you make a proxy of it), you need to declare it specifically.<br/>
 * If you'd like to control any functions in the file, then pass a definition for field '*' that is a function which always returns false.
 * @param {string} fileURL
 * @param {object} [initialScope] It's copied - so subsequent changes to initialScope have no effect.
 * @param {(object|array)} [initialScopeDefinitions] See parameter definitions of SeLiteMisc.proxyVerifyFields().
 * @param {string} [charset='UTF-8']
 * @return {object} Scope, in which it loads the given file through _subScriptLoader.loadSubScript()_.
 * */
SeLiteMisc.loadVerifyScope= function loadVerifyScope( fileURL, initialScope, initialScopeDefinitions, charset ) {
    initialScope= initialScope || {};
    charset= charset || 'UTF-8';
    var globalScope= new VerifiedScope();
    globalScope.SeLiteMisc= new SeLiteMiscClassForVerifiedScope( globalScope );
    
    if( initialScopeDefinitions ) {
        SeLiteMisc.proxyAllowFields( globalScope, initialScopeDefinitions );
    }
    else {
        SeLiteMisc.proxyAllowFields( globalScope, Object.keys(initialScope) );
    }
    SeLiteMisc.objectCopyFields( initialScope, globalScope );
    subScriptLoader.loadSubScript( fileURL, globalScope, charset );
    return globalScope;
};

SeLiteMisc.isLoadedInVerifiedScope= function isLoadedInVerifiedScope() {
    return this instanceof SeLiteMiscClassForVerifiedScope;
};

/** @param mixed Container - object or array
 *  @param mixed Field - string field name, or integer/integer string index of the item
 *  @param Any further parameters are treated as chained 'subfields' - useful for traversing deeper array/object/mixed structures
 *  @return mixed The item. It returns an empty string if not found or if the actual item is null - that is benefitial
 *  when using this function in parameters to Selenium actions (which fail if passing null).
 **/
SeLiteMisc.item= function item( container, field, fieldAnother, fieldYetAnother ) {
    return SeLiteMisc.itemGeneric( arguments, '', '' );
};

/** Just like item(...), but nulls are not translated at all.
 **/
SeLiteMisc.itemOrNull= function itemOrNull( container, field, fieldAnother, fieldYetAnother ) {
    return SeLiteMisc.itemGeneric( arguments, null, null );
};

/** Internal use only. This serves like item(), but the container (object or array) and the field(s) are all in one array,
 *  which is passed as the first parameter. Then come two optional parameters, which control handling
 *  of missing values and null.
 *  @param array containerAndFields First item is the container (array or object, possibly multi-level). Second (and any further)
 *  items are optional; if present then they must be string or numbers or numeric strings, which are indexes to the respective
 *  level within the container.
 *  @param mixed nullReplacement Value to return if the item is not present - i.e. the container doesn't contain
 *  given field/index, or a chained (sub...)subcontainer doesn't contain the field/index at its respective level.
 *  Optional; if not present, then null is returned.
 *  @param mixed targetNullReplacement Value to return if the target item itself is present, but it's null. Optional; null by default.
 *  @return mixed The item, as described
 * @internal
 **/
SeLiteMisc.itemGeneric= function itemGeneric( containerAndFields, nullReplacement, targetNullReplacement ) {
    if( nullReplacement===undefined) {
        nullReplacement= null;
    }
    if( targetNullReplacement===undefined ) {
        targetNullReplacement= null;
    }
    var item= containerAndFields[0];
    for( var i=1; i<containerAndFields.length; i++ ) {
        if( item===null ) {
            return nullReplacement;
        }
        var field= containerAndFields[i];
        if( Array.isArray(item) ) {
            if( typeof field !=='number' ) { // It may be a numeric string
                field= new Number(field);
                if( isNaN(field) ) {
                    return nullReplacement;
                }
                field= field.valueOf();
            }
            if( field<0 || field>item.length || field!==Math.round(field) ) {
                return nullReplacement;
            }
            item= item[field];
        }
        else
        if( typeof item==='object' && item[field]!==undefined ) {
            item= item[field];
        }
        else {
            return nullReplacement;
        }
    }
    return item!==null
        ? item
        : targetNullReplacement;
};

var OBJECT_TO_STRING_INDENTATION= "  ";

/** Get a simple string representation of the given object/array. Used for debugging.
 *  @param object object to present
 *  @param int recursionDepth How many deeper layers of objects/arrays to show details of; 0 by default (no deeper objects).
 *  @param bool includeFunctions Whether to include functions; false by default.
 *  @param array leafClassNames Names of classes (that would match [sub[sub...]]object.constructor.name) that are excluded from deeper recursive processing.
 *  Use 'Object' to exclude listing of fields of anonymous objects. E.g. ['MyBigClass', 'Object' ] will not list any fields of instances of MyBigClass or anonymous objects.
 *  Use '' for some internal Firefox/XUL/XPCOM? objects.
 *  @param array higherObjects Optional; array of objects/arrays that are being processed by the direct/indirect caller of this function
 *  (i.e. recursive array/object reference). For internal use only - only set when this function calls itself recursively through objectFieldToString().
 *  @param bool includeNonEnumerable Whether to include non-enumerable fields; false by default.
 *  @return string
 */
SeLiteMisc.objectToString= function objectToString( object, recursionDepth, includeFunctions, leafClassNames,
higherObjects, includeNonEnumerable ) {
    if( typeof object!=='object' || object===null ) {
        return ''+object;
    }
    recursionDepth= recursionDepth || 0;
    leafClassNames= leafClassNames || [];
    higherObjects= higherObjects || [];
    higherObjects.push(object);
    var isLeafClass= leafClassNames.indexOf(object.constructor.name)>=0;
    var result= '';
    if( !isLeafClass ) {
        var fields= includeNonEnumerable
            ? Object.getOwnPropertyNames(object)
            : Object.keys(object); // This handles both Array and non-array objects
        for( var j=0; j<fields.length; j++ ) {//@TODO low: replace with for(.. of ..) once NetBeans support it
            result+= objectFieldToString( object, fields[j], recursionDepth, includeFunctions, leafClassNames, higherObjects, includeNonEnumerable, result=='' );
        }
    }
    higherObjects.pop();
    var resultLines= result.split("\n");
    result= resultLines.join( "\n" +OBJECT_TO_STRING_INDENTATION );
    if( result!=='' ) {
        result= "\n" +OBJECT_TO_STRING_INDENTATION+result+ "\n";
    }
    if( isLeafClass ) {
        result= '...';
    }
    if( Array.isArray(object) ) {
        var resultPrefix= 'array';
    }
    else {
        var resultPrefix= object.constructor.name!==''
            ? 'object '+object.constructor.name
            : 'object of unknown class';
    }
    result= resultPrefix+ " {" +result+ "}"
    return result;
};

/*** @private/internal
 *   @see SeLiteMisc.objectToString()
 */
function objectFieldToString( object, field, recursionDepth, includeFunctions, leafClassNames, higherObjects, includeNonEnumerable, firstItem ) {
        var result= '';
        if( !includeFunctions && typeof object[field]==='function' ) {
            return '';
        }
        if( !firstItem ) {
            result+= "\n";
        }
        result+= field+ ": ";
        var higherObjectLevel= higherObjects.indexOf( object[field] );
        // Sometimes indexOf() returnes non-negative index if the elements are not strictly equal.
        // I coudln't easily reproduce it outside of this function. I tried: javascript:hi= 'hi'; arr=[hi]; outer=[]; outer.push( arr ); outer.indexOf(hi)
        if( higherObjectLevel>=0 && higherObjects[higherObjectLevel]===object[field] ) {
            result+= '[Recursive ref. to ' +(Array.isArray(object[field]) ? 'array ' : 'object ')+
                (higherObjects.length-higherObjectLevel) + ' level(s) above.]';
        }
        else
        if( typeof object[field]==='object' && recursionDepth>0 ) {
            result+= SeLiteMisc.objectToString( object[field], recursionDepth-1, includeFunctions, leafClassNames, higherObjects, includeNonEnumerable );
        }
        else {
            if( Array.isArray(object[field]) ) {
                result+= object[field].length ? '[array of ' +object[field].length+ ' elements]' : '[empty array]';
            }
            else {
                result+= object[field];
            }
        }
        return result;
};

/** Get string representation of the given matrix or given array of objects.
 *  @param mixed rows Array of objects, or object of objects.
 *  @param bool includeFunctions Whether to include functions; false by default.
 *  includeFunctions only applies to inner objects; no functions of rows itself
 *  are included at all.
 *  @return string
 *  Used for debugging.
 **/
SeLiteMisc.rowsToString= function rowsToString( rows, includeFunctions ) {
    var resultLines= [];
    if( Array.isArray(rows) ) {
        for( var i=0; i<rows.length; i++ ) {
            resultLines.push( SeLiteMisc.objectToString( rows[i], undefined, includeFunctions ) );
        }
    }
    else {
        for( var field in rows ) {
            if( typeof rows[field]=='function' ) {
                continue;
            }
            resultLines.push( '' +field+ ' => ' +SeLiteMisc.objectToString( rows[field], undefined, includeFunctions ) );
        }
    }
    return resultLines.join( "\n" );
};

/** @return number Number of seconds since Epoch.
 **/
SeLiteMisc.timestampInSeconds= function timestampInSeconds() {
    return Math.round( Date.now()/1000 );
};

/** @return true if the object is empty (no fields availabel to iterate through); false otherwise.
 *  @throws Error if the parameter is not an object.
 **/
SeLiteMisc.isEmptyObject= function isEmptyObject( obj ) {
    SeLiteMisc.ensureType( obj, "object", 'obj' );
    for( var field in obj ) {
        return false;
    }
    return true;
};

/** Compare all fields of both given objects.
 *  @param firstContainer object  (not a 'primitive' string) or array
 *  @param secondContainer object (not a 'primitive' string) or array
 *  @param mixed strictOrMethodName Bool or a string. Boolean false by default.
 *  - if true, it compares with strict operator ===
 *  - if false, it compares using non-strict using ==
 *  - if string, it's a name of a method (not the method itself) to call on each field,
 *    unless both are null (compared using strict ===) or unless first or second is not an object.
 *    If both objects are null, then they are deemed to be equal and the method is not called.
 *  @param boolean throwOnDifference Whether to throw an error if different
 *  @return boolean Whether both objects have same fields and their values
 * */
SeLiteMisc.compareAllFields= function compareAllFields( firstContainer, secondContainer, strictOrMethodName, throwOnDifference ) {
    SeLiteMisc.ensureType( firstContainer, 'object', 'firstContainer' );
    SeLiteMisc.ensureType( secondContainer, 'object', 'secondContainer' );
    if( Array.isArray(firstContainer) || Array.isArray(secondContainer) ) {
        return SeLiteMisc.compareArrays( firstArray, secondArray, strictOrMethodName, throwOnDifference );
    }
    if( firstContainer===null || secondContainer===null ) {
        return firstContainer===secondContainer;
    }
    strictOrMethodName= strictOrMethodName || false;
    var strict= typeof strictOrMethodName=='boolean' && strictOrMethodName;
    var methodName= typeof strictOrMethodName=='string'
        ? strictOrMethodName
        : false;
    try {
        SeLiteMisc.compareAllFieldsOneWay( firstContainer, secondContainer, false, strict, methodName );
        SeLiteMisc.compareAllFieldsOneWay( secondContainer, firstContainer, false, strict, methodName );
    }
    catch( exception ) {
        if( throwOnDifference ) {
            throw exception;
        }
        return false; // This is not very efficient, but it makes the above code and SeLiteMisc.compareAllFieldsOneWay()
        // more readable than having if(throwOnDifference) check multiple times above
    }
    return true;
};

/** Compare whether all fields from firstContainer exist in secondContainer and are same. Throw an error if not.
 *  See SeLiteMisc.compareAllFields().
 *  @param {(Array|object)} firstContainer
 *  @param {(Array|object)} secondContainer
 *  @param {boolean} [asArray=false]
 *  @param {boolean} [strict=false]
 *  @param {string} [methodName=undefined]
 *  @return void
 *  @throws If the containers are different (see description); otherwise the containers are equal.
 * */
SeLiteMisc.compareAllFieldsOneWay= function compareAllFieldsOneWay( firstContainer, secondContainer, asArray, strict, methodName ) {
    if( asArray ) {
        for( var i=0; i<firstContainer.length; i++ ) {
            SeLiteMisc.compareFieldOneWay( i, firstContainer, secondContainer, asArray, strict, methodName );
        }
    }
    else {
        for( var fieldName in firstContainer ) { // No need to check for null - loop for() works if the container is null
            SeLiteMisc.compareFieldOneWay( fieldName, firstContainer, secondContainer, asArray, strict, methodName );
        }
    }
};

/** @private
 *  @param {(string|number)} fieldName Object field name (if firstContainer is a non-array object), or an integer index (if firstContainer is an array).
 * */
SeLiteMisc.compareFieldOneWay= function compareFieldOneWay( fieldName, firstContainer, secondContainer, asArray, strict, methodName ) {
    if( !(fieldName in secondContainer) ) {
        throw new Error();
    }
    var first= firstContainer[fieldName];
    var second= secondContainer[fieldName];

    if( strict || methodName ) {
        if( (first===null)!=(second===null) ) {
            throw new Error();
        }
    }
    if( methodName ) {
        if( typeof first!='object' || typeof second!='object' ) { // typeof null=='object', so this is null-proof
            throw new Error();
        }
        if( first!==null && !first[methodName].call(null, first, second) ) {
            throw new Error();
        }
    }
    else {
        if( strict
            ? first!==second
            : first!=second
        ) {
            throw new Error();
        }
    }
};

SeLiteMisc.compareArrays= function compareArrays( firstArray, secondArray, strictOrMethodName, throwOnDifference ) {
    Array.isArray(firstArray) || SeLiteMisc.fail( 'SeLiteMisc.compareArrays() requires firstArray to be an array.');
    Array.isArray(secondArray) || SeLiteMisc.fail('object', 'SeLiteMisc.compareArrays() requires secondArray to be an array.');
    strictOrMethodName= strictOrMethodName || false;
    var strict= typeof strictOrMethodName=='boolean' && strictOrMethodName;
    var methodName= typeof strictOrMethodName=='string'
        ? strictOrMethodName
        : false;
    try {
        if( firstArray.length!==secondArray.length ) {
            throw new Error();
        }
        SeLiteMisc.compareAllFieldsOneWay( firstArray, secondArray, true, strict, methodName );
    }
    catch( exception ) {
        if( throwOnDifference ) {
            throw exception;
        }
        return false;
    }
    return true;
};

var SELITE_MISC_SORTED_OBJECT_KEYS= "SELITE_MISC_SORTED_OBJECT_KEYS";
var SELITE_MISC_SORTED_OBJECT_COMPARE= "SELITE_MISC_SORTED_OBJECT_COMPARE";
/*
var sortedObjectProxyHandler= {
    set: function(target, key, value) {
        var keys= target[SELITE_MISC_SORTED_OBJECT_KEYS];
        if( keys.indexOf(key)<0 ) {
            var sortCompare= target[SELITE_MISC_SORTED_OBJECT_COMPARE];
            if( !sortCompare ) {
                keys.push(key);
            }
            else { // Locate the index to insert at, using a binary quick sort-like search
                if( typeof sortCompare!=='function' ) {
                    throw new Error("SeLiteMisc.sortedObject() and sortedObjectProxyHandler require sortCompare to be a function, if set, but it is " +typeof sortCompare+ ': ' +sortCompare);
                }
                // Brute-force alternative:
                // keys.push( key );
                // keys.sort( sortCompare );
                var start= 0, end= keys.length-1; // 0-based indexes into keys[]
                while( start<end ) {
                    var middle= Math.floor( (start+end)/2 ); // Better than Math.round() for our purpose 
                    if( sortCompare.call(null, key, keys[middle])<=0 ) { // key <= keys[middle], as determined by sortCompare
                        end= middle;
                    }
                    else {
                        // Because of floor(), we need the following check; otherwise the loop would never finish if end-start==1 in this branch
                        if( start==middle ) {
                            start++; // that should be now the same as end
                            continue;
                        }
                        start= middle;
                    }
                } // now start===end (unless keys[] is empty - then start==0, end==-1).
                // If keys[] is empty, end will be -1. Therefore I use start.

                if( start<keys.length-1 || keys.length>0 && sortCompare.call(null, key, keys[keys.length-1])<=0 ) {
                    keys.splice( start, 0, key );
                }
                else {
                    keys.push( key );
                }
            }
        }
        target[key]= value; // The key may exist already or not - either way, I set it in the target
        return true;
    },
    deleteProperty: function(target, name) {
        var index= target[SELITE_MISC_SORTED_OBJECT_KEYS].indexOf(name);
        // index may be -1 - because a user can legally invoke: delete myObject.nonExistingProperty
        if( index>=0 ) {
            target[SELITE_MISC_SORTED_OBJECT_KEYS].splice( index, 1);
        }
        delete target[name];
        return true;
    },
    //enumerate: function( target ) {
    //    return target[SELITE_MISC_SORTED_OBJECT_KEYS];
    //},
    
    // See a comment for 'for(prop in proxy)' at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy and https://bugzilla.mozilla.org/show_bug.cgi?id=783829
    iterate: function( target ) {
        var i=0;
        return {
          next: function() {
            if( i===target[SELITE_MISC_SORTED_OBJECT_KEYS].length ) {
                throw StopIteration;
            }
            return target[SELITE_MISC_SORTED_OBJECT_KEYS][i++];
          }
        };
        //for( var i=0; i<target[SELITE_MISC_SORTED_OBJECT_KEYS].length; i++ ) {
        //    yield target[SELITE_MISC_SORTED_OBJECT_KEYS][i];
        //}
        //return target[SELITE_MISC_SORTED_OBJECT_KEYS];
    },
    keys: function( target ) {
        return target[SELITE_MISC_SORTED_OBJECT_KEYS];
    },
    has: function(target, name) {
        return target[SELITE_MISC_SORTED_OBJECT_KEYS].indexOf(name)>=0;
    }
};/**/

/**This creates an object that manages/preserves order of the fields.
 * For now it works with for( .. in .. ) only. It doesn't keep the order when using Object.keys( .. )
 * @param mixed sortCompare It indicates auto-ordering. Either
 * - a function
 * - bool true if it should order naturally - see SeLiteMisc.compareNatural()
 * - false to just honour browser-given order (not working for now - it will honour the order, but not for e.g. mixed negative/positive numeric keys)
 * @returns a new object
 * <br/>Old docs - relevant only if Firefox supprots object proxies properly. See
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators
   and https://bugzilla.mozilla.org/show_bug.cgi?id=783829
   Especially useful if you have keys that are negative numbers (they get transformed to strings, but that doesn't matter here much).
   Order of such keys didn't get preserved in Firefox 22. That complies with 
   3.1 of ECMA-262: "The mechanics and order of enumerating the properties [...] is not specified."
   There are 2 possibilities of ordering the fields:
   - client-managed, no re-positioning (other than on removal of an item). A new entry is added to the end of the list items.
   - auto-ordered, with automatic re-shuffling - A new entry is added to where it belongs to, based on sortCompare(). If sortCompare
   is boolean true, then it uses natural sorting - see SeLiteMisc.compareNatural().
// See http://stackoverflow.com/questions/648139/is-the-order-of-fields-in-a-javascript-object-predictable-when-looping-through-t
// and https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators
I don't subclass Proxy - because it didn't work - the handler functions were not called.
Also, in order to subclass Proxy, my constructor had to invoke Proxy.constructor.call(this, target, sortedObjectProxyHandler).
 */
SeLiteMisc.sortedObject= function sortedObject( sortCompare ) {
    if( sortCompare===undefined ) {
        sortCompare= false;
    }
    if( sortCompare===true ) {
        sortCompare= SeLiteMisc.compareNatural;
    }
    if( sortCompare && typeof sortCompare!=='function' ) {
        throw new Error("SortedObect() requires parameter sortCompare to be a function or boolean, if specified.");
    }
    var target= new SeLiteMisc.SortedObjectTarget( sortCompare );
    return target;
    //return new Proxy( target, sortedObjectProxyHandler );
    //return  new SortedObjectProxy( target, sortedObjectProxyHandler );
};

/** @private */
SeLiteMisc.SortedObjectTarget= function SortedObjectTarget( sortCompare ) {
    Object.defineProperty( this, SELITE_MISC_SORTED_OBJECT_COMPARE, {
      enumerable: false, configurable: false, writable: false,
      value: sortCompare
    });
    /*Object.defineProperty( target, SELITE_MISC_SORTED_OBJECT_KEYS, {
      enumerable: false, configurable: false, writable: false,
      value: []
    });*/
};

SeLiteMisc.SortedObjectTarget.prototype.__iterator__= function __iterator__() {
    var keys= Object.keys(this);
    if( this[SELITE_MISC_SORTED_OBJECT_COMPARE] ) {
        keys.sort( this[SELITE_MISC_SORTED_OBJECT_COMPARE] );
    }
    var i=0;
    return {
        next: function() {
            if( i<keys.length ) {
                return keys[i++];
            }
            throw StopIteration;
        }
    }
};
Object.defineProperty( SeLiteMisc.SortedObjectTarget.prototype, 'subContainer', {
    enumerable: false, configurable: false, writable: false,
    value:
    /** Access sub(sub...)container of given parent.
     *  If parent[field1][field2][...] is not defined, then this creates any missing chains as new anonymous naturally sorted objects.
     *  @param string field
     *  @param string another field (optional)
     *  ....
     *  @return {object} this[field][field2][...], with any missing chains created as sortedObjects
     * */
    function subContainer( fieldOrFields ) {
        var object= this;
        for( var i=0; i<arguments.length; i++ ) { //@TODO low: for(..of..)
            var fieldName= arguments[i];
            if( !(fieldName in object) ) {
                object[fieldName]= SeLiteMisc.sortedObject(true);
            }
            object= object[fieldName];
        }
        return object;
    }
} );

// For backwards compatibility only. Remove once Settings XPI is approved by Mozilla.
SeLiteMisc.subContainer= function subContainer( parent, fieldOrFields ) {
    return SeLiteMisc.SortedObjectTarget.prototype.subContainer.apply( parent, fieldOrFields.slice(1) );
}

/*
function SortedObjectTargetIterator( target ) {
    this.target= target;
    this.keyIndex= 0;
}
SortedObjectTargetIterator.prototype.next= function() {
    if( this.keyIndex<this.target[SELITE_MISC_SORTED_OBJECT_KEYS].length ) {
        return this.target[SELITE_MISC_SORTED_OBJECT_KEYS][ this.keyIndex++ ];
    }
    throw StopIteration;
};
SeLiteMisc.SortedObjectTarget.prototype.__iterator__= function() {
    return new SortedObjectTargetIterator(this);
};

function SortedObjectProxy( target, sortedObjectProxyHandler ) {
    Proxy.constructor.call(this, target, sortedObjectProxyHandler);
    this.SECRET_TARGET= target;
}
SortedObjectProxy.prototype.__iterator__= function() {throw new Error();
    return this.SECRET_TARGET.__iterator__();
};/**/

/*
function SortedObjectProxy( target, handler ) {
    Proxy.constructor.call(this, target, handler);
}
function SortedObjectProxyIterator( proxy ) {
    this.proxy= proxy;
    this.keyIndex= 0;
}
SortedObjectProxyIterator.prototype.next= function() {
    if( this.keyIndex<this.proxy)
};
SortedObjectProxy.prototype.__iterator__= function() {
    
};
/**/
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/watch.
// I could also just have a setter but it's more hassle: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_Objects#Defining_getters_and_setters
function IterableArrayKeysWatchThrow( id, oldValue, newValue ) {
    throw new Error( "This property " +id+ " is special and must not be re-set on instances of IterableArray." );
}
// I've tried a yield-based function arrayItemGenerator(fieldNames) and 
// var result= {}; result.__iterator__= arrayItemGenerator(fieldNames); or result.__iterator__= Iterator( fieldNames );
// That worked when debugging it separately, but not as a part of SeLiteSettings. 
function IterableArray( keys ) {
    this[SELITE_MISC_ITERABLE_ARRAY_KEYS]= keys!==undefined
        ? keys
        : [];
    SeLiteMisc.ensureInstance( this[SELITE_MISC_ITERABLE_ARRAY_KEYS], 'array', 'keys (if defined)' );
    this.watch( SELITE_MISC_ITERABLE_ARRAY_KEYS, IterableArrayKeysWatchThrow );
}
IterableArray.prototype.__iterator__= function __iterator__() {
    for( var i=0; i<this[SELITE_MISC_ITERABLE_ARRAY_KEYS].length; i++ ) {
        yield this[SELITE_MISC_ITERABLE_ARRAY_KEYS][i];
    }
};

/** Sort fields in object by keys (keys are always strings).
 *  @param object object serving as an associative array
 *  @param function compareFunction Function that compares two keys. Optional; by default case-sensitive string comparison.
 *  @return new anonymous object serving as an associative array, with all fields and values from object, but in the sorted order
 *  @TODO low: remove, replace by SeLiteMisc.sortedObject()
 * */
SeLiteMisc.sortByKeys= function sortByKeys( object, compareFunction ) {
    if( !compareFunction ) {
        compareFunction= undefined;
    }
    var fieldNames= [];
    for( var name in object ) {//Note: name is a string, even if the value were integer
        fieldNames.push(name);
    }
    fieldNames.sort( compareFunction );
    var result= new IterableArray( fieldNames );
    for( var i=0; i<fieldNames.length; i++ ) {
        var name= fieldNames[i];
        result[ name ]= object[ name ];
    }
    return result;
};

/** @return a negative, 0 or positive number, depending on whether first is less
 *  than, equal to or greater than second, in case insensitive dictionary order.
 *  Use as a second parameter to array.sort().
 *  This doesn't expects first and second to be string. That is true for object field names (keys),
 *  even if they were declared using a number/boolean/false. Meaning
 *  var o={ false:0, null:-1, 5: 5 }
 *  for( var field in o ) { // typeof field is string. It's strictly equal to 'false' or 'null' or '5'
 *  }
 *  So you can pass this function as a second parameter to SeLiteMisc.sortByKeys() with no other checks.
 * */
SeLiteMisc.compareCaseInsensitively= function compareCaseInsensitively( first, second ) {
    var firstLower= first.toLowerCase();
    var secondLower= second.toLowerCase();
    return firstLower===secondLower
        ? 0
        : (firstLower<secondLower
            ? -1
            : +1
          );
};

/** Like SeLiteMisc.compareCaseInsensitively(), but for numbers.
 *  Don't use first-second, because that can overrun integer type limits.
 *  @param mixed number or numeric string first
 *  @param mixed number or numeric string second
 * */
SeLiteMisc.compareAsNumbers= function compareAsNumbers( first, second ) {
    first= Number(first); // This works if it is already a number
    second= Number(second);
    return first===second
        ? 0
        : (first<second
            ? -1
            : 1
          );
};

/** A blend of SeLiteMisc.compareCaseInsensitively() and SeLiteMisc.compareAsNumbers().
 *  Non-numeric strings are sorted case insensitively. Numbers are sorted among themselves. Numbers will be before non-numeric strings.
 *  @return a negative, 0 or positive number, depending on whether first is less
 *  than, equal to or greater than second, in the order as described above.
 * */
SeLiteMisc.compareNatural= function compareNatural( first ,second ) {
    var firstNumber= Number(first); // This works if it is already a number
    var secondNumber= Number(second);
    
    if( !isNaN(firstNumber) && !isNaN(secondNumber) ) {
        return firstNumber===secondNumber
            ? 0
            : (firstNumber<secondNumber
                ? -1
                : +1
              );
    }
    return SeLiteMisc.compareCaseInsensitively( first, second );
};

/** @return an anonymous object, which has all fields from obj, and any
    extra fields from overriden. If the same field is in both obj and overriden,
    then the value from obj is used.
*/
SeLiteMisc.objectsMerge= function objectsMerge( obj, overriden ) {
    var result= {};
    var field= null;
    if( obj ) {
        SeLiteMisc.objectCopyFields( obj, result );
    }
    if( overriden ) {
        for( field in overriden ) {
            if( !(field in result) ) {
                result[field]= overriden[field];
            }
        }
    }
    return result;
};

/** Copy all and any  fields (iterable ones) from source object to target object.
 *  If the same field exists in target object, it will be overwritten.
 *  @return object target
 **/
SeLiteMisc.objectCopyFields= function objectCopyFields( source, target ) {
    for( var field in source ) {
        target[field]= source[field];
    }
    return target;
};

/** This makes a shallow clone of a given object. If the original object had a prototype,
 *  then this uses it, too - any fields of the protype won't be copied, but will be referenced.
 *  The new object is based on a plain object {}, so if the original object was created
 *  using a constructor function, the result object won't be; therefore operator instanceof
 *  will return false for the result object.
 *  @param {Object} original The original object.
 *  @param {array} [acceptableFields] optional; if present, then it contains the only fields
 *  that will be copied (if present in original). If acceptableFields is not present/empty,
 *  then any fields are copied.
 *  @param {array} [requiredFields] Required fields; if any are missing, this fails. If this parameter is not provided, then no fields are required.
 *  @param {object} [result] Result object to use; if not provided, then it creates a new object.
 *  @param mixed requiredFields Array of fields that are required to exist in original
 *  (even though their value may be null). If requiredFields==='all' (as a string), then
 *  it will be set to be the same as acceptableFields
 *  See https://developer.mozilla.org/en/JavaScript/Reference/Operators/Operator_Precedence
 **/
SeLiteMisc.objectClone= function objectClone( original, acceptableFields, requiredFields, result ) {
    acceptableFields= acceptableFields || [];
    requiredFields= requiredFields || [];
    if( requiredFields==='all' ) {
        requiredFields= acceptableFields;
    }
    result= result || {};
    if( original.prototype!==undefined ) {
        result.prototype= original.prototype;
    }
    for( var i=0; i<requiredFields.length; i++ ) {
        if( original[ requiredFields[i] ]===undefined ) {
            throw "SeLiteMisc.objectClone(): Field " +requiredFields[i]+ " is required, but it's not present in the original.";
        }
    }
    for( var field in original ) {
        if( acceptableFields.length==0 || acceptableFields.indexOf(field)>=0 ) {
            result[field]= original[field];
        }
    }
    return result;
};

/** This fills in fields from keys[] in target with values from values[]. It is not intended to work with fields that have numeric names.
 *  @param {object} target
 *  @param {array} keys
 *  @param {(array|object)} values Either an array of values, in the same order as keys[]. Or an object serving as an associative array { key => value }.
 *  @param {boolean} [valuesFromProperObject] This must be true if values is an object serving as an associative array, with fieldnames same as entries in keys[]. Then this essentially performs a clone of values into target. valuesFromProperObject must not be true if values is an array or an array-like object, with 'length' property and with all values at numeric indexes, starting from 0 (e.g. a result of keyword-like variable arguments, which can be passed from a body of a function).
 *  @param {boolean} [dontSetMissingOnes] If true, then this only sets field(s) that are present in values. It doesn't set any missing fields to undefined; this can be benefitial if target is a result of SeLiteMisc.proxyVerifyFieldsOnRead(...). If false (as is default), it sets any missing fields to undefined.
 *  @return {object} target
 * */
SeLiteMisc.objectFillIn= function objectFillIn( target, keys, values, valuesFromProperObject, dontSetMissingOnes ) {
    typeof target==='object' || SeLiteMisc.fail( 'target must be an object' );
    Array.isArray(keys) || SeLiteMisc.fail( 'keys must be an object' );
    typeof values==='object' || SeLiteMisc.fail( 'values must be an array or an object' );
    !Array.isArray(values) || !valuesFromProperObject || SeLiteMisc.fail( 'values is an array, therefore valuesFromProperObject must not be true.' );
    if( !valuesFromProperObject ) {
        keys.length>=values.length || SeLiteMisc.fail( 'values.length==' +values.length+ ', which is less than keys.length==' +keys.length );
        var length= dontSetMissingOnes
            ? values.length
            : keys.length;
        for( var i=0; i<length; i++ ) {
            target[ keys[i] ]= values[i];
        }
    }
    else {
        !(0 in values) || SeLiteMisc.fail( 'values must not be an array and it cannot contain numeric indexes, if you pass valuesFromProperObject==true' );
        if( dontSetMissingOnes ) {
            for( var key in values ) {
                keys.indexOf( key )>=0 || SeLiteMisc.fail( 'Key ' +key+ ' is not present in values.' );
                target[ key ]= values[ key ];
            }
        }
        else {
            for( var i=0; i<keys.length; i++ ) {//@TODO low: for(..of..)
                var key= keys[i];
                target[ key ]= values[ key ];
            }
        }        
    }
    return target;
};

/** This deletes all iterable fields from the given object.
 *  @return obj
 **/
SeLiteMisc.objectDeleteFields= function objectDeleteFields( obj ) {
    for( var field in obj ) {
        delete obj[field];
    }
    return obj;
};

SeLiteMisc.arrayClone= function arrayClone( arr ) { return arr.slice(0); };

/** @return an anonymous object, which has all values from obj as keys, and their
 *  respective original keys (field names) as values. If the same value is present for two or more
 *  fields in the original object, then it will be mapped to name of one of those fields (unspecified).
 *  If a value is not a string, it's appended to an empty string (i.e. its toString() will be used, or 'null').
 **/
SeLiteMisc.objectReverse= function objectReverse( obj ) {
    var result= {};
    for( var field in obj ) {
        var value= obj[field];
        if( typeof value !=='string' ) {
            value= '' +value;
        }
        result[ value ]= field;
    }
    return result;
};

/** @return mixed
 *  - if asObject is false: Return an array containing values of all iterable fields in the given object.
        Any values from obj occurring more than once (in obj) will be in the result array as many times.
    - if asObject is true, return an anonymous object with those values being keys in the result object, mapped to a number
        of occurrences of this value in the original object. Values of the original object are converted to strings by
        appending them to an empty string. Indeed, values of different type may map to the same string.
 **/
SeLiteMisc.objectValues= function objectValues( obj, asObject ) {
    var result= asObject ? {} : [];
    for( var field in obj ) {
        if( asObject ) {
            var value= '' +obj[field];
            result[value]= (value in result) ? result[value]+1 : 1;
        }
        else {
            result.push( obj[field] );
        }
    }
    return result;
};

/** @return string field name for the given value, or null. If there are several such
 *  fields, this will return one of them (unspecified which one).
 *  @param object obj Object to search the value in.
 *  @param mixed value Value to search in the given object.
 *  @param bool strict Whether to compare strictly (using ===); false by default.
 **/
SeLiteMisc.objectValueToField= function objectValueToField( obj, value, strict ) {
    for( var field in obj ) {
        if( value==obj[field] && (!strict || value===obj[field]) ) {
            return field;
        }
    }
    return null;
};

/** This collects entries (objects) - from an array (or an object serving as an associative array) of objects (serving as associative arrays), indexed by value(s) of given field/column name(s) in those objects.
 *  It returns those entries indexed by value of that given column/field, which becomes a key in the result
 *  array/matrix. If indicated that the
 *  chosen column (field) values may not be unique, then it returns the entries (objects/row) within
 *  an extra enclosing array, one per each key value - even if there is just one object/row for any key value.
 *  @param {array} records of objects or an object (serving as an associative array) of objects (or of arrays of objects);
 *  it can be a result of SeLite DB Objects - select() or a previous result of SeLiteMisc.collectByColumn().
 *  Therefore any actual values must not be arrays themselves, because then you and
 *  existing consumers of result from this function couldn't tell them from the subindexed arrays.
 *  @param {(array|string)} fieldNames String name of the index key or object field, or function to retrieve a field off an object, that we'll index by; or an array of them. If it's a function  or an array containing function(s) then such function accepts one argument which is the object to be sub-indexed.
 *  @param {boolean} valuesUnique whether the compound index (based on given fieldNames) is guaranteed to have unique values. Otherwise it generates an array for each (set of index) value(s) present. If valuesUnique is true but there are multiple records with the same (set of) index value(s), then only the last record (for any compound index - breadcrumb of index/field values) will be kept here.
 *  @param {Object} result The result object, see description of the return value; optional - if not present, then a new anonymous object is used.
 *  Don't use the same object for records and result.
 *  @return An object serving as an associative array of various structure and depth, depending on the parameters.
 *  In the following, 'entry' means an original entry from records.
 *  If valuesUnique==true:
 *  object {
 *     compound index value => entry
 *     ...
 *  }
 *  If v has one entry and valuesUnique==false:
 *  object {
 *     compound index value => Array( entry... )
 *     ...
 *  }
 *  The result can't be an array, because Javascript arrays must have consecutive
 *  non-negative integer index range. General data doesn't fit that.
 *  Users must not depend on compound index value, since its calculation may change in future. Users can get the compound index value from SeLiteMisc.compoundIndexValue().
 */
SeLiteMisc.collectByColumn= function collectByColumn( records, fieldNames, valuesUnique, result ) {
    typeof fieldNames==='object' || typeof fieldNames==='string' || SeLiteMisc.fail();
    fieldNames= Array.isArray(fieldNames)
        ? fieldNames
        : [fieldNames];
    result= result || {};
    result!==records || SeLiteMisc.fail( 'SeLiteMisc.collectByColumn() requires parameter result not to be the same object as records, if provided.' );
    if( Array.isArray(records) ) { // records is an array, so it's not a result of previous call to this method.
        for( var i=0; i<records.length; i++ ) {
            SeLiteMisc.collectByColumnRecord( records[i], result, fieldNames, valuesUnique );
        }
    }
    else {
        for( var existingIndex in records ) {
            var recordOrGroup= records[existingIndex];
            if( Array.isArray(recordOrGroup) ) { // records was previously indexed with valuesUnique=false. So we're re-indexing it.
                for( var j=0; j<recordOrGroup.length; j++ ) {
                    SeLiteMisc.collectByColumnRecord( recordOrGroup[j], result, fieldNames, valuesUnique );
                }
            }
            else {
                SeLiteMisc.collectByColumnRecord( recordOrGroup, result, fieldNames, valuesUnique );
            }
        }
    }
    return result;
};

/** Generate a compound index value, which represents values of all fieldNames of record, as used by SeLiteMisc.collectByColumn(). If fieldNames contains one field name/function, then the result is a value of that field. Otherwise the result is implementation-specific - don't depend on its actual value.
 *  @param {object} record
 *  @param {array} fieldNames Array of strings - field names within given record.
 *  @return {(string|number)} Value of compound index, as used for keys of result of SeLiteMisc.collectByColumn(). Implementation-specific.
 * */
SeLiteMisc.compoundIndexValue= function compoundIndexValue( record, fieldNames ) {
    if( fieldNames.length===1 ) {
        return SeLiteMisc.getField(record, fieldNames[0]);
    }
    var result= ''; // Concatenation of index values, separated with '-'. In case there are any '-' in any index values, those are doubled - so that the result can be transformed back to the group of index values. An alternative way would be to use JSON.stringify().
    // Side note: I've used null character '\0' instead of '-'. That caused debugging problems, since '\0' doesn't show up in strings on Firefox console or GUI.
    for( var i=0; i<fieldNames.length; i++ ) { //@TODO low: for(.. of.. ) once NetBeans likes it
        result+= ( '' + SeLiteMisc.getField(record, fieldNames[i]) ).replace( '-', '--' )+ '-';
    }
    return result;
}

/** Internal only. Worker function called by SeLiteMisc.collectByColumn().
 *  @param {array} fieldNames This is like the same named parameter of SeLiteMisc.collectByColumn(), but here it must be an array (of strings or functions).
 *  @param {object} result Object (serving as an associative array) for results of indexing at the level of this function.
 **/
SeLiteMisc.collectByColumnRecord= function collectByColumnRecord( record, result, fieldNames, valuesUnique ) {
    var compoundIndexValue= SeLiteMisc.compoundIndexValue( record, fieldNames );
    if( valuesUnique ) {
        result[compoundIndexValue]= record;
    }
    else {
        if( result[compoundIndexValue]===undefined ) {
            result[compoundIndexValue]= [];
        }
        result[compoundIndexValue].push( record );
    }
};

/** Access a direct field on the given record, or evaluate a function on the given record.
 * @private */
SeLiteMisc.getField= function getField( record, columnFieldNameOrFunction ) {
    return typeof columnFieldNameOrFunction==='function'
        ? columnFieldNameOrFunction(record)
        : record[columnFieldNameOrFunction];
};

/** It serves to access (potentially deeper) fields of objects, collecting all entries on the way. Used e.g. when dynamically accessing user-provided class (for its given name), which may be a sub(sub...)field of a namespace object (i.e. having dots in the name).
 * @param {object} object
 * @param {string} fieldNameDotEtc Field name, or multiple field names separated by dot.
 * @param {boolean} [doNotThrow=false] If true then it throws any appropriate errors (e.g. when object is not an object, or fieldNameDotEtc contains dot(s) but some intermediate objects are not present).
 * @param valueInsteadOfThrow
 * @return {(Array|undefined)} [field1Value, field2Value...]; undefined if no such field(s) and if doNotThrow equals to true.
 * @throws If there are no such field(s); not thrown if you set doNotThrow
 * */
SeLiteMisc.cascadeFieldEntries= function cascadeFieldEntries( object, fieldNameDotEtc, doNotThrow, valueInsteadOfThrow ) {
    var result= [];
    // If fieldNameDotEtc contains multiple field names, then after each iteration variable object is one level deeper entry.
    while( true ) {
        if( (typeof object!=='object' || object===null) && doNotThrow ) {
            return valueInsteadOfThrow;
        }
        var indexOfDot= fieldNameDotEtc.indexOf('.');
        if( indexOfDot>=0 ) {
            object= object[ fieldNameDotEtc.substring(0, indexOfDot ) ];
            result.push( object );
            fieldNameDotEtc= fieldNameDotEtc.substring( indexOfDot+1 );
        }
        else {
            result.push( object[fieldNameDotEtc] );
            return result;
        }
    }
};

/** It serves to access (potentially deeper) fields of objects. Used e.g. when dynamically accessing user-provided class (for its given name), which may be a sub(sub...)field of a namespace object (i.e. having dots in the name).
 * @param {object} object
 * @param {string} fieldNameDotEtc Field name, or multiple field names separated by dot.
 * @param {boolean} [doNotThrow=false] If true then it throws any appropriate errors (e.g. when object is not an object, or fieldNameDotEtc contains dot(s) but some intermediate objects are not present).
 * @param {*} valueInsteadOfThrow What to return if a field is an intermediary entry (when evaluating the breadcrumb path) is null/undefined.
 * @return {object} {
 *      keys: [string 
 *      value: (sub..)field of object; undefined if no such field(s) and if doNotThrow equals to true.
 * @throws If there are no such field(s); not thrown if you set doNotThrow
 * */
SeLiteMisc.cascadeField= function cascadeField( object, fieldNameDotEtc, doNotThrow, valueInsteadOfThrow ) {
    var path= SeLiteMisc.cascadeFieldEntries( object, fieldNameDotEtc, doNotThrow, valueInsteadOfThrow );
    return !doNotThrow || path!==valueInsteadOfThrow
        ? path[ path.length-1 ]
        : valueInsteadOfThrow;
};
    
/** Alternate: any - givenField1 - any - givenField2 - ...
 * @param {object|Array} records {
 *    key: {
 *      givenField1: {
 *         deeperKey: {
 *            givenField2: target of any type or deeper object
 *         },
 *         anotherDeeperKey: {
 *            givenField2: target of any type or deeper object
 *         }
 *         ...
 *      }
 *    },
 *    anotherKey: {
 *      ...
 *    }
 * }
 * @param {(Array|string)} fieldNameDotEtcByLevel A (non-empty) array of field names or dot-separated field names (each entry in the array being a breadcrumb-like path), or a (non-empty) string: a field name or dot-separated field names. For any breadcrumbs that contain two or more field names, the result will contain subindexes based on the values of those breadcrumb fields (except for the last field) at each level.
 * @param {number} depth 0-based depth from which this is collecting. If more than 0, then fieldNameDotEtcByLevel[ 0..depth-1 ] are skipped (they're processed at the higher level).
 * @return Have fieldNameDotEtcByLevel with N levels [0..N-1]; then if valuesUnique==true return {
 *    topLevelKey-keyAfterFirstBreadcrumb-...-keyAfterN-2thBreadcrumb: target,
 *    ...
 * }
 * If valuesUnique==false it returns {
 *    topLevelKey-keyAfterFirstBreadcrumb-...-keyAfterN-2thBreadcrumb: [target, ...]
 *    ...
 * }
 * */
SeLiteMisc.collectByColumnFromDeep= function collectByColumnFromDeep( records, fieldNameDotEtcByLevel, valuesUnique, doNotThrow, result, depth ) {
    typeof fieldNameDotEtcByLevel==='object' || typeof fieldNameDotEtcByLevel==='string' || SeLiteMisc.fail( 'Parameter fieldNameDotEtcByLevel must be an object or a string.' );
    fieldNameDotEtcByLevel= Array.isArray(fieldNameDotEtcByLevel)
        ? fieldNameDotEtcByLevel
        : [ fieldNameDotEtcByLevel ];
    fieldNameDotEtcByLevel.length>0 || SeLiteMisc.fail( 'Parameter fieldNameDotEtcByLevel must not be an empty array.' );
    result= result || {};
    result!==records || SeLiteMisc.fail( 'SeLiteMisc.collectByColumnFromDeep() requires parameter result not to be the same object as records, if provided.' );
    depth= depth || 0;
    
    // Iterate by keys of records. This generats 'key-' part of the result index.
    for( var index in records ) {
        var subRecord= SeLiteMisc.cascadeField( records[index], fieldNameDotEtcByLevel[depth], doNotThrow, SeLiteMisc.collectByColumnFromDeep );
        if( subRecord!==SeLiteMisc.collectByColumnFromDeep ) {
            
            if( fieldNameDotEtcByLevel.length>depth+1 ) {
                var subResult= SeLiteMisc.collectByColumnFromDeep( subRecord, fieldNameDotEtcByLevel, valuesUnique, doNotThrow, result, depth+1 );
                
                var indexStringPart= (''+index/*in case index is a number (when records is an array)*/).replace( '-', '--' ) +'-'; //See SeLiteMisc.compoundIndexValue()
                for( var subIndexPart in subResult ) {
                    // Any value of index is iterated over only once, so the following key has no previous subResult assigned
                    result[ indexStringPart+subIndexPart ]= subResult[subIndexPart];
                }
            }
            else {
                result[index]= subRecord;
            }
        }
    }
    return result;
};

/** @param {number} depth Non-negative; If 0, then this returns a shallow copy of records.
 * */
SeLiteMisc.collectFromDepth= function collectFromDepth( records, depth, result ) {
    typeof depth==='number' && depth>=0 || SeLiteMisc.fail( 'Parameter depth must be a non-negative number.' );
    result= result || {};
    typeof result==='object' || SeLiteMisc.fail( 'Parameter result must a an object, if provided.' );
    for( var index in records ) {
        if( depth>0 ) {
            SeLiteMisc.collectFromDepth( records[index], depth-1, result );
        }
        else {
            result[index]= records[index];
        }
    }
    return result;
};

/** Get all ASCII characters that match the given regex.
 *  @param {RegExp} regex Regular expression to match acceptable character(s)
 *  @return {string} containing of all ASCII characters that match
 **/
SeLiteMisc.acceptableCharacters= function acceptableCharacters( regex ) {
    var result= '';
    for( var code=0; code<256; code++ ) {
        var c= String.fromCharCode(code);
        if( c.match(regex) ) {
            result+= c;
        }
    }
    return result;
};

/** @param string acceptableChars String containign acceptable characters.
 *  @return string 1 random character from within acceptableChars
 *  @internal */
SeLiteMisc.randomChar= function randomChar( acceptableChars ) {
    if( acceptableChars.length==0 ) {
        SeLiteMisc.fail( "SeLiteMisc.randomChar() called with empty acceptableChars." );
    }
    // Math.random() returns from within [0, 1) i.e. 0 inclusive, 1 exclusive.
    // But that '1 exclusive' is weighted by the fact that 0.5 rounds up to 1
    var index= Math.round( Math.random()*(acceptableChars.length-1) );
    return acceptableChars[index];
};

/** @param string acceptableChars String containign acceptable characters.
 *  @param number length Length of the result string (possibly 0)
 *  @return string of given length, made of random characters from within acceptableChars
 *  @internal */
SeLiteMisc.randomString= function randomString( acceptableChars, length ) {
    var result= '';
    for( var i=0; i<length; i++ ) {
        result+= SeLiteMisc.randomChar(acceptableChars);
    }
    return result;
};

/** This picks up a random item from the given array, and returns it.
 *  @param array Array of items
 *  @return mixed An item from within the array, at a random index
 **/
SeLiteMisc.randomItem= function randomItem( items ) {
    var index= Math.round( Math.random()*(items.length-1) );
    return items[index];
};

/** A helper function, so that custom Selenium actions can store results within
 *  fields/subfields of storedVars.
 *  @param object Object containing the field (its value must be an object, if there's another field)
 *  @param string fieldsString Field name(s), separated by one dot between each. The first one points to a field
 *  within object. Its value must be an object again if there are any further field(s); then apply those fields.
 *  Any intermediary object(s) must exist; this function won't create them if they're missing, and it will fail.
 *  @param mixed value Value to set to the leaf field.
 *  @return void
 **/
SeLiteMisc.setFields= function setFields( object, fieldsString, value ) {
    var fields= fieldsString.split('.');

    for( var i=0; i<fields.length; i++ ) {
        if( i==fields.length-1 ) {
            object[ fields[i] ]= value;
        }
        else {
            object= object[ fields[i] ];
        }
    }
};

/** This returns random true or false, with threshold being the (average) ratio of true results against
 *  the number of all results.
 **/
SeLiteMisc.random= function random( threshold ) {
    return Math.random()<=threshold;
};

/** Escape a given string (possibly containing ' and/or ") to use in XPath expressions (e.g. used for element locators).
 *  @param {string} string
 *  @return {string} String literal for XPath expressions, with enclosing ' or ". If both ' and " are present in given <code>string</code>, then this returns a string that contains a call to concat(), with the parts of the given string enclosed with either ' or ".
 **/
SeLiteMisc.xpath_escape_quote= function xpath_escape_quote( string ) {
    if( string.indexOf("'")>=0 ) {
        if( string.indexOf('"')<0 ) {
            return '"' +string+ '"';
        }
    }
    else {
        return "'" +string+ "'";
    }
    // The string contains both a quote and an apostrophe. So I'll split in parts and will generate an expression containing concat()
    var parts= string.split( /(['"])/ );
    var resultParts= []; // This will contain a multiply of 3 items, each group being:
                        // quote char - one of' or "; substring (not containing the quote char); same quote char
    for( var i=0; i<parts.length; i++ ) {
        var part= parts[i];
        var resultIndex= resultParts.length-3;
        if( part==='"' || part==="'" ) {
            if( resultParts.length===0 || resultParts[resultIndex]!==part ) {
                // The first special character in string, or change of the special character
                var quoteChar= part==='"' ? "'" : '"';
                resultParts.push( quoteChar, '', quoteChar );
            }
            else {
                assert( resultParts[resultIndex]===part );
                resultParts[ resultIndex+1 ]+= part;
            }
        }
        else {
            resultParts[ resultIndex+1 ]+= part;
        }
    }
    return 'concat(' +resultParts.join(',')+ ')';
};

SeLiteMisc.unescape_xml= function unescape_xml( param ) {
    return param!==null
        ? (typeof param==='string' ? param : ''+param)
         .replace( /&amp;/g, '&' )
         .replace( /&lt;/g, "<")
         .replace( /&gt;/g, ">")
         .replace( /&quot/g, '"')
         .replace( /&apos;/g, "'" )
        : null;
};

/*  @param object prototype Optional; Instance of SeLiteMisc.PrototypedObject or of same subclass as is the class of the
 *  object being created, or its parent class (a subclass of SeLiteMisc.PrototypedObject). That instance serves as the prototype for the new object.
 *  Any enumerable fields set in prototype (including those set to null) will be inherited (copied) at the time of calling this constructor.
 *  Any later changes to prototype object won't be reflected. To inherit from this class
 *  - the subclass constructor should: SeLiteMisc.PrototypedObject.call( this, prototype );
 *  - after defining the subclass constructor (e.g. MyClass) set:
 *  -- MyClass.prototype= Object.create( ParentClass.prototype ); // or: Object.create( SeLiteMisc.PrototypedObject.prototype ) for 1st level children
 *  -- MyClass.prototype.constructor= MyClass;
 *  See https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance
 *  and also https://developer.mozilla.org/en/JavaScript/Guide/Inheritance_Revisited
 *  The above can be used outside of Selenium-based components - it works in Chrome, Safari, Opera, IE (as of Nov 2012).
 *  However, I haven't tested functionality of SeLiteMisc.PrototypedObject() outside of Firefox.
 **/
SeLiteMisc.PrototypedObject= function PrototypedObject( prototype ) {
    if( prototype ) { 
        assert( this instanceof prototype.constructor, prototype.constructor.name+
            " inherits from SeLiteMisc.PrototypedObject, whose constructor only accepts an object of the same class as a parameter." );
        for( var field in prototype ) {
            this[field]= prototype[field];
        }
    }
};

/** @param mixed recordSet A SeLiteData.RecordSet instance
 *  or some other object serving as an associative array,
 *  potentially a result of SeLiteMisc.collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of SeLiteData.Record - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @param int position 0-based position of the value to return
 *  @return object the leaf record
 *  @throws Exception if position is negative, decimal or higher than the last available position
 **/
SeLiteMisc.nthRecord= function nthRecord( recordSet, position ) {
    position>=0 || SeLiteMisc.fail( "SeLiteMisc.nthRecord() requires non-negative position, but it was: " +position);
    return nthRecordOrLengthOrIndexesOf( recordSet, NTH_RECORD, position );
};

/** @param mixed recordSet A SeLiteData.RecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of SeLiteMisc.collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of SeLiteData.Record - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @int number of leaf records
 */
SeLiteMisc.numberOfRecords= function numberOfRecords( recordSet ) {
    return nthRecordOrLengthOrIndexesOf( recordSet, NUMBER_OF_RECORDS );
};

/** @param mixed recordSet A SeLiteData.RecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of SeLiteMisc.collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of SeLiteData.Record - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @param record object, record to search for.
 *  @return int 0-based index of that record if found,-1 otherwise.
 */
SeLiteMisc.indexOfRecord= function indexOfRecord( recordSet, record ) {
    return nthRecordOrLengthOrIndexesOf( recordSet, INDEX_OF_RECORD, record );
};

/** Acceptable values of parameter action for nthRecordOrLengthOrIndexesOf()
 * */
var NTH_RECORD= 'NTH_RECORD', NUMBER_OF_RECORDS='NUMBER_OF_RECORDS', INDEX_OF_RECORD= 'INDEX_OF_RECORD';

/** @private Implementation of SeLiteMisc.nthRecord() and SeLiteMisc.numberOfRecords() and SeLiteMisc.indexOfRecord(). Multi-purpose function
 *  that iterates over indexed (and optionally sub-indexed) records.
 *  @param mixed recordSet just like the same parameter in SeLiteMisc.nthRecord() and SeLiteMisc.numberOfRecords()
 *  @param string action Determines the purpose and behavious of calling this function. action must be one of:
 *  NTH_RECORD, NUMBER_OF_RECORDS, INDEX_OF_RECORD.
 *  @param mixed positionOrRecord Either
 *  -- number, 0-based position across the indexed or indexed and subindexed tree, as iterated by Javascript
 *  (which doesn't guarantee same order on every invocation); or
 *  -- object, record to search for
 *  @return mixed
 *  -- if action==NTH_RECORD then it returns a record at that position
 *  -- if action==NUMBER_OF_RECORDS, then it returns a total number of records
 *  -- if action==INDEX_OF_RECORD, then it returns an array with indexes of the given record, if found. Precisely:
 *  --- [index, subindex] if the record is found and subindexed
 *  --- [index] if the record is found and indexed, but not subindexed
 *  --- [] if the record is not found
 *  @throws Error on failure, or if action=NTH_RECORD and positionOrRecord is equal to or higher than number of records
 **/
function nthRecordOrLengthOrIndexesOf( recordSet, action, positionOrRecord ) {
    SeLiteMisc.ensureType( recordSet, 'object', 'recordSet' );
    SeLiteMisc.ensureType( positionOrRecord, ['number', 'object', 'undefined'], 'positionOrRecord' );
    SeLiteMisc.ensureOneOf( action, [NTH_RECORD, NUMBER_OF_RECORDS, INDEX_OF_RECORD], 'action' );
    
    // Following three booleans reflect what we're doing.
    var nthRecord= action===NTH_RECORD;
    var indexOfRecord= action===INDEX_OF_RECORD;
    var numberOfRecords= action===NUMBER_OF_RECORDS;
    
    var position= nthRecord
        ? positionOrRecord
        : undefined;
    var record= indexOfRecord  
        ? positionOrRecord
        : undefined;
    
    SeLiteMisc.ensureType( record, ['object', 'undefined'], 'record' );
    SeLiteMisc.ensureType( position, ['number', 'undefined'], 'position' );
    
    if( nthRecord && (position<0 || position!=Math.round(position) ) ) {
        throw new Error( "nthRecordOrLengthOrIndexesOf() requires non-decimal non-negative position, but it was: " +position);
    }
    var currPosition= 0; // only used when nthRecord is true
    for( var index in recordSet ) {
        var entry= recordSet[index];
        if( Array.isArray(entry) ) {
            if( indexOfRecord ) {
                var foundSubPosition= recordSet.indexOf( record );
                if( foundSubPosition>=0 ) {
                    return [index, foundSubPosition];
                }
            }
            else
            if( nthRecord && position-currPosition<entry.length ) {
                return entry[ position-currPosition ];
            }
            currPosition+= entry.length;
        }
        else {
            if( indexOfRecord && entry===positionOrRecord ) {
                return [index];
            }
            if( nthRecord && currPosition===positionOrRecord ) {
                return entry;
            }
            currPosition++;
        }
    }
    if( indexOfRecord ) {
        return [];
    }
    else
    if( numberOfRecords ) {
        return currPosition;
    }
    else {
        throw new Error( 'nthRecordOrLengthOrIndexesOf(): There is no item at position ' +position+
            ' (starting from 0). The highest position is ' +currPosition );
    }
};

var EXPORTED_SYMBOLS= ['SeLiteMisc'];