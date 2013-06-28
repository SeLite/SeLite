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
package com.googlecode.selite.filter.apps;

import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.MatchResult;
import java.util.Collection;
import java.util.Arrays;
import java.util.ArrayList;
import com.googlecode.selite.filter.AppListedTables;
import com.googlecode.selite.filter.Field;
import com.googlecode.selite.filter.FieldSingleton;
import com.googlecode.selite.filter.GeneralVersion;
import com.googlecode.selite.filter.Run;
import net.sourceforge.argparse4j.inf.ArgumentParser;

public class Moodle extends AppListedTables {
    public Moodle() {}
    
    public static final class TablePrefix extends FieldSingleton<String> {
        TablePrefix() { super( String.class, "tablePrefix" ); }
        protected void registerWithParser( ArgumentParser parser ) {
            registerSimple( parser, true, "mdl_" );
        }
    }
    public static final Field<String> TABLE_PREFIX= new TablePrefix();
    
    public static final class ExportTableName extends FieldSingleton<String> {
        ExportTableName() { super( String.class, "exportTableName" ); }
        protected void registerWithParser( ArgumentParser parser ) {
            registerSimple( parser, true, "export_user" );
        }
    }
    public static final Field<String> EXPORT_TABLE_NAME= new ExportTableName(); // @TODO may not be needed; or make it more general, not Moodle-specific
    
    public static final class Version extends FieldSingleton<GeneralVersion> {
        private Version() { super( GeneralVersion.class, "version" ); }
        
        public GeneralVersion get( Run run ) {
            // @TODO Following depends on DB type and export type (separate INSERTs, compound INSERTs). The column order may differ, too.
            String prefix= TABLE_PREFIX.get( run );
            // Matching .e.g INSERT INTO mdl_config (id, name, value) VALUES (182, 'version', '2007101530');
            Pattern versionPattern= Pattern.compile( "INSERT\\s+INTO\\s+" +prefix+ "config\\s*\\(id,\\s*name,\\s*value\\)\\s*VALUES\\s*\\(\\d+,\\s*'version',\\s*'(\\d+)'\\);" );

            MatchResult matchResult= run.sequenceManager().find( versionPattern, 100, run );
            if( matchResult!=null ) {
                run.sequenceManager().rewindInput( run );
                return new GeneralVersion( matchResult.group(1) );
            }
            run.sequenceManager().rewindInput( run );
            return null;
        }
    }
    public static final Field<GeneralVersion> VERSION= new Version();
    
    protected Collection<String> removedTablePrefixes( Run run ) {
        String tbPrefix= TABLE_PREFIX.get( run );
        String exportTbName= run.get(EXPORT_TABLE_NAME);
        
        // Let's try to keep table names/name prefixes here sorted alphabetically.
        return new ArrayList<String>( Arrays.asList( new String[] {
            "adodb_logsql", // @TODO IS this DB-dependant?
            exportTbName, // We don't want export_user itself in the exported DB.
            tbPrefix+"block", tbPrefix+"cache",
            tbPrefix+"capabilities", tbPrefix+"chat", tbPrefix+"choice",

            /** Say in future we want to use this to restrict (narrow down) a schema export from Postgres into Postgres
                and we do want to keep sequences for the tables that we include in the export. Then you may have to make a few modifications.
                For example:
                - you want to export mdl_course and mdl_course_modules and their sequences
                - you don't want to export any other mdl_course_* tables

                If you'd just specify here "{$db_prefix}course_(?!modules)", that would also remove 'CREATE SEQUENCE mdl_course_id_seq',
                which is a valid sequence for mdl_course table. However, it would leave mdl_course_id_seq being used by another statement,
                and the result SQL would fail. That's because remove_unused_tables_views() is not smart enough (no need for it now).
                In that case, you want to use e.g. "{$db_prefix}course_(?!(modules|id_seq))"

                Same goes for mdl_user and its mdl_user_id_seq - in case you filter out some/all mdl_user_* tables.
            */
            tbPrefix+"course_",

            tbPrefix+"context", tbPrefix+"data", tbPrefix+"enrol_", tbPrefix+"event", tbPrefix+"exercise", tbPrefix+"feedback",
            tbPrefix+"format_", tbPrefix+"forum", tbPrefix+"glossary",

            /** Keep mdl_grade_items, mdl_grade_grades (for moodle_tools_vw).
                Later if tests support grading, remove filtering of mdl_grade
            */
            tbPrefix+"grade",

            tbPrefix+"groupings", tbPrefix+"groups", tbPrefix+"hotpot", tbPrefix+"journal",
            tbPrefix+"label", tbPrefix+"lams", tbPrefix+"lesson", tbPrefix+"log", tbPrefix+"message", tbPrefix+"mnet",
            tbPrefix+"pagemenu", tbPrefix+"post",
            tbPrefix+"resource", tbPrefix+"role",

            tbPrefix+"question", // We don't want mdl_question but we want to keep mdl_questionnaire... tables

            tbPrefix+"quiz", tbPrefix+"scale", tbPrefix+"scorm", tbPrefix+"sessions2",
            tbPrefix+"stats", tbPrefix+"survey", tbPrefix+"tag", tbPrefix+"timezone",

            tbPrefix+"user_", // Keep mdl_user; keep mdl_user_preferences; remove rest of mdl_user_*

            tbPrefix+"wiki", tbPrefix+"webdav_locks", tbPrefix+"workshop"
        } ) );
    }
    protected Collection<String> keptTablePrefixes( Run run ) {
        String tbPrefix= run.get(TABLE_PREFIX);
        return new ArrayList<String>( Arrays.asList( new String[] {
            tbPrefix+"course_modules", tbPrefix+"grade_grades", tbPrefix+"grade_items",
            tbPrefix+"questionnaire", tbPrefix+"user_preferences"
        } ) );
    }
}