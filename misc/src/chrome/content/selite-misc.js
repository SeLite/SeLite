/*  Copyright 2011, 2012, 2013 Peter Kehl
    This file is part of SeLite Misc.

    SeLite Miscellaneous is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Miscellaneous is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Miscellaneous.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol=='chrome:');
// runningAsComponent is false when loaded via <script src="file://..."> or <script src="http://..."> rather than via Components.utils.import().
// Used for debugging; limited (because when it's not loaded via Components.utils.import() it can't access other components).
if( runningAsComponent ) {
    var loginManagerInstance = Components.classes["@mozilla.org/login-manager;1"].
        getService(Components.interfaces.nsILoginManager);
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
}
/** This throws an error (containg the given message, if any). It also logs the current stack trase to console as a warning.
*/
function fail( message ) {
    try {
        throw message
            ? new Error(message)
            : new Error();
    }
    catch(e) {
        console.warn( e.stack );
        throw e;
    }
}

/** This asserts the condition to be true (compared non-strictly). If false, it fails with an error (containg the given message, if any).
 *  It's not called assert(), so that wouldn't conflict with assert() defined by Selenium IDE.
 *  @param bool condition If false, then this fails.
 *  @param string message Optional; see fail(). Note that if you pass a non-constant expression
 *   - e.g. concatenation of strings, a call to a function etc.,
 *  it has to be evaluated before ensure() is called, even if it's not used (i.e. condition is true).
 *  Then you may want to chose to use:
 *  <code>
 *      condition || fail( message expression );
 *  </code>
 *  instead. That evaluates message expression only if condition is not true.
 *  On the other hand, if you have message ready anyway (e.g. a constant string or a value received as a parameter from a caller function),
 *  then by using ensure(..) you make your intention clearer.
 * */
function ensure( condition, message ) {
    if( !condition ) {
        fail( message );
    }
}

function ensureOneOf( item, choices, message ) {
    Array.isArray(choices) || fail( 'ensureOneOf() expects choices to be an array');
    ensure( choices.indexOf(item)>=0, message );
}

/** Validates that typeof item is one of 
 *  @param item mixed
 *  @param typeStringOrStrings string, one of: 'number', 'string', 'object', 'function', 'boolean', 'undefined'
 *  @param message string Message to produce on validation failure, optional.
 * */
function ensureType( item, typeStringOrStrings, message ) {
    message= message || '';
    if( !Array.isArray(typeStringOrStrings) ) {
        if( typeof typeStringOrStrings!=='string' ) {
            fail( 'typeStringOrStrings must be a string or an array');
        }
        typeStringOrStrings= [typeStringOrStrings];
    }
    for( var i=0; i<typeStringOrStrings.length; i++ ) {
        ensureOneOf( typeStringOrStrings[i], ['number', 'string', 'object', 'function', 'boolean', 'undefined'] );
        if( typeof item===typeStringOrStrings[i] ) {
            return;
        }
    }
    fail( message+ ' Expecting type from within [' +typeStringOrStrings+ '], but the actual type of the item is ' +typeof item+ '. The item: ' +item );
}

/** Validate that a parameter is an object and of a given class (or of one of given classes).
    Until https://bugzilla.mozilla.org/show_bug.cgi?id=934311 gets resolved,
    this only works for standard JS classes if 'object' was instantiated in the same JS module as where elements of 'classes' come from.
    That is, Array, String etc. are different in various JS modules.
 *  @param object Object
 *  @param classes Class (that is, a constructor function), or an array of them.
 *  Do not use for standard classes like Object or Array, because they are separate per each global scope
 *  (and each Javascript module has its own). See a list of them at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects.
 *  If we need that, then accept Array etc; then check whether the given class (constructor) contains function 'isArray'; if so, then use Array.isArray().
 *  Or (less intuitive): accept strings like "Array" and map them to a check function like Array.isArray.
 *  @param className string, optional, name of the expected class(es), so we can print them (because parameter classes doesn't carry information about the name);
 *  even if clazz is an array, clazzName must be one string (if present),
 *  @param message string, extra message, optional
 * */
function ensureInstance( object, classes, className, message ) {
    message= message || '';
    typeof object==='object' || fail( 'Expecting an '
        +(className
            ? 'instance of ' +className
            : 'object'
        )+ ', but ' +typeof object+ ' was given. ' +message );
    if( typeof classes==='function' ) {
        classes= [classes];
    }
    else {
        ensure( Array.isArray(classes), "Parameter clases must be a constructor method, or an array of them." );
    }
    for( var i=0; i<classes.length; i++ ) {//@TODO use loop for of() once NetBeans supports it
        ensureType( classes[i], 'function' );
        if( object instanceof classes[i] ) {
            return;
        }
    }
    fail( 'Expecting an instance of '
        +(className
            ? className
            : 'specific class(es)'
        )+ ", but an instance of a different class was given. " +message );
}

