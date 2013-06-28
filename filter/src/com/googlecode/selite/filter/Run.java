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
import java.util.Collections;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static net.sourceforge.argparse4j.impl.Arguments.storeTrue;
import net.sourceforge.argparse4j.ArgumentParsers;
import net.sourceforge.argparse4j.inf.ArgumentParser;
import net.sourceforge.argparse4j.inf.ArgumentParserException;
import net.sourceforge.argparse4j.inf.FeatureControl;
import net.sourceforge.argparse4j.inf.Namespace;
import org.reflections.Reflections;

/** Not thread-safe - that's fine.
 */
public class Run {
    /** It serves as a cache.
     */
    private final Map<Field, Object> appFields= new HashMap<Field, Object>();
    
    private CharSequenceManager sequenceManager;
    
    private int maxMatchLength; //@TODO make it final; re-organise main() and constructor; change docs of maxMatchLength()
    
    /** Maximum matcheable length, a maximum of maxMatchLength() across all
     *  Filter(s) applicable by given run. Only valid once set. */
    int maxMatchLength() { return maxMatchLength; }
    
    /** @return mutable map
     */
    protected Map<Field, Object> appFields() { return appFields; }
    
    /** Its result must not be cached by the client code, because sequenceManager can change
     *  (e.g. when reading from standard input, it may be CharSequenceManagerInMemory initially,
     *  and it may switch to CharSequenceManagerInFile if the input turns out to be too long).
     */
    public CharSequenceManager sequenceManager() { return sequenceManager; }
    
    /** This calls field.get(this) once per field; then it caches the result.
     *  @return (cached) result of field.get(this)
     */
    public <T> T get( Field<T> field ) {
        if( appFields.containsKey(field) ) {
            return (T)appFields.get(field);
        }
        T value= field.get( this );
        appFields.put( field, value );
        return value;
    }
    
    protected Run() {}
    
    private void initialiseSequenceManager( Usage usage ) {
        sequenceManager= usage.requiresAllInHeap()
            ? new CharSequenceManagerInMemory( parsed.getString("input"), parsed.getString("output"), this )
            : new CharSequenceManagerContinuous( parsed.getString("input"), parsed.getString("output"), this );
        if( !(sequenceManager instanceof CharSequenceManagerInMemory) && usage.requiresAllInHeap() ) {
            throw new IllegalStateException();
        }
    }
    
    public static final class UsageField extends FieldSingleton<Usage> {
        UsageField() { super( Usage.class, "usage" ); }
        public Usage defaultValue() { return Usage.DATA; }
        
        protected void registerWithParser( ArgumentParser parser ) {
            registerChoices( parser, true, Usage.values() ).setDefault(Usage.ALL).help("Transformation type");
        }
    }
    public static final Field<Usage> USAGE= new UsageField();
            
    public static final class DbField extends FieldSingleton<Db> {
        DbField() { super( Db.class, "db" ); }
        
