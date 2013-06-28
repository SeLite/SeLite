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

import net.sourceforge.argparse4j.inf.ArgumentParser;

public abstract class App {
    /** Put any custom Field entries into run.appFields() as appropriate for version indicated by version().
     */
    protected void initialiseRun( Run run ) {
    }
    
    /** Regex subpattern that will match all table names to remove, and it won't
     *  match any table names to keep in the export.
        That partial regex pattern should work whether with java.util.regex.Pattern.COMMENTS or not. So don't have any whitespace in it that isn't
        supposed to be part of the matched contents. It must not contain any capturing groups - so use noncapturing ones only (?...).
     */
    public static final class RemovedTableNamesPattern extends FieldSingleton<String> {
        RemovedTableNamesPattern() { super( String.class, "removedTableNamesPattern"); }
    };
    public static final Field<String> REMOVED_TABLE_NAMES_PATTERN= new RemovedTableNamesPattern();
    
    /** Regex subpattern that will match all view names to remove, and it won't
     *  match any view names to keep in the export.
        That partial regex pattern should work whether with java.util.regex.Pattern.COMMENTS or not. So don't have any whitespace in it that isn't
        supposed to be part of the matched contents. It must not contain any capturing groups - so use noncapturing ones only (?...).
     */
    public static final class RemovedViewNamesPattern extends FieldSingleton<String> {
        RemovedViewNamesPattern() { super( String.class, "removedViewNamesPattern"); }
    };
    public static final Field<String> REMOVED_VIEW_NAMES_PATTERN= new RemovedViewNamesPattern();
    
    /** Number of characters of the longest matcheable sequence for any filter. */
    public static final class MaxMatchLength extends FieldSingleton<Integer> {
        MaxMatchLength() { super( Integer.class, "maxMatchLength"); }
        //@TODO Following default value must be less than CharSequenceContinuous.maxLengthToBuffer
        protected void registerWithParser( ArgumentParser parser ) {
            registerSimple( parser, true, 1000000 );
        }
    };
    public static final Field<Integer> MAX_MATCH_LENGTH= new MaxMatchLength();
    
    /** @return Application-specific value of the field; null if not known. Used by filters etc.
     *  Subclasses should chain their implementation with parent's implementation.
     */
    protected abstract <T> T getAppValue( Field<T> field, Run run );
}