/** @param mixed Container - object or array
 *  @param mixed Field - string field name, or integer/integer string index of the item
 *  @param Any further parameters are treated as chained 'subfields' - useful for traversing deeper array/object/mixed structures
 *  @return mixed The item. It returns an empty string if not found or if the actual item is null - that is benefitial
 *  when using this function in parameters to Selenium actions (which fail if passing null).
 **/
function item( container, field, fieldAnother, fieldYetAnother ) {
    return itemGeneric( arguments, '', '' );
}

/** Just like item(...), but nulls are not translated at all.
 **/
function itemOrNull( container, field, fieldAnother, fieldYetAnother ) {
    return itemGeneric( arguments, null, null );
}

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
function itemGeneric( containerAndFields, nullReplacement, targetNullReplacement ) {
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
        if( item instanceof Array ) {
            if( typeof field !=='number' ) { // It may be a numeric string
                field= new Number(field);
                if( isNaN(field) ) {
                    return nullReplacement;
                }
                field= field.valueOf();
            }
            if( field<0 || field>item.length || field!=Math.round(field) ) {
                return nullReplacement;
            }
            item= item[field];
        }
        else
        if( typeof item ==='object' && item[field]!==undefined ) {
            item= item[field];
        }
        else {
            return nullReplacement;
        }
    }
    return item!==null
        ? item
        : targetNullReplacement;
}

var OBJECT_TO_STRING_INDENTATION= "  ";

/** Get a simple string representation of the given object/array. Used for debugging.
 *  @param object object to present
 *  @param int recursionDepth How many deeper layers of objects/arrays to show details of; 0 by default (no deeper objects).
 *  @param bool includeFunctions Whether to include functions; false by default.
 *  @param array leafClassNames Names of classes (that would match [sub[sub...]]object.constructor.name) that are excluded from deeper recursive processing.
 *  Use 'Object' to exclude listing of fields of anonymous objects. E.g. ['MyBigClass', 'Object' ] will not list any fields of instances of MyBigClass or anonymous objects.
 *  Use '' for some internal Firefox/XUL/XPCOM? objects.
 *  @param array higherObjects Optional; array of objects/arrays that are being processed by the direct/indirect caller of this function
 *  (i.e. recursive array/object reference). For internal use only - only set when this function calls itself recursively.
 *  @return string
 */
