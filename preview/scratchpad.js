// For ifAsync...endIfAsync:
// eval() can't return a value via 'return' keyword. It only yields value of its last expression. Hence it can't return value from an asynchronous call.
//eval( "1;")

// All combinations run <script>:

//var win= window.open( "chrome://selite-preview/content/preview.xul", "SeLite Preview", "chrome,resizable=1"/**/);

//var win= window.open( "file:///D:/localdata/pkehl/SeLite/preview/demo/content.html", "SeLite Preview", "chrome,resizable=1"/**/);
// -> <title> shows up

var win= window.open( "file:///D:/localdata/pkehl/SeLite/preview/demo/content.html", "SeLite Preview", "resizable=1"/**/);
//win.document.write( 'from outside JS - outside load handler'); // -> SecurityError: The operation is insecure.

var script = win.document.createElement('script');
script.setAttribute('src','http://example.com/site.js');
win.document.head.appendChild( script );

var request = new XMLHttpRequest();
//request.open('GET', "data:text/html," +encodeURIComponent('<html><head><script type="javascript">alert("hi");</script></head><body onload="alert(\'onload\')">bod</body></html>'), false);  // `false` makes the request synchronous
request.open('GET', 'file:///D:/localdata/pkehl/selite/preview/demo/simple.xml', false );
request.send(null);
if (request.status === 200) {
  //alert( request.responseText );
  var doc= request.responseXML; // Not defined if URL is data:
  var body= doc.getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", 'body')[0];
  body.setAttribute( 'onload', 'alert("ho")'); // it has effect
  //alert( doc );
  var html= doc.getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", 'html')[0];
  
  //alert( body.innerHTML );
  alert( html.innerHTML );
}

//encodeURIComponent('<b>bold</b> man')
//%3Cb%3Ebold%3C%2Fb%3E%20man

var win= window.open( "data:text/xml," +encodeURIComponent('<root><b>bold</b> man</root>') );
win.addEventListener( 'load', () => {alert('loaded');} );

window.open( "data:text/html," +encodeURIComponent('<html><head><script type="javascript">alert("hi");</script></head><body onload="alert(\'onload\')">bod</body></html>')  );
window.open( "data:text/html," +encodeURIComponent('<html><head><script type="javascript"></script></head><body>bod<script>alert(\'onload\');</script></body></html>')  );
              var body= document.getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", 'body')[0];
              body.setAttribute( 'onload', 'alert("hi")');
              alert( body.innerHTML );

window.open( "data:text/html," +encodeURIComponent('<html><head></head><body>body - JS with type<script  type="text/javascript">window.addEventListener( \'load\', ()=>{alert(\'onload handler\');} );</script></body></html>')  ); // -> OK

window.open( "data:text/html," +encodeURIComponent('<html><head></head><body><script type="text/javascript"> document.addEventListener("load", ()=>{alert("hi");} );</script></body></html>')  ); // --> NO

window.open( "data:text/xml," +encodeURIComponent('<html><head></head><body><script xmlns="http://www.w3.org/2000/svg"> document.addEventListener("load", ()=>{alert("hi");} );</script></body></html>')  ); //->NO
window.open( "data:text/xml," +encodeURIComponent('<html><head></head><body><script xmlns="http://www.w3.org/2000/svg"> document.onload= ()=>{alert("hi");};</script></body></html>')  ); //->NO

window.open( "data:text/xml," +encodeURIComponent('<html><head></head><body><script xmlns="http://www.w3.org/2000/svg"> document.onreadystatechange = ()=>{ /*if (document.readyState==="complete")*/ alert("document.readyState " +document.readyState); } </script></body></html>')  );
//--> Don't use SVG

window.open( "data:text/xml," +encodeURIComponent('<root><b>bold</b> man</root>') );

window.open( "data:text/xml," +encodeURIComponent(`<root>
  <b>bol<d>d</d></b>
  <script xmlns="http://www.w3.org/1999/xhtml"><![CDATA[
    alert( 'location ' +location);
  ]]></script>
</root>`)+ '#hi=true' );
//  Enclose the inner encoded result of src="..." within quotes "...", not within apostrophes '...' - because the encoded text may contain apostrophes, but no quotes (since encodeURIComponent("'") is "'", but encodeURIComponent('"') is '%22' and not '"'). This works multi-level.
window.open( "data:text/xml," +encodeURIComponent(`<root>
  <b>bol<d>d</d></b>
  <script xmlns="http://www.w3.org/1999/xhtml" src="data:text/javascript,` +encodeURIComponent("alert( location);")+ `"></script>
</root>`)+ '#' +/*encodeURIComponent(*/ JSON.stringify( {hi: 'you & i'} ) /*)*/ );

alert( Components.classes["@mozilla.org/mime;1"].getService(Components.interfaces.nsIMIMEService).getTypeFromExtension('xhtml') );
//-->application/xhtml+xml

/*
Both XML and HTML:
- if the template contains SELITE_PREVIEW_DATA, then fill it there; similar for config object. Otherwise inject <script>...</script> which
-- passes the data and config as object JSON-like literals
-- calls seLitePreviewDisplay()

HTML only:
non-inject but set win load handler, which calls seLitePreviewConnect(), which connects the links etc. to Selenium IDE.
*/

var inner= {inner: true};
var outer= {first: inner, second: inner };
JSON.stringify( outer)


/*
Exception: Error: Access to 'file:///D:/localdata/pkehl/SeLite/preview/demo/content.html' from script denied
@Scratchpad/1:8:10
*/