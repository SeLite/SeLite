"use strict";

// Based on see http://www.w3schools.com/xsl/xsl_client.asp. See that page for IE.
/** @param {string} filename
 *  @param {function(xml)} handler
 * */
function loadXMLDoc( filename, handler )
{
  var xhttp = new XMLHttpRequest();
  xhttp.open("GET", filename, true/*async*/);
  xhttp.onload= function onload() {
      if( this.readyState===4 && this.status===200 ) {
        handler( this.responseXML );
      }
  };
  xhttp.send(null);
}

function displayResult()
{
  var bodyElement= document.getElementById("body");
  if( window.location.search ) {
      loadXMLDoc( (''+window.location.search).substring(1), function handleXML(xml) {
        loadXMLDoc( "selenese_reference_to_html.xsl", function handleXSL(xsl) {
            var xsltProcessor = new XSLTProcessor();
            xsltProcessor.importStylesheet(xsl);
            var resultDocument = xsltProcessor.transformToFragment(xml, document);
            bodyElement.appendChild(resultDocument);
        });
      });
  }
  else {
      bodyElement.appendChild( document.createTextNode('Please invoke with ?path/to/file.xml') );
  }
}

