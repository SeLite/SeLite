/*  Copyright 2011, 2012, 2013 Peter Kehl
    This file is part of SeLite Commands.

    SeLite Commands is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Commands is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Commands.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

// @TODO document/report this to Selenium
// 1. As of Se IDE 1.5.0, contrary to http://release.seleniumhq.org/selenium-core/1.0/reference.html#extending-selenium
// (documentation on how to write custom getXXX functions),
// this must have exactly one parameter. If you specify two parameters, neither of them will get the value assigned!
// 2. This function must return a non-null defined value; otherwise you'll get a confusing error from AccessorResult
// at chrome/content/selenium-core/scripts/selenium-commandhandlers.js
// @TODO If Selenium people fix function AccessorResult, then
// undo the non-null check, and return null as it is.
Selenium.prototype.getQs= function( target ) {
    var newTarget= target.replace( /\$([a-zA-Z_][a-zA-Z_0-9]*)/g, 'storedVars.$1' );
    LOG.debug( 'getQs(): ' +target+ ' -> ' +newTarget );
    try {
        var result= eval( newTarget );
    }
    catch(e) {
        LOG.error( 'Failed to evaluate: ' +newTarget+ ". Error: " +e );
        throw e;
    }
    //return result;
    return result!==null && typeof result !=='undefined'
        ? result
        : false;
};

/** @TODO eliminate? Or, keep, if we use NaN
 **/
Selenium.prototype.doTypeRobust= function(target, value) {
    if( !target ) {
        LOG.info( 'typeRobust skipped, since target was empty/0/false.' );
    }
    else
    if( isRobustNull(target) ) {//@TODO This depends on selite-misc-ide. Move to SelBlocks Global.
        LOG.info( 'typeRobust skipped, since target was null.' );
    }
    else
    if( isRobustNull(value) ) {
        LOG.info( 'typeRobust skipped, since value was null.' );
    }
    else {
        this.doType( target, value );
    }
}

Selenium.prototype.doSelectRobust= function(target, value) {
    if( !target ) {
        LOG.info( 'selectRobust skipped, since target was empty/0/false.' );
    }
    else
    if( isRobustNull(target) ) {
        LOG.info( 'selectRobust skipped, since target was null.' );
    }
    else
    if( isRobustNull(value) ) {
        LOG.info( 'selectRobust skipped, since value was null.' );
    }
    else {
        this.doSelect( target, value );
    }
}

Selenium.prototype.doClickRobust= function(target, value) {
    if( target==='' ) {
        LOG.info( 'clickRobust skipped, since target was an empty string.' );
    }
    else
    if( isRobustNull(target) ) {
        LOG.info( 'clickRobust skipped, since target was null.' );
    }
    else {
        this.doClick( target, value );
    }
}

Selenium.prototype.isTimestampSeconds= function( locator, timestampInSeconds ) {
/** This compares the formatted timestamps, identified by locator, against timestampInSeconds.
    This is for the lowest timestamp displayed precision unit - a second (since  Date.parse() doesn't parse milliseconds).
    It allows for difference up to: maxTimeDifference (config value) + Selenium timeout limit +1 second (unit of the displayed precision).
    Use with doNoteTimestamp().
    @param string locator Locator of the element which contains the formatted timestamp
    @param int timestampInSeconds Expected timestamp in seconds (since Epoch).
 **/
    return this.timestampComparesTo( locator, timestampInSeconds );
};

Selenium.prototype.isTimestampMinutes= function( locator, timestampInSeconds ) {
    /** Just like isTimestampSeconds, but this checks the timestamp with the precision of 1 minute.
        Use with doNoteTimestamp().
        @param string locator Locator of the element which contains the formatted timestamp
        @param int timestampInSeconds Expected timestamp in *seconds* (since Epoch).
    */
   return this.timestampComparesTo( locator, timestampInSeconds, 60 );
}

/** Internal function, used to compare a displayed human-readable timestamp to a numeric timestamp,
 *  allowing for difference of maxTimeDifference (sec) and this.defaultTimeout (ms) and 1x display time unit (displayPrecisionInSeconds).
    I don't use prefix 'do' or 'get' in the name of this function
    because it's not intended to be run as Selenium command/getter.
 *  @param string locator Selenium locator of the element that contains the displayed human-readable (and parsable) time stamp
 *  @param number timestampInSeconds Expected timestamp, number of seconds since Epoch
 *  @param number displayPrecisionInSeconds (Smallest) displayed time unit, in seconds; optional, its default is 60
 **/
