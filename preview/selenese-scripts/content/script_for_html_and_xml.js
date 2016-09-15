"use strict";

/** In standard use, code of the this function be would simpler, only with functionality relevant to how you pass the data, normally. Here are all alternatives only for reuse be several HTML files.
 * @param {object} config
 * @param {(string|undefined)} injectedDataInJSONandEncoded
 * @param {(string|undefined)} injectionPlaceholderLiteralValue
 * @returns {*} Undefined if no data.
 */
function extractData( config, injectedDataInJSONandEncoded, injectionPlaceholderLiteralValue ) {
    var hashEmpty= location.hash.length===0;
    var dataWasInjected= injectedDataInJSONandEncoded!==injectionPlaceholderLiteralValue && injectionPlaceholderLiteralValue!==undefined;
    // Following has to be within apostrophes, not within quotes. The value reflects config.dataPlaceholder for selenium.encode*() functions.
    hashEmpty || !dataWasInjected || console.warn( "Unless you use anchor links, check: you're using both a hash and injected data." );
    config.dataInHash==!dataWasInjected || alert( "config.dataInHash is " +config.dataInHash+ ", but presence of injected data is " +dataWasInjected+ ". Use exactly one of those two." );

    var dataInJSONandEncoded;
    if( config.dataInHash ) {
        if( !hashEmpty ) {
            dataInJSONandEncoded= location.hash.substring(1);
        }
    }
    else {
        dataInJSONandEncoded= injectedDataInJSONandEncoded;
    }
    if( dataInJSONandEncoded!==undefined ) {
        var dataInJSON= config.dataInHash
            ? ( 'urlEncodeData' in config && config.urlEncodeData
                ? decodeURIComponent(dataInJSONandEncoded)
                : atob(dataInJSONandEncoded)
              )
            : dataInJSONandEncoded;
        return JSON.parse(dataInJSON);
    }
}