function objectToString( object, recursionDepth, includeFunctions, leafClassNames, higherObjects ) {
    if( typeof object!=='object' || object===null ) {
        return ''+object;
    }
    leafClassNames= leafClassNames || [];
    higherObjects= higherObjects || [];
    higherObjects.push(object);
    var isLeafClass= leafClassNames.indexOf(object.constructor.name)>=0;
    var result= '';
    if( !isLeafClass ) {
        if( object instanceof Array ) {
            for( var j=0; j<object.length; j++ ) {
                result+= objectFieldToString( object, j, recursionDepth, includeFunctions, leafClassNames, higherObjects, result=='' );
            }
        }
        else {
            for( var field in object ) {
                result+= objectFieldToString( object, field, recursionDepth, includeFunctions, leafClassNames, higherObjects, result=='' );
            }
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
    if( object instanceof Array ) {
        var resultPrefix= 'array';
    }
    else {
        var resultPrefix= object.constructor.name!==''
            ? 'object '+object.constructor.name
            : 'object of unknown class';
    }
    result= resultPrefix+ " {" +result+ "}"
    return result;
}

/*** @private/internal
 */
function objectFieldToString( object, field, recursionDepth, includeFunctions, leafClassNames, higherObjects, firstItem ) {
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
            result+= '[Recursive ref. to ' +(object[field] instanceof Array ? 'array ' : 'object ')+
                (higherObjects.length-higherObjectLevel) + ' level(s) above.]';
        }
        else
        if( typeof object[field]==='object' && recursionDepth>0 ) {
            result+= objectToString( object[field], recursionDepth-1, includeFunctions, leafClassNames, higherObjects );
        }
        else {
            if( object[field] instanceof Array ) {
                result+= object[field].length ? '[array of ' +object[field].length+ ' elements]' : '[empty array]';
            }
            else {
                result+= object[field];
            }
        }
        return result;
}

/** Get string representation of the given matrix or given array of objects.
 *  @param mixed rows Array of objects, or object of objects.
 *  @param bool includeFunctions Whether to include functions; false by default.
 *  includeFunctions only applies to inner objects; no functions of rows itself
 *  are included at all.
 *  @return string
 *  Used for debugging.
 **/
function rowsToString( rows, includeFunctions ) {
    var resultLines= [];
    if( rows instanceof Array ) {
        for( var i=0; i<rows.length; i++ ) {
            resultLines.push( objectToString( rows[i], includeFunctions ) );
        }
    }
    else {
        for( var field in rows ) {
            if( typeof rows[field]=='function' ) {
                continue;
            }
            resultLines.push( '' +field+ ' => ' +objectToString( rows[field], includeFunctions ) );
        }
    }
    return resultLines.join( "\n" );
}

/** @return number Number of seconds since Epoch.
 **/
function timestampInSeconds() {
    return Math.round( Date.now()/1000 );
}

/** @return true if the object is empty (no fields availabel to iterate through); false otherwise.
 *  @throws Error if the parameter is not an object.
 **/
function isEmptyObject( obj ) {
    ensureType( obj, "object", 'Parameter of isEmptyObject() must be an object.' );
    for( var field in obj ) {
        return false;
    }
    return true;
}

/** Compare all fields of both given objects.
 *  @param firstContainer object (not a 'primitive' string)
 *  @param secondContainer object (not a 'primitive' string)
 *  @param mixed strictOrMethodName Bool or a string. Boolean false by default.
 *  - if true, it compares with strict operator ===
 *  - if false, it compares using non-strict using ==
 *  - if string, it's a name of a method (not the method itself) to call on each field,
 *    unless both are null (compared using strict ===) or unless first or second is not an object.
 *    If both objects are null, then they are deemed to be equal and the method is not called.
 *  @param boolean throwOnDifference Whether to throw an error if different
 *  @return boolean Whether both objects have same fields and their values
 * */
function compareAllFields( firstContainer, secondContainer, strictOrMethodName, throwOnDifference ) {
    strictOrMethodName= strictOrMethodName || false;
    var strict= typeof strictOrMethodName=='boolean' && strictOrMethodName;
    var methodName= typeof strictOrMethodName=='string'
        ? strictOrMethodName
        : false;
    try {
        ensureType( firstContainer, 'object', 'compareAllFields() requires firstContainer to be an object');
        ensureType( secondContainer, 'object', 'compareAllFields() requires secondContainer to be an object');
        compareAllFieldsOneWay( firstContainer, secondContainer, strict, methodName );
        compareAllFieldsOneWay( secondContainer, firstContainer, strict, methodName );
    }
    catch( exception ) {
        if( throwOnDifference ) {
            throw exception;
        }
        return false; // This is not very efficient, but it makes the above code and compareAllFieldsOneWay()
        // more readable than having if(throOnDifference) check multipletimes above
    }
    return true;
}

/** Compare whether all fields from firstContainer exist in secondContainer and are same. Throw an error if not.
 *  See compareAllFields().
 *  @return void
 * */
function compareAllFieldsOneWay( firstContainer, secondContainer, strict, methodName ) {
    for( var fieldName in firstContainer ) { // for() works if the container is null
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
            if( !strict && first!=second ||  strict && first!==second ) {
                throw new Error();
            }
        }
    }
}

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
                    throw new Error("sortedObject() and sortedObjectProxyHandler require sortCompare to be a function, if set, but it is " +typeof sortCompare+ ': ' +sortCompare);
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
 * @param mixed sortCompare Either
 * - a function for auto-ordering
 * - bool true if it should auto-order by compareNatural
 * - false to just honour client-given order (not working for now - it will honour the order, but not for e.g. mixed negative/positive numeric keys)
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
   is boolean true, then it uses natural sorting - see compareNatural().
// See http://stackoverflow.com/questions/648139/is-the-order-of-fields-in-a-javascript-object-predictable-when-looping-through-t
// and https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators
I don't subclass Proxy - because it didn't work - the handler functions were not called.
Also, in order to subclass Proxy, my constructor had to invoke Proxy.constructor.call(this, target, sortedObjectProxyHandler).
 */
function sortedObject( sortCompare ) {
    if( sortCompare===undefined ) {
        sortCompare= false;
    }
    if( sortCompare===true ) {
        sortCompare= compareNatural;
    }
    if( sortCompare && typeof sortCompare!=='function' ) {
        throw new Error("SortedObect() requires parameter sortCompare to be a function or boolean, if specified.");
    }
    var target= new SortedObjectTarget( sortCompare );
    return target;
    //return new Proxy( target, sortedObjectProxyHandler );
    //return  new SortedObjectProxy( target, sortedObjectProxyHandler );
}

function SortedObjectTarget( sortCompare ) {
    Object.defineProperty( this, SELITE_MISC_SORTED_OBJECT_COMPARE, {
      enumerable: false, configurable: false, writable: false,
      value: sortCompare
    });
    /*Object.defineProperty( target, SELITE_MISC_SORTED_OBJECT_KEYS, {
      enumerable: false, configurable: false, writable: false,
      value: []
    });*/
}

