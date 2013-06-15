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

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public abstract class FilterRemoverByPattern extends FilterRemover {
    /** I don't use Pattern.MULTILINE, because I only register a match starting exactly at my given index,
     *  not any further in the input.
     */
    protected abstract Pattern pattern();
    
    protected final FilterRemover.FixedStartResult processFixedStart( CharSequence input, int i, int pastMatcheable ) {
        final int length= input.length();
        assert i>=0 && i<length;
        Matcher matcher= pattern().matcher(input);
        matcher.region( i, length); // @TODO I could store matcher as an object variable. (future: Then clear it once it's not used anymore)
        assert matcher.hasAnchoringBounds();
        if( matcher.find() ) {
            return new FilterRemover.FixedStartResult( i, matcher.end(), matcher.end() );
        }
        return null;
    }
}