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
    public String name() { return name; }
    
    private static final Set<Field> fields= new HashSet<Field>();
    
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
        return getClass().getName()+ ":" +name();
    }
    
    /** @return Non-null on success; null if there was no relevant value.
     */
    public T defaultValue() { return null; }
    public boolean canParse() { return false; }
    
    /** @return Value of argument, if given on commandline; null otherwise.
     */
    protected final String argValue( Run run, String argName ) {
        String argNameFlag= "--" +argName;
        for( int i=0; i<run.args().size(); i++ ) {
            if( run.args().get(i).equals(argNameFlag) ) {
                if( i+1<run.args().size() ) {
                    return run.args().get(i+1);
                }
                throw new IllegalStateException( "Missing a value for listed argument " +argName );
            }
        }
        return null;
    }
    
    /** It parses the string as a value for this field
     *  @param run must be non-null
     *  @return Non-null on success; null if there was no relevant value.
     */
    protected T parse( Run run ) {
        assert canParse() : "Do not call parse() on non-parseable Field instance, or instantiate it as parseable.";
        return null;
    }
    
    public abstract boolean equals( Object other );
    public abstract int hashCode();
}