SortedObjectTarget.prototype.__iterator__= function() {
    var i=0;
    var keys= Object.keys(this);
    if( this[SELITE_MISC_SORTED_OBJECT_COMPARE] ) {
        keys.sort( this[SELITE_MISC_SORTED_OBJECT_COMPARE] );
    }
    return {
        next: function() {
            if(i<keys.length) {
                return keys[i++];
            }
            throw StopIteration;
        }
    }
};
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
SortedObjectTarget.prototype.__iterator__= function() {
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
    ensure( Array.isArray(this[SELITE_MISC_ITERABLE_ARRAY_KEYS]), "IterableArray(keys) expects keys to be an array, or undefined." );
    this.watch( SELITE_MISC_ITERABLE_ARRAY_KEYS, IterableArrayKeysWatchThrow );
}
IterableArray.prototype.__iterator__= function() {
    for( var i=0; i<this[SELITE_MISC_ITERABLE_ARRAY_KEYS].length; i++ ) {
        yield this[SELITE_MISC_ITERABLE_ARRAY_KEYS][i];
    }
}

/** Sort fields in object by keys (keys are always strings).
 *  @param object object serving as an associative array
 *  @param function compareFunction Function that compares two keys. Optional; by default case-sensitive string comparison.
 *  @return new anonymous object serving as an associative array, with all fields and values from object, but in the sorted order
 *  @TODO remove, replace by sortedObject()
 * */
function sortByKeys( object, compareFunction ) {
    if( !compareFunction ) {
        compareFunction= undefined;
    }
    var fieldNames= [];
    for( var name in object ) {//@TODO name is a string, even if the value were integer
        fieldNames.push(name);
    }
    fieldNames.sort( compareFunction );
    var result= new IterableArray( fieldNames );
    for( var i=0; i<fieldNames.length; i++ ) {
        var name= fieldNames[i];
        result[ name ]= object[ name ];
    }
    return result;
}

/** @return a negative, 0 or positive number, depending on whether first is less
 *  than, equal to or greater than second, in case insensitive dictionary order.
 *  Use as a second parameter to array.sort().
 *  This doesn't expects first and second to be string. That is true for object field names (keys),
 *  even if they were declared using a number/boolean/false. Meaning
 *  var o={ false:0, null:-1, 5: 5 }
 *  for( var field in o ) { // typeof field is string. It's strictly equal to 'false' or 'null' or '5'
 *  }
 *  So you can pass this function as a second parameter to sortByKeys() with no other checks.
 * */
function compareCaseInsensitively( first, second ) {
    var firstLower= first.toLowerCase();
    var secondLower= second.toLowerCase();
    return firstLower===secondLower
        ? 0
        : (firstLower<secondLower
            ? -1
            : +1
          );
}

/** Like compareCaseInsensitively(), but for numbers.
 *  Don't use first-second, because that can overrun integer type limits.
 *  @param mixed number or numeric string first
 *  @param mixed number or numeric string second
 * */
function compareAsNumbers( first, second ) {
    first= Number(first); // This works if it is already a number
    second= Number(second);
    return first===second
        ? 0
        : (first<second
            ? -1
            : 1
          );
}

/** A blend of compareCaseInsensitively() and compareAsNumbers().
 *  Non-numeric strings are sorted case insensitively. Numbers are sorted among themselves. Numbers will be before non-numeric strings.
 *  @return a negative, 0 or positive number, depending on whether first is less
 *  than, equal to or greater than second, in the order as described above.
 * */
function compareNatural( first ,second ) {
    var firstNumber= Number(first); // This works if it is already a number
    var secondNumber= Number(second);
    
    if( !isNaN(firstNumber) && !isNaN(secondNumber) ) {
        return firstNumber===firstNumber
            ? 0
            : (firstNumber<firstNumber
                ? -1
                : +1
              );
    }
    return compareCaseInsensitively( first, second );
}

/** @return an anonymous object, which has all fields from obj, and any
    extra fields from overriden. If the same field is in both obj and overriden,
    then the value from obj is used.
*/
function objectsMerge( obj, overriden ) {
    var result= {};
    var field= null;
    if( obj!=null ) {
        objectCopyFields( obj, result );
    }
    if( overriden!=null ) {
        for( field in overriden ) {
            if( !(field in result) ) {
                result[field]= overriden[field];
            }
        }
    }
    return result;
}

/** Copy all and any  fields (iterable ones) from source object to target object.
 *  If a same field exists in target object, it will be overwritten.
 *  @return object target
 **/
