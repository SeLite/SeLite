/*  Copyright 2012, 2013 Peter Kehl
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

import java.util.Collection;
import java.util.ArrayList;

public abstract class AppListedTables extends App {
    protected <T> T getAppValue( Field<T> field, Run run ) {
        if( field==App.REMOVED_TABLE_NAMES_PATTERN ) {
            StringBuilder keptPrefixes= new StringBuilder();
            {
                for( String keptPrefix:keptTablePrefixes(run) ) {
                    if( keptPrefixes.length()>0 ) {
                        keptPrefixes.append('|');
                    }
                    keptPrefixes.append( keptPrefix );
                }
            }
            StringBuilder removedPrefixes= new StringBuilder();
            {
                for( String removedPrefix:removedTablePrefixes(run) ) {
                    if( removedPrefixes.length()>0 ) {
                        removedPrefixes.append( '|' );
                    }
                    removedPrefixes.append( removedPrefix );
                }
            }
            return (T)( "(?!" +keptPrefixes+ ")(?:" +removedPrefixes+ ")" );
        }
        if( field==App.REMOVED_VIEW_NAMES_PATTERN ) {
            StringBuilder keptPrefixes= new StringBuilder();
            {
                for( String keptPrefix:keptViewPrefixes(run) ) {
                    if( keptPrefixes.length()>0 ) {
                        keptPrefixes.append('|');
                    }
                    keptPrefixes.append( keptPrefix );
                }
            }
            StringBuilder removedPrefixes= new StringBuilder();
            {
                for( String removedPrefix:removedViewPrefixes(run) ) {
                    if( removedPrefixes.length()>0 ) {
                        removedPrefixes.append( '|' );
                    }
                    removedPrefixes.append( removedPrefix );
                }
            }
            return (T)( "(?!" +keptPrefixes+ ")(?:" +removedPrefixes+ ")" );
        }
        return null;
    }
    
    /** @return a new instance on each call, and a mutable one. If implemented in 1st level
     *  subclass, then 2nd level and deeper subclasses
     *  can override this function, call the parent function, modify the returned
     *  instance and return it.
     */
    protected abstract Collection<String> removedTablePrefixes( Run run );
    
    /** @return a new instance on each call, and a mutable one. If implemented in 1st level
     *  subclass, then 2nd level and deeper subclasses
     *  can override this function, call the parent function, modify the returned
     *  instance and return it.
     */
    protected abstract Collection<String> keptTablePrefixes( Run run );
    
    /** @return a new instance on each call, and a mutable one. If implemented in 1st level
     *  subclass, then 2nd level and deeper subclasses
     *  can override this function, call the parent function, modify the returned
     *  instance and return it.
     */
    protected Collection<String> removedViewPrefixes( Run run ) {
        return new ArrayList<String>();
    }
    
    /** @return a new instance on each call, and a mutable one. If implemented in 1st level
     *  subclass, then 2nd level and deeper subclasses
     *  can override this function, call the parent function, modify the returned
     *  instance and return it.
     */
    protected Collection<String> keptViewPrefixes( Run run ) {
        return new ArrayList<String>();
    }
}