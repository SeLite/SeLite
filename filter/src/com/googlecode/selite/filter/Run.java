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

import java.util.List;
import java.util.Arrays;
import java.util.Collections;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Not thread-safe - that's fine.
 */
public final class Run {
    /** @var args Commandline argument(s), if any.
     */
    private final List<String> args;
    
    /** It serves as a cache.
     */
    private final Map<Field, Object> appFields= new HashMap<Field, Object>();
    
    private CharSequenceManager sequenceManager;
    
    private int maxMatchLength; //@TODO make it final; re-organise main() and constructor; change docs of maxMatchLength()
    
    /** Maximum matcheable length, a maximum of maxMatchLength() across all
     *  Filter(s) applicable by given run. Only valid once set. */
    int maxMatchLength() { return maxMatchLength; }
    
    public List<String> args() { return args; }
    
    /** @return mutable map
     */
    protected Map<Field, Object> appFields() { return appFields; }
    
    /** Its result must not be cached by the client code, because sequenceManager can change
     *  (e.g. when reading from standard input, it may be CharSequenceManagerInMemory initially,
     *  and it may switch to CharSequenceManagerInFile if the input turns out to be too long).
     */
    public CharSequenceManager sequenceManager() { return sequenceManager; }
    
    public <T> T get( Field<T> field ) {
        if( appFields.containsKey(field) ) {
            return (T)appFields.get(field);
        }
        T value;
        if( field.canParse() ) {
            value= field.parse( this );
        }
        else {
            value= field.defaultValue();
        }
        if( value!=null ) {
            appFields.put( field, value );
        }
        return value;
    }
    
    private Run( String givenArgs[] ) {
        args= Collections.unmodifiableList( Arrays.asList(givenArgs) );
    }
    
    private void initialiseSequenceManager( Usage usage ) {
        sequenceManager= usage.requiresAllInHeap()
            ? new CharSequenceManagerInMemory( args.get(1), args.get(2), this )
            : new CharSequenceManagerContinuous( args.get(1), args.get(2), this );
        if( !(sequenceManager instanceof CharSequenceManagerInMemory) && usage.requiresAllInHeap() ) {
            throw new IllegalStateException();
        }
    }
    
    public static final class UsageField extends FieldSingleton<Usage> {
        UsageField() { super( "usage" ); }
        public Usage defaultValue() { return Usage.DATA; }
        public boolean canParse() { return true; }
    
        /** @overrides Field#parse(Run)
         */
        protected Usage parse( Run run ) {
            switch( (""+this.argValue(run, "usage")).toLowerCase() ) {
                case "schema":
                    return Usage.SCHEMA;
                case "data":
                    return Usage.DATA;
                case "all":
                default:
                    return Usage.ALL;
            }
        }
    }
    public static final Field<Usage> USAGE= new UsageField();
            
    public static final class DbField extends FieldSingleton<Db> {
        DbField() { super( "db" ); }
        public boolean canParse() { return true; }
    
        /** @overrides Field#parse(Run)
         */
        protected Db parse( Run run ) {
            switch( (""+this.argValue(run, "db")).toLowerCase() ) {
                case "mysql":
                    return Db.MYSQL;
                case "postgres":
                case "postgresql":
                    return Db.POSTGRES;
                case "mssql":
                    return Db.MSSQL;
                default:
                    return null;
            }
        }
    }
    public static final Field<Db> DB= new DbField();
    
    /** Overhead ratio of StringBuilder-like char sequences.
    public static final class HeapOverheadRatio extends FieldSingleton<Float> {
        HeapOverheadRatio() { super("heapOverheadRatio"); }
        private static final Float ratio= 1.2f;
        public Float defaultValue() { return ratio; }
    };
    public static final Field<Float> heapOverheadRatio= new HeapOverheadRatio();*/
    
    /** Size of heap memory reserve in *bytes*. */
    public static final class HeapReserve extends FieldSingleton<Integer> {
        HeapReserve() { super("heapReserve"); }
        private static final Integer value=1000000;
        public Integer defaultValue() { return value; }
    }
    public static final Field<Integer> heapReserve= new HeapReserve();
    