function objectCopyFields( source, target ) {
    for( var field in source ) {
        target[field]= source[field];
    }
    return target;
}

/** This makes a shallow clone of a given object. If the original object had a prototype,
 *  then this uses it, too - any fields of the protype won't be copied, but will be referenced.
 *  The new object is based on a plain object {}, so if the original object was created
 *  using a constructor function, the result object won't be; therefore operator instanceof
 *  will return false for the result object.
 *  @param object original The original object.
 *  @param array acceptableFields optional; if present, then it contains the only fields
 *  that will be copied (if present in original). If acceptableFields is not present/empty,
 *  then any fields are copied.
 *  @param mixed requiredFields Array of fields that are required to exist in original
 *  (even though their value may be null). If requiredFields==='all' (as a string), then
 *  it will be set to be the same as acceptableFields
 *  See https://developer.mozilla.org/en/JavaScript/Reference/Operators/Operator_Precedence
 **/
function objectClone( original, acceptableFields, requiredFields, result ) {
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
            throw "objectClone(): Field " +requiredFields[i]+ " is required, but it's not present in the original.";
        }
    }
    for( var field in original ) {
        if( acceptableFields.length==0 || acceptableFields.indexOf(field)>=0 ) {
            result[field]= original[field];
        }
    }
    return result;
}

/** This deletes all iterable fields from the given object.
 *  @return obj
 **/
function objectDeleteFields( obj ) {
    for( var field in obj ) {
        delete obj[field];
    }
    return obj;
}

function arrayClone( arr ) { return arr.slice(0); }

/** @return an anonymous object, which has all values from obj as keys, and their
 *  respective original keys (field names) as values. If the same value is present for two or more
 *  fields in the original object, then it will be mapped to name of one of those fields (unspecified).
 *  If a value is not a string, it's appended to an empty string (i.e. its toString() will be used, or 'null').
 **/
function objectReverse( obj ) {
    var result= {};
    for( var field in obj ) {
        var value= obj[field];
        if( typeof value !=='string' ) {
            value= '' +value;
        }
        result[ value ]= field;
    }
    return result;
}

/** @return mixed
 *  - if asObject is false: Return an array containing values of all iterable fields in the given object.
        Any values from obj occurring more than once (in obj) will be in the result array as many times.
    - if asObject is true, return an anonymous object with those values being keys in the result object, mapped to a number
        of occurrences of this value in the original object. Values of the original object are converted to strings by
        appending them to an empty string. Indeed, values of different type may map to the same string.
 **/
function objectValues( obj, asObject ) {
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
}

/** @return string field name for the given value, or null. If there are several such
 *  fields, this will return one of them (unspecified which one).
 *  @param object obj Object to search the value in.
 *  @param mixed value Value to search in the given object.
 *  @param bool strict Whether to compare strictly (using ===); false by default.
 **/
function objectValueToField( obj, value, strict ) {
    for( var field in obj ) {
        if( value==obj[field] && (!strict || value===obj[field]) ) {
            return field;
        }
    }
    return null;
}

/** This collects entries (objects or arrays i.e. rows) from an array of associative arrays (i.e. objects), by given field/column.
 *  It returns those entries indexed by value of that given column/field, which becomes a key in the result
 *  array/matrix. If indicated that the
 *  chosen column (field) values may not be unique, then it returns the entries (objects/row) within
 *  an extra enclosing array, one per each key value - even if there is just one object/row for any key value.
 *  @param array of objects or an object (serving as an associative array) of objects (or of arrays of objects);
 *  it can be a result of SeLite DB Objects - select() or a previous result of collectByColumn().
 *  Therefore any actual values must not be arrays themselves, because then you and
 *  existing consumers of result from this function couldn't tell them from the subindexed arrays.
 *  @param mixed columnorfieldname String name of the index key or object field, that we'll index by;
 *  or a function that returns value of such a field/key. The function accepts 1 argument which is the object to be indexed.
 *  @param bool columnvaluesunique whether the given column (field) is guaranteed to have unique values
 *  @param mixed subindexcolumnorfieldname String, if passed, then the records will be sub-indexed by value of this column/field.
 *  It only makes sense (and is used) if columnvaluesunique==false. If used then its values should be guaranteed to be unique
 *  within the rows for any possible value of the main index; otherwise only the last record (for given sub-index value) will be kept here.
 *  Or a function that returns value of such a field/key. The function accepts 1 argument which is the object to be sub-indexed.
 *  @param object result The result object, see description of @return; optional - if not present, then a new anonymous object is used.
 *  Don't use same object as records.
 *  @return An object serving as an associative array of various structure and depth, depending on the parameters.
 *  In the following, 'entry' means an original entry from records.
 *  If columnvaluesunique==true:
 *  object {
 *     index value => entry
 *     ...
 *  }
 *  If columnvaluesunique==false and subindexcolumnorfieldname==null:
 *  object {
 *     index value => array( entry... )
 *     ...
 *  }
 *  If columnvaluesunique==false and subindexcolumnorfieldname!=null
 *  object {
 *     index value => object {
 *        subindex value => entry
 *        ...
 *     }
 *     ...
 *  }
 *  The result can't be an array, because Javascript arrays must have consecutive
 *  non-negative integer index range. General data doesn't fit that.
 */
