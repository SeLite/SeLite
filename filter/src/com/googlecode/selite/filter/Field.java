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

import java.util.Set;
import java.util.HashSet;
import java.util.Collections;
import net.sourceforge.argparse4j.inf.ArgumentParser;
import net.sourceforge.argparse4j.inf.Argument;
import net.sourceforge.argparse4j.inf.ArgumentType;
import net.sourceforge.argparse4j.inf.Namespace;

/** There are two different types of usage of instances of Field:
 *  - runtime fields (parameters), defined mostly in Run class
 *  - application fields (parameters), defined in subclasses of App.
 *  That has nothing to do with a fact that there are exactly two direct subclasses
 *  of Field - FieldSingleton and FieldNonSingleton.
 *  This serves like an enum but can be subclassed, while preventing
 *  any two different subclasses from defining a field with same name.
 *  Not Serializable - no need for that. If we make it Serializable,
 *  then also change FieldNonSingleton.
 */
public abstract class Field<T> {
    /** @var String name is non-null only for instances of subclasses of FieldNonSingleton.
     *  It can't be defined in FieldNonSingleton, because it would have to be set after
     *  its parent constructor (Field constructor) gets called, which calls equals() and optionally
     *  hashCode() before putting the instance into Field.fields, and at that time
     *  equals() and hashCode() would fail because they depend on name.
     */
    private final String name;
    
    /** @return Non-null string name only for instances of FieldNonSingleton; null for instances of FieldSingleton.
     */
    public final String name() { return name; }
    
    static final Set<Field> fields= new HashSet<Field>();
    
    /** Non-public. We only allow two direct subclasses - FieldSingleton and FieldNonSingleton,
     *  which both enforce contract of equals(Object) and hashCode().
     */
    Field( String givenName ) {
        if( givenName==null ) {
            throw new IllegalArgumentException();
        }
        name= givenName;
        synchronized( fields ) {
            if( fields.contains(this) ) {
                throw new IllegalStateException( "Already instantiated Field subclass " +getClass() );
            }
            fields.add( this );
        }
    }
    
    public final String toString() {
        return name;
    }
    
    /** Get the value of this field. Used by Run#get(Field), which caches the values.
     *  Default implementation gets it from run.parsed() for this.name().
     */
    public T get( Run run ) {
        return (T)run.parsed().get( name );
    }
    
    /** Each subclass that wants to parse commandline parameters
     *  should use override this method. It will be called once on each instance, and that's how the Field
     *  implementation can update the parser to support any command line parameters it needs.
     */
    protected void registerWithParser( ArgumentParser parser ) {}

    protected Argument registerChoices( ArgumentParser parser, final T... choices ) { return registerChoices(parser, name, choices); }
    
    /** Register a list of choices. A commandline value will be matched against toString() of those choices, and a matched choice will be used.
     * Since Run#get(Field) caches results of Field#get(Run), there's no need to pre-load the strings and targets of choices here.
     * @TODO case-insensitive
     */
    protected Argument registerChoices( ArgumentParser parser, String paramName, final T... choices ) {
        Argument arg= parser.addArgument( paramName );
        assert choices.length>0;
        arg.type( new ArgumentType<T>() {
            public T convert( ArgumentParser parser, Argument arg, String text ) {
                for( T choice: choices ) {
                    if( choice.toString().equals(text) ) {
                        return choice;
                    }
                }
                return null;
            }
        } );
        arg.choices( choices );
        return arg;
    }
    
    public abstract boolean equals( Object other );
    public abstract int hashCode();
}
