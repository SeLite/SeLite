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

Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );
    
// For all Selenium actions and locators defined here - i.e. functions with name doXXXX, isXXXXX, getXXXXX
// see their user documentation at ../reference.xml

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
    //return result; //@TODO See above
    return result!==null && result!==undefined
        ? result
        : false;
};

/** @TODO eliminate? Or, keep, if we use NaN
 **/
Selenium.prototype.doTypeRobust= function(target, value) {
    if( !target || !value ) {
        LOG.info( 'typeRobust skipped, since target or value was empty/0/false.' );
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

Selenium.prototype.doSelectRobust= function(selectLocator, optionLocator) {
    if( !selectLocator || !optionLocator ) {
        LOG.info( 'selectRobust skipped, since selectLocator or optionLocator was empty/0/false.' );
    }
    else
    if( isRobustNull(selectLocator) ) {
        LOG.info( 'selectRobust skipped, since selectLocator was null.' );
    }
    else
    if( isRobustNull(optionLocator) ) {
        LOG.info( 'selectRobust skipped, since optionLocator was null.' );
    }
    else {
        this.doSelect( selectLocator, optionLocator );
    }
}

Selenium.prototype.doClickRobust= function(locator, valueUnused) {
    if( locator==='' ) {
        LOG.info( 'clickRobust skipped, since locator was an empty string.' );
    }
    else
    if( isRobustNull(locator) ) {
        LOG.info( 'clickRobust skipped, since locator was null.' );
    }
    else {
        this.doClick( locator, valueUnused );
    }
}
Selenium.prototype.isTimestampDownToMilliseconds= function( locator, timestampInMilliseconds ) {
    return this.timestampComparesTo( locator, timestampInMilliseconds, 1, true );
};

Selenium.prototype.isTimestampDownToSeconds= function( locator, timestampInMilliseconds ) {
    return this.timestampComparesTo( locator, timestampInMilliseconds, 1000, true );
};

Selenium.prototype.isTimestampDownToMinutes= function( locator, timestampInMilliseconds ) {
   return this.timestampComparesTo( locator, timestampInMilliseconds, 60000, true );
}

Selenium.prototype.isTimestampDownToPrecision= function( locator, timestampDetails ) {
    return this.timestampComparesTo( locator, timestampDetails.timestamp,
        timestampDetails.precision, timestampDetails.validatePrecision, timestampDetails.timezone );
};

/** Internal function, used to compare a displayed human-readable timestamp to a numeric timestamp,
 *  allowing for difference of maxTimeDifference (sec) and this.defaultTimeout (ms) and 1x display time unit (displayPrecisionInSeconds).
    I don't use prefix 'do' or 'get' in the name of this function
    because it's not intended to be run as Selenium command/getter.
 *  @param string locator Selenium locator of the element that contains the displayed human-readable (and parsable) time stamp
 *  @param number timestampInMilliseconds Expected timestamp, number of milliseconds since Epoch
 *  @param number displayPrecisionInMilliseconds Smallest displayed time unit, in milliseconds
 *  @param bool validatePrecision
 *  @TODO Use parameter timezone. Allow both short and long names? Make it daylightsaving-friendly - don't cache the time shift.
 *  This doesn't use timezone support in Date.parse(), because that only understands GMT, Z and US time zone abbreviations
 *  - see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse and try 
 *  Date.parse( "Fri, 11 Oct 2013 05:55:00 AEST" ) - it evaluates to NaN.
 *  evaluate in a .js file, not via javascript: url: new Intl.DateTimeFormat("en-GB", {timeZone:"AEDT", timeZoneName:'short'}).format( new Date())
 *  See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset and
 *  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/supportedLocalesOf
 **/
Selenium.prototype.timestampComparesTo= function( locator, timestampInMilliseconds, displayPrecisionInMilliseconds, validatePrecision, timezoneTODO ) {
    var element= this.page().findElement(locator);
    var displayedTimeString= element.value!==undefined
        ? element.value
        : element.textContent;
    var displayedTime= Date.parse( displayedTimeString );
    var maxDifference= maxTimeDifference+ Number(this.defaultTimeout)+ displayPrecisionInMilliseconds;
    LOG.debug( 'timestampInMilliseconds: ' +timestampInMilliseconds+ '; DisplayedTimeString: ' +displayedTimeString+ ' is timestamp '
        +displayedTime+ ' ms; Calculated max allowed difference: ' +maxDifference+ ' ms.' );
    // Following works because timezone shifts are multiplies of 30min.
    if( validatePrecision && displayedTime%displayPrecisionInMilliseconds>0 ) {
        var msg= 'Timestamp precision validation failed. The displayed timestamp has value of precision lower than the given precision ' +displayPrecisionInMilliseconds+ 'ms. If this worked in past, then the application most likely changed. Change the precision.';
        LOG.error();
        throw new Error(msg);
    }
    return Math.abs( timestampInMilliseconds-displayedTime) <= maxDifference;
};

/** Anonymous object (serving as an associative array) {
 *  string timestampName: anonymous object {
 *      precision: number, the smallest unit of time displayed on the screen for respective timestamp elements
 *      nextDistinctTimestamp: number, a nearest future timestamp (in milliseconds)
 *          (that is, a value returned by Date.now() at that moment) when this timestampName
 *          can have a new distinct timestamp, which can be distinguished from the last one (and any older ones) using the given precision
 *  }
 *  where timestampName is a label/name, usually of a timestamp element or field (DB column),
 *  or of a whole fieldset (DB table) if it has only one timestamp field (column).
 **/
Selenium.prototype.distinctTimestamps= {};

/**I don't use prefix 'do' in the name of this function because it's not intended to be run as Selenium command.
  Use to record the moment when you inserted/updated a record of given type, and you want to
 *  compare that record's timestamp (whether soon or later) as formatted on the webpage (using given precision).
 *  <br/><br/>Warning: This keeps a count only of timestamps notes since you started Selenium IDE. If you re-started it soon
 *  after the previous run(s) which could record timestamps, make sure you wait for a sufficient period to get distinct new timestamps.
 *  @param string timestampName Type/use case group of the record that you're upgrading/inserting. Records that can be compared
 *  between each other should have same timestampName. Then this assures that they get timestamps that show up as distinct.
 *  Records with different timestampName can get same timestamps, because they are not supposed to be compared to each other.
 *  @param int timestampPrecision, the precision (lowest unit) of the timestamp, in milliseconds
 **/
Selenium.prototype.noteTimestamp= function( timestampName, timestampPrecision ) {
    timestampPrecision= Number(timestampPrecision);
    var nextDistinctTimestamp= Date.now()+ maxTimeDifference*1000 +timestampPrecision+ Number(this.defaultTimeout);
    this.distinctTimestamps[timestampName]= {
        precision: timestampPrecision,
        nextDistinctTimestamp: nextDistinctTimestamp
    };
};

/** This and similar functions have name starting with 'doWaitFor'. That way when you type 'waitForDistinctTimestamp' in Selenium IDE,
 *  it doesn't auto-suggest '...AndWait' alternatives, which we don't want and which would confuse user. If the function name
 *  was any doXyz that doesn't start with 'doWaitFor', Selenium IDE would auto-suggest '..AndWait' alternative, which don't make sense.
 * */
Selenium.prototype.doWaitForTimestampDistinctDownToMilliseconds= function( timestampName, precisionInMilliseconds ) {
    precisionInMilliseconds= precisionInMilliseconds || 1;
    this.waitForDistinctTimestamp( timestampName, precisionInMilliseconds );
};

Selenium.prototype.doWaitForTimestampDistinctDownToSeconds= function( timestampName, precisionInSeconds ) {
    precisionInSeconds= precisionInSeconds || 1;
    this.waitForDistinctTimestamp( timestampName, precisionInSeconds*1000 );
};

Selenium.prototype.doWaitTimestampDistinctDownToMinutes= function( timestampName, precisionInMinutes ) {
    precisionInMinutes= precisionInMinutes || 1;
    this.waitForDistinctTimestamp( timestampName, precisionInMinutes*60000 );
};

/**I don't use prefix 'do' in the name of this function
   because it's not intended to be run as Selenium command.
   @param string timestampName label/name, usually of a timestamp element or field, for which you want to get a distinct timestamp.
 *  @param int timestampPrecision, the precision (lowest unit) of the timestamp, in milliseconds.
 *  @return true if it's safe to create a new timestamp for this type of record, and the timestamp
 *  will be distinguishable from the previous one.
 **/
Selenium.prototype.waitForDistinctTimestamp= function( timestampName, precisionInMilliseconds ) {
    if( !(timestampName in this.distinctTimestamps) ) {
        LOG.info( 'waitForDistinctTimestampXXX: No previous timestamp for timestamp name ' +timestampName );
    }
    if( !(timestampName in this.distinctTimestamps) ) {
        this.noteTimestamp( timestampName, precisionInMilliseconds );
        return;
    }
    if( this.distinctTimestamps[timestampName].precision!==precisionInMilliseconds ) {
        var error= "You've called waitForDistinctTimestampXXX for timestampName='" +timestampName+
            "', precisionInMilliseconds=" +precisionInMilliseconds+ "ms. But the previous timestamp for this timestampName was recorded with different precision: "+
            this.distinctTimestamps[timestampName].precision+ 'ms.';
        LOG.error( error );
        throw new Error( error );
    }
    var timestampBecomesDistinct= this.distinctTimestamps[timestampName].nextDistinctTimestamp; // in milliseconds
    var timeOutFromNow= timestampBecomesDistinct-Date.now()+1100; // in milliseconds, plus a buffer
    if( timeOutFromNow<=0 ) {
        LOG.debug( 'waitForDistinctTimestampXXX: No need to wait. A distinct timestamp became available ' +(-1*timeOutFromNow/1000)+ ' sec. ago.' );
        return;
    }
    LOG.debug( 'waitForDistinctTimestampXXX: waiting for next ' +timeOutFromNow/1000+ ' sec.' );

    return Selenium.decorateFunctionWithTimeout(
        function () {
            // Somewhere here Firefox 23.0.1 Browser Console reports a false positive bug: 'anonymous function does not always return a value'. Ingore that.
            if( Date.now()>timestampBecomesDistinct ) {
                this.noteTimestamp( timestampName, precisionInMilliseconds );
                return true;
            }
            return false;
        },
        timeOutFromNow
    );
};

Selenium.prototype.doIndexBy= function( columnOrDetails, sourceVariableName ) {
    var indexBy= columnOrDetails, subIndexBy= null, resultVariableName= sourceVariableName;
    if( typeof columnOrDetails==='object' ) {
        indexBy= columnOrDetails.indexBy;
        if( columnOrDetails.subIndexBy===undefined ) {
            subIndexBy= columnOrDetails.subIndexBy;
        }
        if( columnOrDetails.target===undefined ) {
            resultVariableName= columnOrDetails.target;
        }
    }
    storedVars[resultVariableName]= SeLiteMisc.collectByColumn( storedVars[sourceVariableName], indexBy, !subIndexBy, subIndexBy );
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
    var radio= this.randomElement( radiosXPath );
    this.browserbot.clickElement( radio );

    if( store ) {
        SeLiteMisc.setFields( storedVars, store, radio.value );
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
    params= params || {};
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

Selenium.prototype.doSelectRandom= function( selectLocator, paramsOrStore ) {
    var params= paramsOrStore || {};
    if( typeof params =='string' ) {
        params= {store: params};
    }
    var option= this.randomOption( selectLocator, params );

    // This didn't work: this.browserbot.selectOption( select, option );
    this.doSelect( selectLocator, 'value=' +option.value );
    
    if( params && params.store ) {
        //storedVars[params.store]= option.value;
        SeLiteMisc.setFields( storedVars, params.store, option.value );
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
    params= params || {};
    var type= params.type || null;
    if( type && 
        (typeof type!=='string' || ['email', 'name', 'word', 'number', 'text', 'password', 'ugly'].indexOf(type)<0)
    ) {
        LOW.error( "randomText(): params.type='" +type+ "' is not recognised." );
        throw new Error();
    }
    var element= this.page().findElement(locator);

    var minLength= params.minLength || 1;
    minLength= Math.max( minLength, 1 );
    if( type==='email' ) {
        minLength= Math.max( minLength, 7 );
    }
    var maxLength= params.maxLength ||
        parseInt( element.getAttribute('maxlength') ) ||
        255;
    maxLength= Math.max( minLength, maxLength );

    var charRange= ''; // We'll use ASCII characters from within this range
    if( !type || type==='email' ) {
        charRange+= 'a-zA-Z'; // Email characters @ and . will be added when generating an email address
    }
    if(  !type || type==='number' ) {
        charRange+= '0-9';
    }
    if( type=='name=' || type==='word' ) {
        charRange+= 'a-z'; // Only used to fill-up after 'nice' first & last name
    }
    if( type==='text' ) {
        charRange+= ' a-z';
    }
    if( type==='password' ) {
        charRange+= 'a-z'; // There's more added below
    }
    if( !type ) {
        charRange+= ' _-';
    }
    if( type==='ugly' ) {
        charRange= "'\"./<>();";
    }
    var acceptableChars= SeLiteMisc.acceptableCharacters( new RegExp( '['+charRange+']' ) );
    var result= '';
    
    if( type==='name' ) {
        result= SeLiteMisc.randomItem( this.randomFirstNames )+ ' ' +SeLiteMisc.randomItem( this.randomSurnames );

        // Append random name-like string, min. randomThirdNameMinLength letters, max. randomThirdNameMaxLength letters,
        // plust a leading space, e.g. ' Xu...'
        if( result.length < maxLength-this.randomThirdNameMinLength ) {
            var thirdNameLength= this.randomThirdNameMinLength + Math.round( Math.random()*Math.min(
                this.randomThirdNameMaxLength-this.randomThirdNameMinLength,
                maxLength-1- this.randomThirdNameMinLength-result.length
            ) );
            result+= ' ' +SeLiteMisc.randomChar(acceptableChars).toUpperCase() +
                SeLiteMisc.randomString( acceptableChars, thirdNameLength-1);
        }
        result= result.substr( 0, maxLength ); // In case we've overrun it (by first or first+' '+last)
    }
    else
    if( type==='email' ) {
        if( extraParams ) {
            var name= '';
            var baseOnName= extraParams.baseOnName.replace( / /g, '-' );
            for( var i=0; i<baseOnName.length; i++ ) {
                if( acceptableChars.indexOf(baseOnName[i])>=0 ) {
                    name+= baseOnName[i];
                }
            }
            if( !name.length ) {
                name+= SeLiteMisc.randomChar( acceptableChars );
            }
        }
        else {
            // Generate email in form 'name@domain'. For nice human experience of testers we're generating
            // first.last@word.word-and-random-filling.(com|it|...) or
            // first@word.word-and-random-filling.(com|it|...) for c.a. 50% of results each.
            // If the part left of '@' were much longer, it's difficult to identify the email pattern by a human.
            var name= SeLiteMisc.randomItem( this.randomFirstNames ).toLowerCase();
            // If there's enough space, then for 50% of such cases, append a dot and a second name/part of it
            // Leave at least 5 characters for domain
            if( name.length<maxLength-6 && Math.random()>0.5 ) {
                name+= '.' +SeLiteMisc.randomItem( this.randomSurnames ).toLowerCase();
            }
        }
        name= name.substr(0, maxLength-6 ); // In case we've overrun, leave at least 5 letters for full domain
        
        var topDomains= maxLength- name.length > 6
            ? this.randomTopDomains
            : this.randomTopDomainsShort;
        var topDomain= SeLiteMisc.randomItem( topDomains );

        var maxMidDomainLength= maxLength- name.length- topDomain.length- 2;
        var midDomain= SeLiteMisc.randomItem( this.randomWords ).toLowerCase();
        if( maxMidDomainLength-midDomain.length >=2 ) {
            // Let's append a dash followed by 1 or more random alpha letters, e.g. '-xpqr', to midDomain
            var midDomainExtraLength= 1+ Math.round( Math.random()* Math.min(
                this.randomThirdNameMinLength,
                maxMidDomainLength- 2- midDomain.length
            ) );
            midDomain+= '-' +SeLiteMisc.randomString(acceptableChars, midDomainExtraLength ).toLowerCase();

        }
        midDomain= midDomain.substr(0, maxMidDomainLength );
        result= name+ '@'+ midDomain+ '.' +topDomain;
    }
    else
    if( !type || ['word', 'text', 'password', 'ugly', 'number'].indexOf(type)>=0 ) {
        if( type==='ugly' ) {
            // If possible, try to type all ugly characters at least once. But don't type more than maxLength
            minLength= Math.min( maxLength, Math.max(minLength,acceptableChars.length) );
        }
        if( type==='password' && minLength===1 ) {
            minLength= 9;
        }
        var totalLength= minLength+ Math.round( Math.random()*(maxLength-minLength) );
        
        if( type==='text' ) {
            while( result.length<totalLength ) {
                if( result ) {
                    result+= ' ';
                }
                result+= this.randomWords[Math.round( Math.random()*(this.randomWords.length-1) )];
            }
            result= result.substr( 0, maxLength ); // In case we've overrun it (by appending the last random word etc.)
        }
        else if( type==='password' ) {
            var capitals= SeLiteMisc.acceptableCharacters( new RegExp( '[A-Z]' ) );
            while( result.length+4<=minLength ) {
                result+= SeLiteMisc.randomChar( acceptableChars );
                result+= SeLiteMisc.randomChar( capitals );
                result+= SeLiteMisc.randomChar( '0123456789' );
                result+= SeLiteMisc.randomChar( '!@#$%^&*()-_' );
            }
            result+= SeLiteMisc.randomString(acceptableChars, totalLength-result.length );
        }
        else if( type==='ugly' ) {
            // Typing as many unique ugly characters as possible
            var numFirstUglies= Math.min( maxLength, acceptableChars.length );
            result= acceptableChars.substr(0, numFirstUglies);
            // Typing the rest (still, ugly ones)
            result+= SeLiteMisc.randomString(acceptableChars, totalLength-numFirstUglies);
        }
        else
        if( type==='number' ) {
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
            if( params.min!==undefined || params.max ) {
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
                result= SeLiteMisc.randomString(acceptableChars, totalLength);
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
            result= SeLiteMisc.randomString(acceptableChars, totalLength);
        }
    }
    else {
        throw new Error( "Error in randomText(): type=" +type );
    }
    return result;
};

Selenium.prototype.doTypeRandom= function( locator, paramsOrStore ) {
    var params= paramsOrStore || {};
    if( typeof params =='string' ) {
        params= {store: params};
    }
    var resultString= this.randomText( locator, params );

    LOG.debug('doTypeRandom() typing: ' +resultString );
    this.doType( locator, resultString );
    if( params.store ) {
        SeLiteMisc.setFields( storedVars, params.store, resultString );
    }
};
// @TODO This doesn't work well
Selenium.prototype.doTypeRandomEmail= function( locator, params ) {
    params= params || {};
    var paramsToPass= { type: 'email' };
    if( typeof params==='string' ) {
        var name= params;
    }
    else {
        if( params.from!==undefined ) {
            var fromElement= this.page().findElement( params.from );
            var name= fromElement.value!==undefined
                    ? fromElement.value
                    : fromElement.textContent;
        }
        else
        if( params.name===undefined ) {
            var name= params.name;
        }
        else {
            throw new Error( "You must pass the name to use for the email address, or pass an object with 'from' field which is a locator." );
        }
        SeLiteMisc.objectClone( params, ['minLength', 'maxLength'], [], paramsToPass );
    }
    var extraParamsToPass= {
        baseOnName: name
    };
    var resultString= this.randomText( locator, paramsToPass, extraParamsToPass );

    LOG.debug('doTypeRandomEmail() typing: ' +resultString );
    this.doType( locator, resultString );
    if( params.store ) {
        SeLiteMisc.setFields( storedVars, params.store, resultString );
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