function collectByColumn( records, columnorfieldname, columnvaluesunique,
subindexcolumnorfieldname, result ) {
    result= result || {};
    if( records instanceof Array ) { // The records were not a result of previous call to this method.
        
        for( var i=0; i<records.length; i++ ) {
            var record= records[i];
            collectByColumnRecord( record, result, columnorfieldname, columnvaluesunique,
                subindexcolumnorfieldname );
        }
    }
    else {
        for( var existingIndex in records ) {
            var recordOrGroup= records[existingIndex];
            
            if( recordOrGroup instanceof Array ) { // records was previously indexed by non-unique column and without sub-index
                for( var j=0; j<recordOrGroup.length; j++ ) {
                    collectByColumnRecord( recordOrGroup[j], result, columnorfieldname, columnvaluesunique,
                    subindexcolumnorfieldname );
                }
            }
            else {
                if( recordOrGroup instanceof RecordGroup ) { // Records were previously indexed by non-unique columnd and using sub-index
                    for( var existingSubIndex in recordOrGroup ) {
                        collectByColumnRecord( recordOrGroup[existingSubIndex], result, columnorfieldname, columnvaluesunique,
                            subindexcolumnorfieldname );
                    }
                }
                else {
                    collectByColumnRecord( recordOrGroup, result, columnorfieldname, columnvaluesunique,
                        subindexcolumnorfieldname );
                }
            }
        }
    }
    return result;
}

/** This groups sub-indexed records. I can't use an anonymous object, because then I couldn't
 *  distinguish it from user record objects, when running collectByColumn() on the previous result of collectByColumn().
 **/
function RecordGroup() {}

/** Internal only. Worker function called by collectByColumn().
 **/
function collectByColumnRecord( record, result, columnorfieldname, columnvaluesunique,
subindexcolumnorfieldname ) {
    var columnvalue= getField( record, columnorfieldname );
    if( columnvaluesunique ) {
        result[columnvalue]= record;
    }
    else {
        if( result[columnvalue]===undefined ) {
            result[columnvalue]= subindexcolumnorfieldname
                ? new RecordGroup()
                : [];
        }
        if( subindexcolumnorfieldname ) {
            var subindexvalue= getField(record, subindexcolumnorfieldname);
            if( subindexvalue===undefined ) {
                subindexvalue= null;
            }
            result[columnvalue][subindexvalue]= record;
        }
        else {
            result[columnvalue].push( record );
        }
    }
}

function getField( record, columnFieldNameOrFunction ) {
    return typeof columnFieldNameOrFunction==='function'
        ? columnFieldNameOrFunction(record)
        : record[columnFieldNameOrFunction];
}

/** Get all ASCII characters that match the given regex.
 *  @param RegExp regex Regular expression to match acceptable character(s)
 *  @return string containing of all ASCII characters that match
 **/
function acceptableCharacters( regex ) {
    var result= '';
    for( var code=0; code<256; code++ ) {
        var c= String.fromCharCode(code);
        if( c.match(regex) ) {
            result+= c;
        }
    }
    return result;
}

/** @param string acceptableChars String containign acceptable characters.
 *  @return string 1 random character from within acceptableChars
 *  @internal */
function randomChar( acceptableChars ) {
    if( acceptableChars.length==0 ) {
        LOG.error( "randomChar() called with empty acceptableChars." );
        throw new Error();
    }
    // Math.random() returns from within [0, 1) i.e. 0 inclusive, 1 exclusive.
    // But that '1 exclusive' is weighted by the fact that 0.5 rounds up to 1
    var index= Math.round( Math.random()*(acceptableChars.length-1) );
    return acceptableChars[index];
}

/** @param string acceptableChars String containign acceptable characters.
 *  @param number length Length of the result string.
 *  @return string of given length, made of random characters from within acceptableChars
 *  @internal */
function randomString( acceptableChars, length ) {
    var result= '';
    for( var i=0; i<length; i++ ) {
        result+= randomChar(acceptableChars);
    }
    return result;
}

/** This picks up a random item from the given array, and returns it.
 *  @param array Array of items
 *  @return mixed An item from within the array, at a random index
 **/
function randomItem( items ) {
    var index= Math.round( Math.random()*(items.length-1) );
    return items[index];
}