Selenium.prototype.timestampComparesTo= function( locator, timestampInSeconds, displayPrecisionInSeconds ) {
    displayPrecisionInSeconds= displayPrecisionInSeconds || 60;
    var element= this.page().findElement(locator);
    var displayedTimeString= typeof element.value !=='undefined'
        ? element.value
        : element.textContent;
    var displayedTime= Date.parse( displayedTimeString );
    var maxDifference= maxTimeDifference*1000+ Number(this.defaultTimeout)+ displayPrecisionInSeconds*1000;
    LOG.debug( 'TimestampInSeconds: ' +timestampInSeconds+ '; DisplayedTimeString: ' +displayedTimeString+ ' is timestamp '
        +displayedTime+ ' ms; Calculated max allowed difference: ' +maxDifference+ ' ms.' );
    return Math.abs( timestampInSeconds*1000-displayedTime) <= maxDifference;
};

/** Object (serving as an associative array) {
 *  string recordType: number future timestamp (in milliseconds) when this recordType
 *      can have a new distinct timestamp, which can be distinguished from the last one (and any older ones).
 *  }.
 **/
Selenium.prototype.distinctTimestamps= {};

/**I don't use prefix 'do' in the name of this function
   because it's not intended to be run as Selenium command.
*/
Selenium.prototype.noteTimestamp= function( recordType, timestampPrecision ) {
    /** Use to record the moment when you inserted/updated a record of given type, and you want to
     *  compare that record's timestamp (whether soon or later) as formatted on the webpage (using given precision).
     *  This in conjunction with waitForDistinctTimestamp action make sure that you get timestamps which can be
     *  compared as distinct.
     *  Warning: This keeps a count only of timestamps notes since you started Selenium. If you re-started it soon
     *  after the previous run, make sure you wait for a sufficient period to get distinct new timestamps.
     *  @param string recordType Type/use case group of the record that you're upgrading/inserting. Records that can be compared
     *  between each other should have same recordType. Then this assures that they get timestamps that shows up as distinct.
     *  Records with different recordType can get same timestamps.
     *  @param int timestampPrecision optional; if present, it's the precision/lowest unit of the timestamp, in seconds; 1 sec by default.
     **/
    timestampPrecision= Number(timestampPrecision || 1);
    var nextDistinctTimestamp= Date.now()+ maxTimeDifference*1000 +timestampPrecision*1000+ Number(this.defaultTimeout);
    this.distinctTimestamps[recordType]= nextDistinctTimestamp;
};

Selenium.prototype.doPauseUntilDistinctTimestampSeconds= function( recordType, valueIsUnused ) {
    this.pauseUntilDistinctTimestamp( recordType, 1 );
};

Selenium.prototype.doPauseUntilDistinctTimestampMinutes= function( recordType, valueIsUnused ) {
    this.pauseUntilDistinctTimestamp( recordType, 60 );
};

/**I don't use prefix 'do' in the name of this function
   because it's not intended to be run as Selenium command.
*/
Selenium.prototype.pauseUntilDistinctTimestamp= function( recordType, timestampPrecision ) {
    /** @param string recordType Same record type as passed to action noteTimestamp
     *  @return true if it's safe to create a new timestamp for this type of record, and the timestamp
     *  will be distinguishable from the previous one.
     *  @param int timestampPrecision optional; if present, it's the precision/lowest unit of the timestamp, in seconds; 1 sec by default.
     **/
    //@TODO make dontWaitForDistinctTimestamps a configuration option set via GUI?
    if( typeof dontWaitForDistinctTimestamps=='undefined' || !(recordType in this.distinctTimestamps) ) {
        if( !(recordType in this.distinctTimestamps) ) {
            LOG.info( 'pauseUntilDistinctTimestampXXX: No previous timestamp for recordType ' +recordType );
        }
        // I do note a timestamp even if dontWaitForDistinctTimestamps==true, so that if sometimes later
        // dontWaitForDistinctTimestamps becomes false then I have a list of previous timestamps in hand.
        this.noteTimestamp( recordType, timestampPrecision );
        return;
    }
    var timestampBecomesDistinct= this.distinctTimestamps[recordType]; // in milliseconds
    var timeOutFromNow= timestampBecomesDistinct-Date.now()+1100; // in milliseconds, plus a buffer
    if( timeOutFromNow<=0 ) {
        LOG.debug( 'pauseUntilDistinctTimestampXXX: No need to wait. A distinct timestamp became available ' +(-1*timeOutFromNow/1000)+ ' sec. ago.' );
        return;
    }
    LOG.debug( 'pauseUntilDistinctTimestampXXX: waiting for next ' +timeOutFromNow/1000+ ' sec.' );

    return Selenium.decorateFunctionWithTimeout(function () {
        if( Date.now()>timestampBecomesDistinct ) {
            this.noteTimestamp( recordType, timestampPrecision );
            return true;
        }
        return false;
    }, timeOutFromNow );
};

