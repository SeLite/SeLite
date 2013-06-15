/*  Copyright 2012, 2013 Peter Kehl
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

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** This removes lines starting with '--', but only if they are not in SQL string values (between apostrophes).
 *  Some string values (e.g. encryption certificates) do start with '--' on new line, and this preserves them.
 *  @TODO Remove also C-like comments that start with '/*'
 */
public final class FilterComments extends FilterRemover {
    public static final FilterComments instance= new FilterComments();
    
    protected boolean backslashEscapes() {
        return true;
    }
    
    protected FixedStartResult processFixedStart( CharSequence input, int i, int pastMatcheable ) {
        char c= input.charAt(i);
        boolean startsWithDash= c=='-';
        if( startsWithDash || c=='/' ) {
            final int length= input.length();
            final int openingComment= i;
            i++;
            // Following if() checks i<=pastMatcheable, not i<pastMatcheable. That's to handle a comment whose first '-' or '/' is in the matcheable area
            // and the second '-' or '*' is not. The extra check i<length is there to handle a single '-' or single '/' at the end of file.
            if( i<=pastMatcheable && i<length
            && (   startsWithDash && input.charAt(i)=='-'
               || !startsWithDash && input.charAt(i)=='*')
            ) {
                if( ++i<length ) {
                    if( !(startsWithDash && input.charAt(i)=='\n')
                    &&  !(!startsWithDash && input.charAt(i)=='*' && i+1<length && input.charAt(i+1)=='/')
                    ) {
                        while( ++i<length ) {
                            if( startsWithDash && input.charAt(i)=='\n' ) {
                                break;
                            }
                            if( !startsWithDash && input.charAt(i-1)=='*' && input.charAt(i)=='/' ) {
                                i++;
                                break;
                            }
                        }
                    }
                    // else: the -- comment has just ended, i.e. "--\n" or "/**/"
                }
                assert i<=length;
                // Return a range that covers the whole comment, even though it may cross over the matcheable range.
                // The caller needs to know in either case, so that the caller will know how to handle it.
                return new FixedStartResult( openingComment, i, i);
            }
        }
        return null;
    }
}