/** A helper function, so that custom Selenium actions can store results within
 *  fields/subfields of storedVars.
 *  @param object Object containing the field (its value must be an object, if there's another field)
 *  @param string fieldsString Field name(s), separated by one dot between each. The first one points to a field
 *  within object. Its value must be an object again if there are any further field(s); then apply those fields.
 *  Any intermediary object(s) must exist; this function won't create them if they're missing, and it will fail.
 *  @param mixed value Value to set to the leaf field.
 *  @return void
 **/
function setFields( object, fieldsString, value ) {
    var fields= fieldsString.split('.');

    for( var i=0; i<fields.length; i++ ) {
        if( i==fields.length-1 ) {
            object[ fields[i] ]= value;
        }
        else {
            object= object[ fields[i] ];
        }
    }
}

/** This returns random true or false, with threshold being the (average) ratio of true results against
 *  the number of all results.
 **/
function random( threshold ) {
    return Math.random()<=threshold;
}

/**
 **/
function xpath_escape_quote( string ) {
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
                        // quote char (' or "), substring (not containing the quote char), same quote char
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
}

function unescape_xml( param ) {
    return param!==null
        ? (typeof param=='string' ? param : ''+param)
         .replace( /&amp;/g, '&' )
         .replace( /&lt;/g, "<")
         .replace( /&gt;/g, ">")
         .replace( /&quot/g, '"')
         .replace( /&apos;/g, "'" )
        : null;
}

/*  @param object prototype Optional; Instance of PrototypedObject or of same subclass as is the class of the
 *  object being created, or its parent class (a subclass of PrototypedObject). That instance serves as the prototype for the new object.
 *  Any enumerable fields set in prototype (including those set to null) will be inherited (copied) at the time of calling this constructor.
 *  Any later changes to prototype object won't be reflected. To inherit from this class
 *  - the subclass constructor should: PrototypedObject.call( this, prototype );
 *  - after defining the subclass constructor (e.g. MyClass) set:
 *  -- MyClass.prototype= new ParentClass(); // or: new PrototypedObject() for 1st level children
 *  -- MyClass.prototype.constructor= MyClass;
 *  See https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance
 *  and also https://developer.mozilla.org/en/JavaScript/Guide/Inheritance_Revisited
 *  The above can be used outside of Selenium-based components - it works in Chrome, Safari, Opera, IE (as of Nov 2012).
 *  However, I haven't tested functionality of PrototypedObject() outside of Firefox.
 **/
function PrototypedObject( prototype ) {
    if( prototype ) {
        assert( this instanceof prototype.constructor, prototype.constructor.name+
            " inherits from PrototypedObject, whose constructor only accepts an object of the same class as a parameter." );
        for( var field in prototype ) {
            this[field]= prototype[field];
        }
    }
}

/** This retrieves a web form password for a user. It doesn't work with .htaccess/HTTP authentication
    (that can be retrieved too, see the docs).
    @param string hostname in form 'https://server-name.some.domain'. It can use http or https and it contain the port (if not standard),
    but no trailing slash / neither any URI.
    @param username case-sensitive
    @return string password if found; null otherwise
*/
function loginManagerPassword( hostname, username ) {
/**
    https://developer.mozilla.org/En/Using_nsILoginManager
    https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginManager
    https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginInfo
*/
    // You could also use passwordManager.getAllLogins(); it returns an array of nsILoginInfo objects
    var logins = loginManagerInstance.findLogins(
        {}, hostname,
        '', // null doesn't work here. See https://developer.mozilla.org/En/Using_nsILoginManager - it says to use blank for web form auth.
        null
    );
    
    for( var i=0; i<logins.length; i++ ) {
        if( logins[i].username==username ) {
            return logins[i].password;
        }
    }
    return null;
}

/** @param mixed recordSet A RecordSet instance
 *  or some other object serving as an associative array,
 *  potentially a result of collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of Record - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @param int position 0-based position of the value to return
 *  @return object the leaf record
 *  @throws Exception if position is negative, decimal or higher than the last available position
 **/
function nthRecord( recordSet, position ) {
    position>=0 || fail( "nthRecord() requires non-negative position, but it was: " +position);
    return nthRecordOrLengthOrIndexesOf( recordSet, NTH_RECORD, position );
}

/** @param mixed recordSet A RecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of Record - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @int number of leaf records
 */
function numberOfRecords( recordSet ) {
    return nthRecordOrLengthOrIndexesOf( recordSet, NUMBER_OF_RECORDS );
}

/** @param mixed recordSet A RecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of Record - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @param record object, record to search for.
 *  @return int 0-based index of that record if found,-1 otherwise.
 */