/** Index (or re-index) a collection of objects by given index (or index and sub-index).
 *
 *  - indexBy - string name of field to index by; the objects should contain such a field;
 *    its values must be unique, unless subIndexBy is used
 *  - subIndexBy - string name of field to sub-index by, within groups or objects
 *    that had same indexBy values; subIndexBy value must be unique within those group
 */
Selenium.prototype.doIndexBy= function( columnOrDetails, sourceVariableName ) {
    var indexBy= columnOrDetails, subIndexBy= null, resultVariableName= sourceVariableName;
    if( typeof columnOrDetails==='object' ) {
        indexBy= columnOrDetails.indexBy;
        if( typeof columnOrDetails.subIndexBy!=='undefined' ) {
            subIndexBy= columnOrDetails.subIndexBy;
        }
        if( typeof columnOrDetails.target!=='undefined' ) {
            resultVariableName= columnOrDetails.target;
        }
    }
    storedVars[resultVariableName]= collectByColumn( storedVars[sourceVariableName], indexBy, !subIndexBy, subIndexBy );
}

// I don't use prefix 'get' or 'do' in the name of this function
// because it's not intended to be run as Selenium getter/command.
Selenium.prototype.randomElement= function( elementSetXPath ) {
    /** This clicks at a random radio button from within a set of radio buttons identified by locator.
     *  @param string elementSetXPath XPath expression to locate the element(s). Don't include leading 'xpath='.
     *  It can't be any other Selenium locator. You probably want to match them
     *  using XPath 'contains' function, e.g. //input[ @type='radio' and contains(@id, 'feedback-') ].
     */
    // Can't use global variable 'window' here
    var window= this.browserbot.getCurrentWindow();
    
    // There's no getElements(..) function in Selenium API, so I'm using the DOM one
    // See https://developer.mozilla.org/en/DOM/document.evaluate
    var elementsIterator= window.document.evaluate(
        elementSetXPath, window.document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null );
    var elements= [];
    var element= null;
    while( (element=elementsIterator.iterateNext()) ) {
        elements.push( element );
    }
    if( !elements.length ) {
        LOG.error( 'getRandomElement(): There are no elements matching XPath: ' +elementSetXPath );
        throw new Error();
    }
    var elementIndex= Math.round( Math.random()*(elements.length-1) );
    return elements[elementIndex];
};

Selenium.prototype.doClickRandom= function( radiosXPath, store ) {
    /** This clicks at a random radio button from within a set of radio buttons identified by locator.
     *  @param string radiosLocator XPath expression to locate the radio button(s). Don't include leading 'xpath='.
     *  It can't be any other Selenium locator. You probably want to match them
     *  using XPath 'contains' function, e.g. //input[ @type='radio' and contains(@id, 'feedback-') ].
     *  @param string store Optional; name of the stored variable to store the selected value, it may include
     *  field(s) e.g. '.field.subfield..' but the field(s) must be constant strings
     **/
    var radio= this.randomElement( radiosXPath );
    this.browserbot.clickElement( radio );

    if( store ) {
        setFields( storedVars, store, radio.value );
    }
};

