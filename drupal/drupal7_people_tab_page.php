<?php
//sleep(1);
header( 'Cache-Control: no-cache, must-revalidate, post-check=0, pre-check=0' );
header( 'Connection: Keep-Alive' );
header( 'Content-Language: en');
header( 'Content-Type: text/html; charset=utf-8');
header( 'Date: Sun, 26 Jan 2014 23:57:40 GMT' );
header( 'Etag: "1390780660"' );
header( 'Expires: Sun, 19 Nov 1978 05:00:00 GMT' );
header( 'Keep-Alive: timeout=5, max=100' );
header( 'Last-Modified: Sun, 26 Jan 2014 23:57:40 +0000' );
header( 'Server: Apache/2.4.6 (Fedora) PHP/5.5.7' );

header( 'X-Generator: Drupal 7 (http://drupal.org)');
header( 'X-Powered-By: PHP/5.5.7' );

header( 'Transfer-Encoding: chunked');

$content= <<<END_OF_CONTENT
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML+RDFa 1.0//EN"
  "http://www.w3.org/MarkUp/DTD/xhtml-rdfa-1.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" version="XHTML+RDFa 1.0" dir="ltr">
    <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <title>Localhost link - referred file</title>
    </head>
<body>
    <p>
        Simple file.
    </p>
</body>
</html>
END_OF_CONTENT;

// Echo length of contents, in hexadecimal, followed by \r\n
echo dechex( strlen($content) ); echo "\r\n";

echo $content;
echo "\r\n0\r\n\r\n";
?>