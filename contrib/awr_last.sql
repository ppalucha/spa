-- Copyright (c) 2016 ppalucha

-- This is a simple script to fetch HTML AWR reports from the database
-- for the selected period. Run with SQLPlus connected to the target
-- database. It will create a SQL file awr.sql, which you run to fetch
-- actual AWR reports.
-- Change condition for selecting snapshots - see comment in the code
-- below.

set heading off;
set pagesize 1000;
set linesize 120;
set feedback off;

spool awr.sql;

select 
	'set linesize 8000;'||CHR(10)
	||'set echo off;'||CHR(10)
	||'set veri off;'||CHR(10)
	||'set feedback off;'||CHR(10)
	||'set pagesize 50000;'||CHR(10)
	||'set heading off;'||CHR(10) 
from
	dual;



select 'spool awr_' || snap_id || '.html; ' || CHR(10) ||
'select output from table(dbms_workload_repository.awr_report_html( '|| dbid ||','||
		 instance_number ||', ' || 
to_number(snap_id, '999999999')
|| ' - 1, ' || snap_id || '));' || CHR(10) ||
' spool off; ' as sql
 from dba_hist_snapshot s
where dbid = (select dbid from v$database)
and instance_number = (select instance_number from v$instance)
-- change conditions for fetching reports if required
and end_interval_time >= sysdate - 7 
order by snap_id;

select 'exit;' from dual;

exit;


