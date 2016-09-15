"use strict";
function alertFromJSfile( message ) {
    alert( message );
}

// In standard use, the rest of this file would be a part of HTML file normally. (As an inline Javascript and HTML content, respectively). It's factored out here only for reuse by several HTML files.

// In standard use, code of the this function be would simpler, only with functionality relevant to how you pass the data, normally. Here are all alternatives only for reuse be several HTML files.
function useData( config, injectedDataInJSONandEncoded, injectionPlaceholderLiteralValue ) {
  if (document.readyState==="complete") {
    document.getElementById('content').innerHTML= contentHTML();

    var data= extractData( config, injectedDataInJSONandEncoded, injectionPlaceholderLiteralValue );
    if( data!==undefined ) {
        // The whole data will be an array of (primitive) strings. Use those strings for both text and URL of <a> elements:
        // See https://beebole.com/pure/
        var directive = {
            entry:{
                'data<-':{
                    '.': 'data',
                    '@data-text': 'data'
                }
            }
        };
        // As per https://groups.google.com/forum/#!searchin/Pure-Unobtrusive-Rendering-Engine/pure$20without$20jquery/pure-unobtrusive-rendering-engine/Cmt1bqfsZLg/rhGP8ZqfliAJ
        $p('#results').render( data, directive );
        
        var results= document.getElementById('results');
        var exportXML= results.innerHTML;
        var exportURL= 'data:text/xml,' +encodeURIComponent( '<?xml version="1.0" encoding="UTF-8"?>' +exportXML );
        location.href= exportURL;
    }
  }
}

function contentHTML() {
    return `
    <div id="results">
        <entries>
          <entry happy="yes"/>
        </entries>
    </div>`;
}

