<?xml version='1.0' encoding="UTF-8"?>
<html xsl:version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
      xmlns="http://www.w3.org/1999/xhtml">
  <head>Selenese documentation</head>
  <body>
      <xsl:for-each select="apidoc/function">
          <p>Function <xsl:value-of select="@name" />
          </p>
      </xsl:for-each>
  </body>
</html>