    private static final long initialFreeMemory= Runtime.getRuntime().freeMemory();
    
    /**@return maximum number of *bytes* that can be used by *each* of input/output sequence buffer (each of those two can uses as much bytes, separately).
     * If the available heap is over 2GB (Integer.MAX_VALUE), then only Integer.MAX_VALUE is
     * returned. That's because this is used when setting initial buffer of StringBuilder
     * and when comparing to its actual length(), which are both integer and not long.
     */
    public final int sequenceHeap() {
        long value= ( initialFreeMemory-get(Run.heapReserve) )/2;
        return value>Integer.MAX_VALUE
            ? Integer.MAX_VALUE
                : (int)value;
    }
    
    public static void main( String args[] ) throws IOException {
        if( args.length<5 ) {
            System.err.println( "Run with at least four arguments, in this order: <full name of subclass of com.googlecode.selite.filter.App> input-file output-file --db (mysql|postgres[ql])" );
            return;
        }
        
        Class<App> appSubclass;
        try {
            appSubclass= (Class<App>)Class.forName( args[0] );
        }
        catch( ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
        if( !App.class.isAssignableFrom(appSubclass) ) {
            System.err.println( appSubclass.getName()+ " is not a subclass of " +App.class.getName() );
            return;
        }
        App app;
        try {
            app= appSubclass.newInstance();
        }
        catch( InstantiationException e ) {
            throw new RuntimeException(e);
        }
        catch( IllegalAccessException e ) {
            throw new RuntimeException(e);
        }
        final Run run= new Run( args );
        final Usage usage= run.get(USAGE);
        final Db db= run.get(DB);
        if( db==null ) {
            System.err.println( "Please run with --db (mysql|postgres[ql])" );
        }
        
        app.initialiseRun( run );
        
        run.initialiseSequenceManager( usage );
        
        run.maxMatchLength= 0;
        for( Filter filter: usage.filters() ) {
            filter.initialise( app, run );
            run.maxMatchLength= Math.max( run.maxMatchLength, filter.maxMatchLength( app, run ) );
        }
        
        assert usage.filters().size()>0;

        // This assumes that we were outside quotes before processing a subsequence
        final List<Filter> filters= usage.filters();
        int lengthToWrite;
        doloop:
        do {
            int pastMatcheable= !run.sequenceManager.allWasRead()
                ? run.sequenceManager.input().length()-run.maxMatchLength()+1
                : run.sequenceManager.input().length();
            pastMatcheable= Filter.processMultiple( filters, app, run, pastMatcheable );
            if( pastMatcheable<0 ) {
                throw new IllegalStateException( "All filters are scan-only. You need at least one filter that is not scan-only." );
            }
            StringBuffer output= run.sequenceManager.output();
            lengthToWrite= pastMatcheable;
            assert lengthToWrite>=0;
            if( lengthToWrite>0 ) {
                run.sequenceManager.writeComplete(lengthToWrite); // That deletes the written part off output
                /*debugWrittenSoFar+= lengthToWrite;
                if( debugWrittenSoFar==95608832 ) {
                    boolean stop= true;
                }*/
            }
            else {
                boolean stop= true;
            }
            if( !run.sequenceManager.inMemory() ) {
                run.sequenceManager.swap(run);
            }
            boolean didAdvance= !run.sequenceManager.allWasRead() && run.sequenceManager.advanceInput( 0, run ); // @TODO remove parameter lengthToWrite to CharSequenceContinuous.advance()
            assert didAdvance || run.sequenceManager.allWasRead() || lengthToWrite==0;
            if( run.sequenceManager.allWasRead() /*&& !didAdvance*/ ) {
                boolean stop= true;
            }
        } while( (!run.sequenceManager.allWasRead() || lengthToWrite>0) && !run.sequenceManager.inMemory() ); //@TODO This assumes that if we use in-memory sequence manager, the whole input was loaded in memory
        
        run.sequenceManager.save( run );
    }
    
}