/**I don't use prefix 'do' or 'get' in the name of this function
   because it's not intended to be run as Selenium command/getter.
*/
Selenium.prototype.randomOption= function( selectLocator, params ) {
    /** This returns a random option from within <select>...</select> identified by locator.
     *  It doesn't return any optgroup elements.
     *  @param string selectLocator Locator of the <select>...</select>
     *  @param mixed params optional, an object in form {
     *     excludeFirst: true, // Whether to exclude the first option
     *     excludeLast: true, // Whether to exclude the last option
     *  }
     *  @return DOM Element of a random <option>...</option> from within the select
     */
    var params= params || {};
    var select= this.page().findElement(selectLocator);
    var options= select.getElementsByTagName('option');

    var excludeFirst= params && params.excludeFirst;
    var excludeLast= params && params.excludeLast;
    var firstIndex= (excludeFirst ? 1 : 0);
    var randomRange= options.length-1 - firstIndex - (excludeLast ? 1 : 0);
    var optionIndex= firstIndex+ Math.round( Math.random()*randomRange );
    var option= options[optionIndex];
    return option;
};

// @TODO remove?:
Selenium.prototype.doSelectRandom= function( selectLocator, paramsOrStore ) {
    /** This selects a random option from within <select>...</select> identified by locator.
     *  It doesn't select any optgroup elements.
     *  @param string selectLocator Locator of the <select>...</select>
     *  @param mixed paramsOrStore optional, either
     *  - a string which is the name of the stored variable to put the selected value in (more below), or
     *  - an object in form {
     *     excludeFirst: true, // Whether to exclude the first option
     *     excludeLast: true, // Whether to exclude the last option
     *     store: string //name of the stored variable to store the selected value, it may include field(s) '.field.subfield..'
     *     but the field(s) must be constant strings
     *  }
     **/
    var params= paramsOrStore || {};
    if( typeof params =='string' ) {
        params= {store: params};
    }
    var option= this.randomOption( selectLocator, params );

    // This didn't work: this.browserbot.selectOption( select, option );
    this.doSelect( selectLocator, 'value=' +option.value );
    
    if( params && params.store ) {
        //storedVars[params.store]= option.value;
        setFields( storedVars, params.store, option.value );
    }
};

Selenium.prototype.randomFirstNames= [
    'Alice', 'Betty', 'Charlie', 'Dan', 'Erwin', 'Frank', 'Geraldine', 'Hugo', 'Ismael', 'Julie', 'Karl', 'Lucy', 'Marc',
    'Nathan', 'Oliver', 'Susie', 'Tatiana', 'Ursula'
];
Selenium.prototype.randomSurnames= ['Brown', 'Blue', 'Cyan', 'Emerald', 'Green', 'Violet', 'Marble', 'Pink', 'Red', 'Ruby', 'Sunshine', 'White'];
Selenium.prototype.randomThirdNameMinLength= 3;
// Following is also applied to (an optional) random part of email domain, the part after a dash -
Selenium.prototype.randomThirdNameMaxLength= 8;
Selenium.prototype.randomWords= ['amazing', 'cat', 'excellent', 'elephant', 'good', 'frog', 'hamster', 'horse', 'lion', 'mouse', 'happy',
    'healthy', 'pretty', 'superb', 'tomcat' ];
// Don't enter a dot. Include at least one two-letter domain, so that it gets included in randomTopDomainsShort.
Selenium.prototype.randomTopDomains= ['es', 'it', 'com', 'com.au', 'co.nz', 'co.uk'];

/**I don't use prefix 'do' or 'get' in the name of this function
   because it's not intended to be run as Selenium command/getter.
*/
Selenium.prototype.randomTopDomainsShort= (function(){
    var result= [];
    for( var i=0; i<Selenium.prototype.randomTopDomains.length; i++ ) {
        if( Selenium.prototype.randomTopDomains[i].length==2 ) {
            result.push( Selenium.prototype.randomTopDomains[i] );
        }
    }
    return result;
})();

