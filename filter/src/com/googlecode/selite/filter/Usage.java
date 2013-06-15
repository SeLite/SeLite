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

import java.util.List;
import java.util.Arrays;

public enum Usage {
    SCHEMA {
        public List<Filter> filters() {
            return Arrays.asList( new Filter[]{
                FilterComments.instance, FilterBackslashQuote.instance, FilterSchemaCleanup.instance, FilterSchemaSerial.instance,
                FilterUnusedTables.instance, FilterUnusedViews.instance,
                FilterExtraNewLines.instance
            } );
        }
        
        public boolean requiresAllInHeap() {
            return true;
        }
    },
    
    DATA {
        public List<Filter> filters() {
            return Arrays.asList( new Filter[]{
                FilterComments.instance, FilterBackslashQuote.instance, FilterUnusedInserts.instance, FilterDataCleanup.instance, FilterDataSerial.instance,
                FilterExtraNewLines.instance
            } );
        }
    },
    
    ALL {
        public List<Filter> filters() {
            return Arrays.asList( new Filter[]{
                FilterComments.instance, FilterBackslashQuote.instance, FilterSchemaCleanup.instance, FilterSchemaSerial.instance,
                FilterUnusedTables.instance, FilterUnusedViews.instance,
                FilterUnusedInserts.instance, FilterDataCleanup.instance, FilterDataSerial.instance,
                FilterExtraNewLines.instance
            } );
        }
        
        public boolean requiresAllInHeap() {
            return false; //true;//@TODO check this
        }
    };
    
    /** @return a list of Task objects, in the order that they are to be run.
     */
    public abstract List<Filter> filters();
    
    /** @return Whether this usage requires the whole input and output to be available in memory.
     */
    public boolean requiresAllInHeap() {
        return false;
    }
    
    private Usage() {
        assert filters().get(0)==FilterComments.instance : "First task must be Task.FILTER_COMMENTS. This is for optimisation of in-comments/in-quote detection between sequences.";
    }
}