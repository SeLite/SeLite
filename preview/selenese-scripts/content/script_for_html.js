"use strict";
function alertFromJSfile( message ) {
    alert( message );
}

// In standard use, the rest of this file would be a part of HTML file normally. (As an inline Javascript and HTML content, respectively). It's factored out here only for reuse by several HTML files.

// In standard use, code of the this function would simplified, only with functionality relevant to how you pass the data, normally. Here are all alternatives only for reuse be several HTML files.
function useData( config, injectedDataInJSONandEncoded, injectionPlaceholderLiteralValue ) {
  if (document.readyState==="complete") {
    document.getElementById('content').innerHTML= contentHTML();

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
        var data= JSON.parse(dataInJSON);

        // The whole data will be an array of (primitive) strings. Use those strings for both text and URL of <a> elements:
        // See https://beebole.com/pure/
        var directive = {
            'li':{
                'data<-':{
                    'a': 'data',
                    'a@href': 'data'
                }
            }
        };
        // As per https://groups.google.com/forum/#!searchin/Pure-Unobtrusive-Rendering-Engine/pure$20without$20jquery/pure-unobtrusive-rendering-engine/Cmt1bqfsZLg/rhGP8ZqfliAJ
        $p('#results').render( data, directive );
    }
  }
}

function contentHTML() {
    return `
    <a href="javascript:alertFromJSfile('alertFromJSfile()')">call a function from a local JS file</a><br/>
    <a href="javascript:alertFromInlineJS('alertFromInlineJS()')">call a function defined in inline JS in the (original) HTML</a><br/>
    <a href="javascript:callBackOutFlow( 'sayHello' )">call back Selenium</a>
    <br/>
    <div id="results">
        <ul class="image-decorated">
          <li>
              <a data-mood="happy" href=""></a>
          </li>
        </ul>
    </div>`;
}