/**I don't use prefix 'do' or 'get' in the name of this function
   because it's not intended to be run as Selenium command/getter.
*/
Selenium.prototype.randomText= function( locator, params, extraParams ) {
    /** Return a random text, restricted by params, and fit for an input element identified by locator,
     *  It always returns at least 1 character.
     * @parameter string locator Locator of the text input
     * @parameter object, see second parameter paramsOrStore of funcion doTypeRandom(), except that
     * - here it has to be an object, it can't be a string
     * - 'store' field has no effect here
     * @parameter extraParams Currently only used with type 'email', to generate an email address based on
     * a given name (first/last/full). Then pass an object {
     *     baseOnName: string human-name; the email address part left of '@' will be based on this string
     * }
     * @return string as speficied in doTypeRandom()
     */
    var params= params || {};
    var type= params.type || null;
    if( type && 
        (typeof type!=='string' || ['email', 'name', 'number', 'text', 'ugly'].indexOf(type)<0)
    ) {
        LOW.error( "randomText(): params.type='" +type+ "' is not recognised." );
        throw new Error();
    }
    var element= this.page().findElement(locator);

    var minLength= params.minLength || 1;
    minLength= Math.max( minLength, 1 );
    if( type=='email' ) {
        minLength= Math.max( minLength, 7 );
    }
    var maxLength= params.maxLength ||
        parseInt( element.getAttribute('maxlength') ) ||
        255;
    maxLength= Math.max( minLength, maxLength );

    var charRange= ''; // We'll use ASCII characters from within this range
    if( !type || type=='email' ) {
        charRange+= 'a-zA-Z'; // Email characters @ and . will be added when generating an email address
    }
    if(  !type || type=='number' ) {
        charRange+= '0-9';
    }
    if( type=='name' ) {
        charRange+= 'a-z'; // Only used to fill-up after 'nice' first & last name
    }
    if( type=='text' ) {
        charRange+= ' a-z';
    }
    if( !type ) {
        charRange+= ' _-';
    }
    if( type=='ugly' ) {
        charRange= "'\"./<>();";
    }
    var acceptableChars= acceptableCharacters( new RegExp( '['+charRange+']' ) );
    var result= '';
    
    if( type=='name' ) {
        result= randomItem( this.randomFirstNames )+ ' ' +randomItem( this.randomSurnames );

        // Append random name-like string, min. randomThirdNameMinLength letters, max. randomThirdNameMaxLength letters,
        // plust a leading space, e.g. ' Xu...'
        if( result.length < maxLength-this.randomThirdNameMinLength ) {
            var thirdNameLength= this.randomThirdNameMinLength + Math.round( Math.random()*Math.min(
                this.randomThirdNameMaxLength-this.randomThirdNameMinLength,
                maxLength-1- this.randomThirdNameMinLength-result.length
            ) );
            result+= ' ' +randomChar(acceptableChars).toUpperCase() +
                randomString( acceptableChars, thirdNameLength-1);
        }
        result= result.substr( 0, maxLength ); // In case we've overrun it (by first or first+' '+last)
    }
    else
    if( type=='email' ) {
        if( extraParams ) {
            var name= '';
            var baseOnName= extraParams.baseOnName.replace( / /g, '-' );
            for( var i=0; i<baseOnName.length; i++ ) {
                if( acceptableChars.indexOf(baseOnName[i])>=0 ) {
                    name+= baseOnName[i];
                }
            }
            if( !name.length ) {
                name+= randomChar( acceptableChars );
            }
        }
        else {
            // Generate email in form 'name@domain'. For nice human experience of testers we're generating
            // first.last@word.word-and-random-filling.(com|it|...) or
            // first@word.word-and-random-filling.(com|it|...) for c.a. 50% of results each.
            // If the part left of '@' were much longer, it's difficult to identify the email pattern by a human.
            var name= randomItem( this.randomFirstNames ).toLowerCase();
            // If there's enough space, then for 50% of such cases, append a dot and a second name/part of it
            // Leave at least 5 characters for domain
            if( name.length<maxLength-6 && Math.random()>0.5 ) {
                name+= '.' +randomItem( this.randomSurnames ).toLowerCase();
            }
        }
        name= name.substr(0, maxLength-6 ); // In case we've overrun, leave at least 5 letters for full domain
        
        var topDomains= maxLength- name.length > 6
            ? this.randomTopDomains
            : this.randomTopDomainsShort;
        var topDomain= randomItem( topDomains );

        var maxMidDomainLength= maxLength- name.length- topDomain.length- 2;
        var midDomain= randomItem( this.randomWords ).toLowerCase();
        if( maxMidDomainLength-midDomain.length >=2 ) {
            // Let's append a dash followed by 1 or more random alpha letters, e.g. '-xpqr', to midDomain
            var midDomainExtraLength= 1+ Math.round( Math.random()* Math.min(
                this.randomThirdNameMinLength,
                maxMidDomainLength- 2- midDomain.length
            ) );
            midDomain+= '-' +randomString(acceptableChars, midDomainExtraLength ).toLowerCase();

        }
        midDomain= midDomain.substr(0, maxMidDomainLength );
        result= name+ '@'+ midDomain+ '.' +topDomain;
    }
    else
    if( !type || type=='text' || type=='ugly' || type=='number' ) {
        if( type=='ugly' ) {
            // If possible, try to type all ugly characters at least once. But don't type more than maxLength
            minLength= Math.min( maxLength, Math.max(minLength,acceptableChars.length) );
        }
        var totalLength= minLength+ Math.round( Math.random()*(maxLength-minLength) );
        
        if( type=='text' ) {
            while( result.length<totalLength ) {
                if( result ) {
                    result+= ' ';
                }
                result+= this.randomWords[Math.round( Math.random()*(this.randomWords.length-1) )];
            }
            result= result.substr( 0, maxLength ); // In case we've overrun it (by appending the last random word etc.)
        }
        else
        if( type=='ugly' ) {
            // Typing as many unique ugly characters as possible
            var numFirstUglies= Math.min( maxLength, acceptableChars.length );
            result= acceptableChars.substr(0, numFirstUglies);
            // Typing the rest (still, ugly ones)
            result+= randomString(acceptableChars, totalLength-numFirstUglies);
        }
        else
        if( type=='number' ) {
            if( params.decimal ) {
                if( totalLength<3 ) {
                    totalLength= 3;
                    assert( totalLength<=maxLength, "Cannot insert a decimal point" );
                }
                var maxScale= params.scale
                    ? params.scale
                    : totalLength-2;
                var actualScale= 1+Math.round( Math.random()*(maxScale-1) );
            }
            else {
                var actualScale= 0;
            }
            if( typeof params.min!=='undefined' || params.max ) {
                // Ignore minLength, maxLength, totalLength
                var min= params.min || 0;
                result= min+ Math.random()*( params.max-min ); // That excludes params.max. Therefore I'll do a rounding transformation in the next step
                // Here I'll shift the decimal point maxScale digits to the right; then I round it; then I shift the decimal point back.
                // This way the result range will include params.max as its maximum (if not decimal, or if actualScale==maxScale)
                var scaleMultiplier= Math.pow( 10, actualScale );
                result= ''+ Math.round( result*scaleMultiplier )/scaleMultiplier;
            }
            else
            if( params.decimal ) {
                // We generate a number with totalLength digits. Then we replace one by the decimal point
                result= randomString(acceptableChars, totalLength);
                var decimalPointPosition= totalLength-actualScale-1;
                result= result.substring( 0, decimalPointPosition )+ '.' +result.substring(decimalPointPosition+1);
                if( result[totalLength-1]=='0' ) {
                    result= result.substring( 0, result.length-1 )+ '1';
                }
            }
            else {
                result= '' +Math.round( Math.random()*Math.floor(params.max) );
            }
        }
        else {
            result= randomString(acceptableChars, totalLength);
        }
    }
    else {
        throw new Error( "Error in randomText(): type=" +type );
    }
    return result;
};