        protected void registerWithParser( ArgumentParser parser ) {
            registerChoices( parser, true, Db.values() ).setDefault(Db.POSTGRES).help("Source DB type");
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
        HeapReserve() { super( Integer.class, "heapReserve"); }
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
    
    /** This gets set to result of createParser(). It's effectively final
     *  - set only once during process().
     */
    private ArgumentParser parser;
    public ArgumentParser parser() { return parser; }
    
    private Namespace parsed;
    public Namespace parsed() { return parsed; }
    
    protected ArgumentParser createParser() {
        return ArgumentParsers.newArgumentParser("java com.googlecode.selite.filter.Run")
            .defaultHelp(true)
            .description("SeLiteFilter serves to transform SQL from other RDBMs to SQLite. It's a part of SeLite, a family of tools for test automation of DB-driven web applications. See https://code.google.com/p/selite.")
            .epilog("SeLiteFilter is a free software under GNU GPL License version 3. See http://www.gnu.org/licenses/gpl.html")
            .version("${prog} 0.1");
    }
    
    /** This gets Reflections object, which scans the classes in your implementation.
     *  Run.process(String[]) uses it to locate custom subclasses of Field class. That
     *  loads those subclasses, so they can register themselves, and then Run.process(String[])
     *  creates 
     */
    protected Reflections reflections() {
        return new Reflections();
    }
    
    public static void main( String args[] ) throws IOException {
        new Run().process( args );
    }
    
    protected void process( String args[] ) throws IOException {
        // We don't use the result of the following. It only serves to load all subclasses of Field, so that
        // they create any singleton instances, which get automaticall registered in Fields.field. That allows
        // us here to iterate over Field.fields and register them with the parser.
        //Set<Class<? extends com.googlecode.selite.filter.Field>> fieldSubTypes =
        reflections().getSubTypesOf(com.googlecode.selite.filter.Field.class);
        
        parser= createParser();
        /*for( Class<? extends com.googlecode.selite.filter.Field> fieldType: fieldSubTypes ) {
            try {
                java.lang.reflect.Method registerWithParser= fieldType.getDeclaredMethod( "registerWithParser", new Class<?>[] {ArgumentParser.class} );
                try {
                    registerWithParser.invoke( null, parser );
                }
                catch( Exception e ) {
                    throw new RuntimeException(e);
                }
            }
            catch( NoSuchMethodException e ) {}// Nothing to do - the Field subclass didn't declare registerWithParser(ArgumentParser).
            catch( SecurityException e ) {
                throw e;
            }
        }*/
        parser.addArgument( "class" );
        parser.addArgument( "input" );
        parser.addArgument( "output" );
        for( Field field: Field.fields ) {
            field.registerWithParser(parser);
        }
        try {
            parsed= parser.parseArgs( args );
        }
        catch( ArgumentParserException e ) {
            parser.handleError(e);
            return;
        }
        Class<App> appSubclass;
        try {
            appSubclass= (Class<App>)Class.forName( parsed.getString("class") );
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
        final Usage usage= get(USAGE);
        final Db db= get(DB);
        assert usage!=null && db!=null;
        
        app.initialiseRun( this );
        
        initialiseSequenceManager( usage );
        
        maxMatchLength= 0;
        for( Filter filter: usage.filters() ) {
            filter.initialise( app, this );
            maxMatchLength= Math.max( maxMatchLength, filter.maxMatchLength(app, this) );
        }
        
        assert usage.filters().size()>0;

        // This assumes that we were outside quotes before processing a subsequence
        final List<Filter> filters= usage.filters();
        int lengthToWrite;
        doloop:
        do {
            int pastMatcheable= !sequenceManager.allWasRead()
                ? sequenceManager.input().length()-maxMatchLength()+1
                : sequenceManager.input().length();
            pastMatcheable= Filter.processMultiple( filters, app, this, pastMatcheable );
            if( pastMatcheable<0 ) {
                throw new IllegalStateException( "All filters are scan-only. You need at least one filter that is not scan-only." );
            }
            StringBuffer output= sequenceManager.output();
            lengthToWrite= pastMatcheable;
            assert lengthToWrite>=0;
            if( lengthToWrite>0 ) {
                sequenceManager.writeComplete(lengthToWrite); // That deletes the written part off output
                /*debugWrittenSoFar+= lengthToWrite;
                if( debugWrittenSoFar==95608832 ) {
                    boolean stop= true;
                }*/
            }
            else {
                boolean stop= true;
            }
            if( !sequenceManager.inMemory() ) {
                sequenceManager.swap(this);
            }
            boolean didAdvance= !sequenceManager.allWasRead() && sequenceManager.advanceInput( 0, this ); // @TODO remove parameter lengthToWrite to CharSequenceContinuous.advance()
            assert didAdvance || sequenceManager.allWasRead() || lengthToWrite==0;
            if( sequenceManager.allWasRead() /*&& !didAdvance*/ ) {
                boolean stop= true;
            }
        } while( (!sequenceManager.allWasRead() || lengthToWrite>0) && !sequenceManager.inMemory() ); //@TODO This assumes that if we use in-memory sequence manager, the whole input was loaded in memory
        
        sequenceManager.save( this );
    }
    
}