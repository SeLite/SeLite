/*  Copyright 2013 Peter Kehl
    This file is part of SeLite Filter.

    SeLite Filter is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Filter is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Filter.  If not, see <http://www.gnu.org/licenses/>.
*/
package com.googlecode.selite.filter;

import java.io.FileWriter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Replace \' with '' and \\ with \ anywhere within string literals '...'. It can be used for both schema (e.g. default values) and data.
 *  Needed for MySQL string literals containign either a backslash or an apostrophe; needed for Postgresql literals containing a backslash.
 *  <br/>This class doesn't extend FilterReplace, because it would have to have String replacement(Matcher matcher, Run run), which
 *  uses $1, $2... for capturing groups, and that would not work if the matched content contains '$' character.
 */
public final class FilterBackslashQuote extends Filter {
    /** @overrides Filter.process(App,Run,int)
     */
    protected int process( App app, Run run, int pastMatcheable ) {
        final CharSequence input= run.sequenceManager().input();
        final StringBuffer output= run.sequenceManager().output();
        final int length=input.length();
        assert pastMatcheable>=0 && pastMatcheable<=length;
        assert pastMatcheable>0 || length==0;
        
        int i= 0;
        outer:
        for( ; i<pastMatcheable; i++ ) {
            final char c= input.charAt(i);
            
            if( c=='\'' ) {
                StringBuilder quoted= new StringBuilder();
                int j= i;
                inner:
                while( ++j<pastMatcheable ) {
                    char d= input.charAt(j);
                    if( d=='\\' ) {
                        // Skip that backslash '\\' (the escape character itself). Treat the next character:
                        // - if it's a backslash '\\', append it as it is
                        // - if it's a quote '\'', double it.
                        // and some more.
                        if( ++j<pastMatcheable ) {
                            char e= input.charAt(j);
                            switch( e ) {
                                case '\\':
                                case '"':
                                    quoted.append( e );
                                    break;
                                case '\'':
                                    quoted.append( "''" );
                                    break;
                                case 'n':
                                    quoted.append( '\n' );
                                    break;
                                default:
                                    throw new IllegalStateException( "Extend FilterBackslashQuote to cover \\" +e );
                            }
                        }
                        continue inner;
                    }
                    if( d=='\'' ) {
                        output.append( '\'').append( quoted ).append( '\'' );
                        i= j;
                        continue outer; // end of a quoted string
                    }
                    quoted.append( d );
                }
                if( !run.sequenceManager().allWasRead() ) {
                    throw new IllegalStateException( "Matcheable range of the subsequence contains an opening apostrophe with no matching closing apostrophe in the same subsequence." );
                }
                break outer; // We reached the end of input, and there's no closing apostrophe. OK.
            }
            output.append( c );
        }
        int result= output.length();
        if( i<length ) {
            output.append( input, i, length);
        }
        return result;
    }
    
    public static final FilterBackslashQuote instance= new FilterBackslashQuote();
}