function indexesOfRecord( recordSet, record ) {
    return nthRecordOrLengthOrIndexesOf( recordSet, INDEXES_OF_RECORD, record );
}

/** Acceptable values of parameter action for nthRecordOrLengthOrIndexesOf()
 * */
var NTH_RECORD= 'NTH_RECORD', NUMBER_OF_RECORDS='NUMBER_OF_RECORDS', INDEXES_OF_RECORD= 'INDEXES_OF_RECORD';

/** @private Implementation of nthRecord() and numberOfRecords() and indexesOfRecord(). Multi-purpose function
 *  that iterates over indexed (and optionally sub-indexed) records.
 *  @param mixed recordSet just like the same parameter in nthRecord() and numberOfRecords()
 *  @param string action Determines the purpose and behavious of calling this function. action must be one of:
 *  NTH_RECORD, NUMBER_OF_RECORDS, INDEXES_OF_RECORD.
 *  @param mixed positionOrRecord Either
 *  -- number, 0-based position across the indexed or indexed and subindexed tree, as iterated by Javascript
 *  (which doesn't guarantee same order on every invocation); or
 *  -- object, record to search for
 *  @return mixed
 *  -- if action==NTH_RECORD then it returns a record at that position
 *  -- if action==NUMBER_OF_RECORDS, then it returns a total number of records
 *  -- if action==INDEXES_OF_RECORD, then it returns an array with indexes of the give nrecord, if found. Precisely:
 *  --- [index, subindex] if the record is found and subindexed
 *  --- [index] if the record is found and indexed, but not subindexed
 *  --- [] if the record is not found
 *  @throws Error on failure, or if action=NTH_RECORD and positionOrRecord is equal to or higher than number of records
 **/
function nthRecordOrLengthOrIndexesOf( recordSet, action, positionOrRecord ) {
    ensureType( recordSet, 'object', 'recordSet must be an object');
    ensureType( positionOrRecord, ['number', 'object', 'undefined'], 'positionOrRecord must be a number, or an object or undefined.');
    ensureOneOf( action, [NTH_RECORD, NUMBER_OF_RECORDS, INDEXES_OF_RECORD], 'nthRecordOrLengthOrIndexesOf() called with wrong parameter action' );
    
    // Following three booleans reflect what we're doing.
    var nthRecord= action===NTH_RECORD;
    var indexesOfRecord= action===INDEXES_OF_RECORD;
    var numberOfRecords= action===NUMBER_OF_RECORDS;
    
    var position= nthRecord
        ? positionOrRecord
        : undefined;
    var record= indexesOfRecord  
        ? positionOrRecord
        : undefined;
    
    ensureType( record, ['object', 'undefined'] );
    ensureType( position, ['number', 'undefined'] );
    
    if( nthRecord && (position<0 || position!=Math.round(position) ) ) {
        throw new Error( "nthRecordOrLengthOrIndexesOf() requires non-decimal non-negative position, but it was: " +position);
    }
    var currPosition= 0; // only used when nthRecord is true
    for( var index in recordSet ) {
        var entry= recordSet[index];
        if( entry instanceof Array ) {
            if( indexesOfRecord ) {
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
        else
        if( entry instanceof RecordGroup ) {
            for( var subindex in entry ) {
                if( indexesOfRecord && entry[subindex]==record ) {
                    return [index, subindex];
                }
                if( nthRecord && currPosition==position ) {
                    return entry[subindex];
                }
                currPosition++;
            }
        }
        else {
            if( indexesOfRecord && entry===positionOrRecord ) {
                return [index];
            }
            if( nthRecord && currPosition===positionOrRecord ) {
                return entry;
            }
            currPosition++;
        }
    }
    if( indexesOfRecord ) {
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
}

var EXPORTED_SYMBOLS= [ "fail", "ensure", "ensureOneOf", "ensureType", "ensureInstance",
    "item", "itemOrNull", "itemGeneric", "objectToString",
     "rowsToString", "timestampInSeconds", "isEmptyObject",
    "objectsMerge", "objectCopyFields", "objectClone", "objectDeleteFields",
    "arrayClone", "objectReverse", "objectValues", "objectValueToField",
    "collectByColumn", "RecordGroup", "collectByColumnRecord", "getField",
    "acceptableCharacters", "randomChar", "randomString", "randomItem",
    "setFields", "random", "xpath_escape_quote", "unescape_xml",
    "PrototypedObject", "loginManagerPassword",
    "compareAllFields", "compareAllFieldsOneWay", "sortByKeys",
    "compareAsNumbers", "compareCaseInsensitively", "compareNatural",
    "sortedObject", "SortedObjectTarget",
    "nthRecord", "numberOfRecords", "indexesOfRecord"
];