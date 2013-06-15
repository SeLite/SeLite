/*  Copyright 2012 Peter Kehl
    This file is part of SeLite Filter.

    SeLite Filter is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Foobar is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Filter.  If not, see <http://www.gnu.org/licenses/>.
*/
package com.googlecode.selite.filter;

import java.lang.Math;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Arrays;
import java.util.regex.Pattern;

/** Not Serializable - no need for that.
 */
public final class GeneralVersion implements Comparable<GeneralVersion> {
    final String version;
    final List<String> slices;
    
    private static final Pattern pattern= Pattern.compile( ".-" );
    
    /** @param String givenVersion must not start with 0 (unless it's the only 0 in front of a decimal dot), otherwise
     *  if another Version instance is created with exact same givenVersion
     *  except for that leading zero, those two instances would not equal.
     *  Note: if in future I want to make it accept leading zero, then it should be the same with leading
     *  zeros in slices that were proceeded by characters other than '.' - e.g. a space or dash.
     */
    public GeneralVersion( String givenVersion ) {
        version= givenVersion;
        //List<String> slices= new ArrayList<String>();
        slices= Collections.unmodifiableList( Arrays.asList( pattern.split(givenVersion) ) );
    }
    
    public String toString() { return version; }
    
    public boolean equals( Object other ) {
        return other instanceof GeneralVersion && slices.equals( ((GeneralVersion)other).slices);
    }
    
    public int hashCode() {
        return slices.hashCode();
    }
    
    /** @param int maxSlice Number of version 'slices' to check, as they were separated in version string.
     * 1 means checking the first (leftmost) slice only.
     */
    public int compareTo( GeneralVersion other, int maxSlice ) {
        for( int i=0; i<slices.size() && i<maxSlice; i++ ) {
            if( i>=other.slices.size() ) {
                return 1;
            }
            int sliceCompare= slices.get(i).compareTo( other.slices.get(i) );
            if( sliceCompare!=0 ) {
                return sliceCompare;
            }
        }
        return Math.min( maxSlice, slices.size() ) - Math.min( maxSlice, other.slices.size() );
    }
    
    /** Not static and not final, so that subclasses override this if they need to.
     *  Default implementation supports fully numeric versions or those with one or several dots and/or dashes in them.
     *  It doesn't support whitespaces or other characters.
     * @return -1, 0, 1 depending on whether version represented by first is lower than, equal or greater than
     * version represented by second, respectively.
     */
    public int compareTo( GeneralVersion other ) {
        return compareTo( other, 1000 );
    }
}