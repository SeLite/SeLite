<?xml version='1.0' encoding="UTF-8"?>
<!-- When debugging this in Firefox:
- have Commands (or any other extension) from filesystem loaded via Firefox extension proxy. See setup_proxies.sh
- cd commands/src/chrome/content/
- ln -s ../../../../selenese_reference_to_html.xsl
- vi reference.xml, change it to load "selenese_reference_to_html.xsl" instead of "https://selite.googlecode.com/git/selenese_reference_to_html.xsl"
- then open chrome://selite-commands/content/reference.xml
Somehow XSLT doesn't work when .xml file is open via file://
-->
<xsl:stylesheet
    version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="apidoc">
        <!-- Following html element must not have xmlns:xsl
        and xmlns="http://www.w3.org/1999/xhtml", otherwise it doesn't render well.-->
        <html lang="en-US" dir="ltr" encoding="UTF-8">
          <head>
              <meta charset="utf-8"></meta>
              <title><xsl:value-of select="@package-name"/> - reference of commands</title>
          </head>
          <body>
              <xsl:for-each select="function">
                  <h3>
                      <xsl:value-of select="@name" />
                  </h3>
                  <p>
                    <xsl:if test="param">
                        Arguments:
                        <dl>
                            <xsl:apply-templates select="param"/>
                        </dl>
                    </xsl:if>
                    <xsl:apply-templates select="comment" />
                    <xsl:if test="return">
                        <br/><br/>
                        Returns:
                        <dl>
                            <xsl:apply-templates select="return"/>
                        </dl>
                    </xsl:if>
                  </p>
              </xsl:for-each>
          </body>
        </html>
    </xsl:template>
    <xsl:template match="param">
        <dt><code><xsl:value-of select="@name" /></code></dt>
        <dd><xsl:apply-templates/></dd>
    </xsl:template>
    <xsl:template match="return">
        <dt><code><xsl:value-of select="@type" /></code></dt>
        <dd><xsl:apply-templates/></dd>
    </xsl:template>
    <!-- HTML tags to copy
    -->
    <xsl:template match="br">
        <br/>
    </xsl:template>
    <xsl:template match="ul">
        <ul><xsl:apply-templates/></ul>
    </xsl:template>
    <xsl:template match="li">
        <li><xsl:apply-templates/></li>
    </xsl:template>
    <xsl:template match="dl">
        <dl><xsl:apply-templates/></dl>
    </xsl:template>
    <xsl:template match="dt">
        <dt><xsl:apply-templates/></dt>
    </xsl:template>
    <xsl:template match="dd">
        <dd><xsl:apply-templates/></dd>
    </xsl:template>
    <xsl:template match="code">
        <code><xsl:apply-templates/></code>
    </xsl:template>
    <xsl:template match="b">
        <b><xsl:apply-templates/></b>
    </xsl:template>
    <xsl:template match="i">
        <i><xsl:apply-templates/></i>
    </xsl:template>
</xsl:stylesheet>