Selenium.prototype.doTypeRandom= function( locator, paramsOrStore ) {
    /**Type random characters into an input. It always types at least 1 character - use standard 'type' action for typing an empty string.
     * @parameter string locator Locator of the text input
     * @parameter mixed paramsOrStore, optional, either
     * - string - name of the stored variable to save the value to (more below), or
     * - an object in form {
     *     minLength: int, if present then it must be at least 1, otherwise it's set to 1.
     *        You can't use this function to generate an empty string.
     *        If params.email is set, then minLength must be at least 7 (e.g. a@hi.it), otherwise it's set to 7
     *     maxLength: int, if present then it must be at least minLength;
     *        if not present, then input's 'maxlength' property is used; if that's not present, then 255
     *     type: string indicating type of the field (and what it can/should accept/refuse). Possible values:
     *         'email': When generating an email address
     *         'name' When generating a random human name (and some random letters A-Za-z)
     *         'number': When generating a non-negative number; see more options below
     *         'text' When generating random word(s) (and random letter-based text)
     *         'ugly' When generating bad characters (possibly used for SQL injection, filesystem access).
     *                It will try to include all unique ugly characters at least once, so it may always generate more
     *                characters than minLength, therefore leaving some combinations untested.
     *                (Indeed, it will never overstep maxLength or input's 'maxlength' property, if maxLength isn't set.)
     *          If type is not set, then the default characters used are: alphanumerics, space, underscore, -
     *     decimal: true If set, then generate a decimal number. Any minLength/maxLength (or HTML maxlength property of the input)
     *          will apply to number of letters used, i.e. to number of generated digits + 1 (for the decimal point)
     *     scale: int If set, max length of the decimal fraction (max. number of digits right of decimal point).
     *            It has to be higher than 0; if you pass scale: 0, it will be ignored.
     *     max: number (int or float) maximum value (inclusive, if 'scale' permits). Optional. Applied when type='number'.
     *           It has to be higher than zero; zero will be ignored. If used, then 'minLength', 'maxLength' (or 'maxlength' property)
     *           will be ignored.
     *          Indeed, if decimal is set and the result is smaller than max, then it may have more decimal places than max has.
     *     min: number (int or float) minimum value (inclusive). Optional, but it may be only used if 'max' is set. See 'max'.
     *     store: string name of the stored variable to store the selected value, it may include field(s) e.g. 'varX.field.subfield..'
     *            but the field(s) must be constant strings
     * }
     **/
    var params= paramsOrStore || {};
    if( typeof params =='string' ) {
        params= {store: params};
    }
    var resultString= this.randomText( locator, params );

    LOG.debug('doTypeRandom() typing: ' +resultString );
    this.doType( locator, resultString );
    if( params.store ) {
        setFields( storedVars, params.store, resultString );
    }
};
// @TODO This doesn't work well
Selenium.prototype.doTypeRandomEmail= function( locator, params ) {
    /** Type random email address, based on a name in the given name element.
     *  @parameter string locator Locator of the text input where to type the generated email address
     * @parameter mixed paramsOrStore, optional, either
     * string - name (first or last or full) to base the email on, or
     * object in form {
     *    from: string locator of an element which has a name (as described above)in it; optional, you can use 'name' instead
     *    name: string value of the name (as described above), optional; used only if 'from' is not present
     *    store: name of the stored variable to save the value to, it may include field(s) e.g. 'varX.field.subfield..'
     *    but the field(s) must be constant strings; optional
     *    minLength: int as described for typeRandom action (i.e. doTypeRandom function), optional
     *    maxLength: int as described for typeRandom action (i.e. doTypeRandom function), optional
     * }
     **/
    params= params || {};
    var paramsToPass= { type: 'email' };
    if( typeof params==='string' ) {
        var name= params;
    }
    else {
        if( typeof params.from!=='undefined' ) {
            var fromElement= this.page().findElement( params.from );
            var name= typeof fromElement.value !=='undefined'
                    ? fromElement.value
                    : fromElement.textContent;
        }
        else
        if( typeof params.name=='undefined' ) {
            var name= params.name;
        }
        else {
            throw new Error( "You must pass the name to use for the email address, or pass an object with 'from' field which is a locator." );
        }
        objectClone( params, ['minLength', 'maxLength'], [], paramsToPass );
    }
    var extraParamsToPass= {
        baseOnName: name
    };
    var resultString= this.randomText( locator, paramsToPass, extraParamsToPass );

    LOG.debug('doTypeRandomEmail() typing: ' +resultString );
    this.doType( locator, resultString );
    if( params.store ) {
        setFields( storedVars, params.store, resultString );
    }
};

// @TODO what did I want to do here?
// @TODO similar doClickMapped?
Selenium.prototype.doSelectMapped= function( locator, params ) {
};

Selenium.prototype.isSelectMapped= function( locator, params ) {
};

//--------------------------
// Based on http://thom.org.uk/2006/03/12/disabling-javascript-from-selenium/
(function() {
    Selenium.prototype.preferencesService= Components.classes["@mozilla.org/preferences-service;1"]
               .getService(Components.interfaces.nsIPrefBranch);
    /**I don't use prefix 'do' or 'get' in the name of this function
       because it's not intended to be run as Selenium command/getter.
    */
    Selenium.prototype.setJavascriptPref= function(bool) {
       this.preferencesService.setBoolPref("javascript.enabled", bool);
    }
    // Beware: this disables Javascript in whole Firefox (for all tabs). The setting
    // will stay after you close Selenium.
    Selenium.prototype.doDisableJavascript = function() {
        this.setJavascriptPref(false);
    };

    Selenium.prototype.doEnableJavascript = function() {
        this.setJavascriptPref(true);
    };
})();