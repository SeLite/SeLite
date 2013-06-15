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

import java.util.Map;
import java.util.HashMap;
import java.util.Arrays;

public class FilterGroup extends Filter {
    private final Map<Db, Iterable<Filter> > filters= new HashMap<Db, Iterable<Filter> >();
    
    /** @param dbs Array of Db that this will work for.
     *  @param filtersMatrix Matrix, with array(s) of Filter(s) in the same order as respective Db objects in dbs[].
     *  When FilterGroup.initialise(App,Run) is called, it will call initialise(App,Run) on each filter.
     */
    public FilterGroup( Db dbs[], Filter filtersMatrix[][] ) {
        assert dbs.length==filtersMatrix.length : "Must give same number of entries in dbs[] and filtersMatrix[][].";
        assert filtersMatrix.length>0 : "Expecting at least one filter.";
        
        for( int i=0; i<dbs.length; i++ ) {
            filters.put( dbs[i], Arrays.asList( filtersMatrix[i] ) );
        }
    }
    
    protected final int process( App app, Run run, int pastMatcheable ) {
        return Filter.processMultiple( filters.get( run.get(Run.DB)), app, run, pastMatcheable );
    }
    
    public final void initialise( App app, Run run ) {
        for( Iterable<Filter> filtersPerDb: filters.values() ) {
            for( Filter filter: filtersPerDb ) {
                filter.initialise(app, run);
            }
        }
    }
}