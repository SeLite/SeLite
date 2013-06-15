/*  Copyright 2011, 2012, 2013 Peter Kehl
    This file is part of SeLite Misc.

    SeLite Misc is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Foobar is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

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
    if( typeof nullReplacement ==='undefined') {
        nullReplacement= null;
    }
    if( typeof targetNullReplacement ==='undefined' ) {
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
                if( field.toString()=='NaN' ) {
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
        if( typeof item =='object' && typeof item[field] !=='undefined' ) {
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
 *  @param array higherObjects Optional; array of objects/arrays that are being processed by the direct/indirect caller of this function
 *  (i.e. recursive array/object reference).
 *  @return string
 */
function objectToString( object, recursionDepth, includeFunctions, higherObjects ) {
    if( typeof object ==='undefined' || object===null || typeof object ==='string' ) {
        return ''+object;
    }
    higherObjects= higherObjects || [];
    higherObjects.push(object);
    var result= '';
    if( object instanceof Array ) {
        for( var j=0; j<object.length; j++ ) {
            result+= objectFieldToString( object, j, recursionDepth, includeFunctions, higherObjects, result=='' );
        }
    }
    else {
        for( var field in object ) {
            result+= objectFieldToString( object, field, recursionDepth, includeFunctions, higherObjects, result=='' );
        }
    }
    higherObjects.pop();
    var resultLines= result.split("\n");
    result= resultLines.join( "\n" +OBJECT_TO_STRING_INDENTATION );
    if( result!=='' ) {
        result= "\n" +OBJECT_TO_STRING_INDENTATION+result+ "\n";
    }
    if( object instanceof Array ) {
        var resultPrefix= 'array';
    }
    else {
        var resultPrefix= (object.constructor.name!=='' ? 'object ' +object.constructor.name : 'object with anonymous constructor');
    }
    result= resultPrefix+ " {" +result+ "}"
    return result;
}

/*** @private/internal
 */
function objectFieldToString( object, field, recursionDepth, includeFunctions, higherObjects, firstItem ) {
        var result= '';
        if( !includeFunctions && typeof object[field]=='function' ) {
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
        if( typeof object[field] =='object' && recursionDepth>0 ) {
            result+= objectToString( object[field], recursionDepth-1, includeFunctions, higherObjects );
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
    if( typeof obj !=='object' ) {
        throw "" +obj+ " is not an object!";
    }
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
        if( typeof firstContainer!='object' || typeof secondContainer!='object' ) {
            throw new Error();
        }
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
            if( first!==null && !first[methodName].call(first, second) ) {
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

/** Sort fields in object by keys (keys are always strings).
 *  @param object object serving as an associative array
 *  @param function compareFunction Function that compares two keys. Optional; by default case-sensitive string comparison.
 *  @return new anonymous object serving as an associative array, with all fields and values from object, but in the sorted order
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
    var result= {};
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
            : +1
          );
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
    if( typeof original.prototype !=='undefined' ) {
        result.prototype= original.prototype;
    }
    for( var i=0; i<requiredFields.length; i++ ) {
        if( typeof original[requiredFields[i]] ==='undefined' ) {
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

/** @return array containing string keys that are names of fields/entries in given object obj
 * */
function objectKeys( obj ) {
    var result= [];
    for( var fieldName in obj ) {
        result.push( fieldName );
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
 *  it can be a result of dbSelect() or a previous result of collectByColumn().
 *  It implies that any actual values must not be arrays themselves, because they would be
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
 *  non-negative integer index range. Our data doesn't fit that.
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
        if( typeof result[columnvalue] =='undefined' ) {
            result[columnvalue]= subindexcolumnorfieldname ? new RecordGroup() : [];
        }
        if( subindexcolumnorfieldname ) {
            var subindexvalue= getField(record, subindexcolumnorfieldname);
            if( typeof subindexvalue =='undefined' ) {
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

/**
    https://developer.mozilla.org/En/Using_nsILoginManager
    https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginManager
    https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginInfo
*/
var loginManagerInstance = Components.classes["@mozilla.org/login-manager;1"].
    getService(Components.interfaces.nsILoginManager);

/** This retrieves a web form password for a user. It doesn't work with .htaccess/HTTP authentication
    (that can be retrieved too, see the docs).
    @param string hostname in form 'https://server-name.some.domain'. It can use http or https and it contain the port (if not standard),
    but no trailing slash / neither any URI.
    @param username case-sensitive
    @return string password if found; null otherwise
*/
function loginManagerPassword( hostname, username ) {
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

var EXPORTED_SYMBOLS= [ "item", "itemOrNull", "itemGeneric", "objectToString",
    "objectFieldToString", "rowsToString", "timestampInSeconds", "isEmptyObject",
    "objectsMerge", "objectCopyFields", "objectClone", "objectDeleteFields",
    "arrayClone", "objectReverse", "objectValues", "objectKeys", "objectValueToField",
    "collectByColumn", "RecordGroup", "collectByColumnRecord", "getField",
    "acceptableCharacters", "randomChar", "randomString", "randomItem",
    "setFields", "random", "xpath_escape_quote", "unescape_xml",
    "PrototypedObject", "loginManagerPassword",
    "compareAllFields", "compareAllFieldsOneWay", "sortByKeys",
    "compareAsNumbers", "compareCaseInsensitively"
];