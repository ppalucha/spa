/* vim: set tabstop=2 shiftwidth=2 expandtab : */
/**
 * @file Handling of data sets
 */
var mongodb = require('mongodb');
var awr = require(__dirname + '/awr');
var assert = require('assert');

/**
 *  Create a new data set.
 *  @param {Db} db - The database handler.
 *  @param {String} name - Name of data set.
 *  @param {String} desc - Description of data set.
 */
function create(db, name, desc) {
  var data = {
    name: name,
    desc: desc,
    createdOn: new Date(),
    awr: [],
  };
  db.collection('dataset').insertOne(data, function(err, result) {
    if (err) throw err;
  });
}

/**
 *  Update existing data set.
 *  @param {Db} db - The database handler.
 *  @param {String} ds - Data set object.
 *  @param {String} ds.id - Id of existing data set.
 *  @param {String} ds.name - Updated name of data set.
 *  @param {String} ds.desc - Updated description of data set.
 *  @param {updateCallback} callback - Function to call after update.
 */
function update(db, ds, callback) {
  var data = {
    name: ds.name,
    desc: ds.desc,
  };
  db.collection('dataset').updateOne(
      { _id: mongodb.ObjectId(ds._id) }, 
      { '$set': data },
      function(err, results) {
        if (err) throw err;
        callback();
      }
      );
}


/**
 * List all data sets in the database.
 * @param {Db} db - The database handler.
 * @param {listCallback} callback - The callback that handles the response.
 */
function list(db, callback) {
  db.collection('dataset').find({}).toArray(function(err, docs){
    if (err) throw err;
    var rows = docs.map(function cb(i) {
      return [
        i._id,
        i.name,
        i.createdOn,
        i.desc,
      ];
    });
		callback(rows);
  });
}
/**
 * @callback listCallback
 * @param {Array} result - List of rows with data set attributes.
 */



/**
 * Return data set by id.
 * @param {Db} db - The database handler.
 * @param {String} id - Id of data set.
 * @callback {getCallback} - The callback that handles the response.
 */
function get(db, id, callback) {
  var doc = db.collection('dataset').findOne({ _id: mongodb.ObjectId(id) }, function(err, result) {
    if (err) throw err;
    callback(result);
  });
}
/**
 * @callback getCallback
 * @param {Object} result - Data set document.
 */


/**
 * Removes data set from the database.
 * @param {Db} db - Database handler.
 * @param {String} id - Id of object to remove.
 */
function remove(db, id) {
  db.collection('fact').deleteMany({ ds: mongodb.ObjectId(id) });
  db.collection('dataset').remove({ _id: mongodb.ObjectId(id) });
}

/**
 * Lists AWR files not assigned to data set.
 * @param {Db} db - Database handler.
 * @param {String} id - Data set id
 * @param {listAwrCallback} callback - Called with result.
 */
function listNotAssignedAwr(db, id, callback) {
  get(db, id, function onDataSet(ds) {
    awr.listWithFilter(db, { _id : { $nin: ds.awr } }, callback);
  });
}


/**
 * Lists AWR files for data set.
 * @param {Db} db - Database handler.
 * @param {String} id - Data set id
 * @param {listAwrCallback} callback - Called with result.
 */
function listAwr(db, id, callback) {
  get(db, id, function onDataSet(ds) {
    awr.listWithFilter(db, { _id : { $in: ds.awr } }, callback);
  });
}

/**
 * @callback listAwrCallack
 * @param {array} result - Array of rows with AWR data
 */

/**
 * Assign list of AWR files to data set.
 * @param {Db} db - Database handler.
 * @param {String} id - Data set id
 * @param {array} awrs - Array of AWR ids.
 * @param {doneCallback} callback - Called when finished.
 */
function assignAwr(db, id, awrs, callback) {
  var data = awrs.map(function(obj) {
    return mongodb.ObjectId(obj);
  });
 
  db.collection('dataset').updateOne(
      { _id: mongodb.ObjectId(id) }, 
      { $push: { awr: { $each: data } } },
      function(err, results) {
        if (err) throw err;
        callback();
      }
      );
}

/**
 * Recalculate data set.
 * @param {Db} db - Database handler.
 * @param {String} ds_id - Data set id
 * @param {doneCallback} callback - Called when finished.
 */
function recalculate(db, ds_id, callback) {
  db.collection('fact').deleteMany({ ds: mongodb.ObjectId(ds_id) }, function(err, result) {
    if (err) throw err;
    get(db, ds_id, function(ds) {
      var promises = ds.awr.map(function(awr_id) {
        return new Promise(function(resolve, reject) {
          awr.get(db, awr_id, function(awr_doc) {
            calcAwr(db, ds_id, awr_doc, resolve);
          });
        });
      });
      Promise.all(promises)
        .then(function() {
          callback();
        })
        .catch(console.error);
    });
  });
}

/**
 * Adds promise with information specified by options to list.
 * @param {array} promises - List of promisses to append to.
 * @param {pushInfoOptions} - Options.
 */
function pushInfo(promises, opt) {
  promises.push(
      new Promise(function(resolve, reject) {
        opt.db.collection('fact').insertOne(
            {
              ds: opt.ds,
              dimensions: opt.dimensions,
              start: opt.start,
              end: opt.end,
              category: opt.category,
              name: opt.name,
              val: opt.val,
            },
            function(err, result) {
              if (err) throw err;
              resolve();
            }
          );
      })
    );
}

/**
 * @typedef pushInfoOptions
 * @member {Db} db - Database handler.
 * @member {String} ds - Dataset id.
 * @member {Object} awr - Parsed AWR object.
 * @member {array} dimensions - List of dimensions name/val objects.
 * @member {Date} start - Snapshot's start date.
 * @member {Date} end - Snapshot's end date.
 * @member {String} category - Category name.
 * @member {String} name - Fact record's name.
 * @member {String,Number} val - Fact record's value.
 */

/**
 * Unification of names in different AWR versions.
 */
var uHash = {
  'Redo size (bytes):' : 'Redo size:',
  'Logical read (blocks):' : 'Logical reads:',
  'Physical read (blocks):' : 'Physical reads:',
  'Physical write (blocks):' : 'Physical writes:',
  'Parses (SQL):' : 'Parses:',
  'Hard parses (SQL):' : 'Hard parses:',
  'Executes (SQL):' : 'Executes:',
};

/**
 * Returns unified name.
 */
function u(s) {
  return uHash[s] ? uHash[s] : s;
}

/**
 * Calculate information from AWR and add to data set.
 * @param {Db} db - Database handler.
 * @param {String} ds - Data set object id.
 * @param {object} awr - AWR file object.
 * @param {doneCallback} callback - Called when done.
 */
function calcAwr(db, ds, awr, callback) {
  var promises = [];
  var t;

  function toNumber(str) {
    return Number(str.replace(/,/g, ''));
  }

  /** 
   * Parses G/M/K suffixed string, returns number in MB
   */
  function parseMB(str) {
    var n = toNumber(str.slice(0, -1));
    var u = str.slice(-1);
    switch (u.toUpperCase()) {
      case 'G':
        n = n * 1024;
      case 'M':
        n = n * 1024;
      case 'K':
        n = n * 1024;
        n = n / (1024 * 1024);
        n = Number(n.toPrecision(2));
        break;
      default:
        n = 0;
        break;
    }
    return n;
  }

  /**
   * Search table for row where column 'column' has value 'match' and return
   * column 'val_column' from this row.
   */
  function row(table, column, match, val_column) {
    for (var i = 0; i < table.data.length; i++) {
      var uc = column;
      if (!table.data[i][uc]) {
        Object.keys(table.data[i]).every(function(k) {
          if (u(k) === uc) {
            uc = k;
            return false;
          }
          return true;
        });
      }
      if (table.data[i][uc] && u(table.data[i][uc]) === match) {
        var ret = table.data[i][val_column];
        assert(ret, 'Cannot find ' + val_column + ' matching ' + match + ' at ' + uc);
        return ret;
      }
    }
    console.log(JSON.stringify(table.data));
    assert(false, 'Cannot find row with ' + match + ' at ' + column);
  }

  var query = {
    db: db,
    ds: mongodb.ObjectId(ds),
    start: new Date(Date.parse(row(awr['snapshot information'], 'Column 1', 'Begin Snap:', 'Snap Time'))),
    end: new Date(Date.parse(row(awr['snapshot information'], 'Column 1', 'End Snap:', 'Snap Time'))),
    dimensions: 
      [
        { name: 'Host Name', val: awr['host information'].data[0]['Host Name'], }, 
      ],
    category: 'Host CPU',
    name: 'CPU %User',
    val: toNumber(awr['system load statistics'].data[0]['%User']),
  };
  pushInfo(promises, query);
  
  query.name = 'CPU %System';
  query.val = toNumber(awr['system load statistics'].data[0]['%System']);
  pushInfo(promises, query);

  query.category = 'Host information';
  query.name = 'Platform';
  query.val = awr['host information'].data[0]['Platform'];
  pushInfo(promises, query);

  query.name = 'CPUs';
  query.val = toNumber(awr['host information'].data[0]['CPUs']);
  pushInfo(promises, query);

  query.name = 'CPU Cores';
  query.val = toNumber(awr['host information'].data[0]['Cores']);
  pushInfo(promises, query);

  query.name = 'CPU Sockets';
  query.val = toNumber(awr['host information'].data[0]['Sockets']);
  pushInfo(promises, query);

  query.name = 'Memory (GB)';
  query.val = toNumber(awr['host information'].data[0]['Memory (GB)']);
  pushInfo(promises, query);

  query.dimensions = [
    { name: 'DB Name', val: awr['database instance information'].data[0]['DB Name'], }, 
    { name: 'Instance', val: awr['database instance information'].data[0]['Instance'], }, 
  ];

  query.category = 'Sessions';
  query.name = 'Sessions';
  query.val = toNumber(awr['snapshot information'].data[0]['Sessions']);
  pushInfo(promises, query);

  query.category = 'Cursors/Session';
  query.name = 'Cursors/Session';
  query.val = toNumber(awr['snapshot information'].data[0]['Cursors/Session']);
  pushInfo(promises, query);

  query.category = 'Cache Sizes';
  query.name = 'Buffer Cache';
  query.val = parseMB(row(awr['cache sizes and other statistics for different types of cache'], 'Column 1', 'Buffer Cache:', 'Begin'));
  pushInfo(promises, query);

  query.name = 'Shared Pool';
  query.val = parseMB(row(awr['cache sizes and other statistics for different types of cache'], 'Column 1', 'Shared Pool Size:', 'Begin'));
  pushInfo(promises, query);

  query.name = 'Log Buffer';
  query.val = parseMB(row(awr['cache sizes and other statistics for different types of cache'], 'Column 4', 'Log Buffer:','Column 5'));
  pushInfo(promises, query);

  query.category = 'Load Profile - DB Time';
  query.name = 'DB Time per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'DB Time(s):', 'Per Second'));
  pushInfo(promises, query);

  query.category = 'Load Profile - DB Time';
  query.name = 'DB CPU per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'DB CPU(s):', 'Per Second'));
  pushInfo(promises, query);

  query.category = 'Load Profile - Redo Size';
  query.name = 'Redo Size per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Redo size:', 'Per Second'));
  pushInfo(promises, query);

  query.category = 'Load Profile - I/O';
  query.name = 'Logical Reads per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Logical reads:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Block Changes per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Block changes:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Physical Reads per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Physical reads:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Physical Writes per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Physical writes:', 'Per Second'));
  pushInfo(promises, query);

  query.category = 'Load Profile - Activities';
  query.name = 'User Calls per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'User calls:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Parses per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Parses:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Hard parses per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Hard parses:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Logons per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Logons:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Executes per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Executes:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Rollbacks per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Rollbacks:', 'Per Second'));
  pushInfo(promises, query);

  query.name = 'Transactions per second';
  query.val = toNumber(row(awr['load profile'], 'Column 1', 'Transactions:', 'Per Second'));
  pushInfo(promises, query);

  query.category = 'Instance Efficiency';
  query.name = 'Buffer Nowait';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 0', 'Buffer Nowait %:', 'Column 1'));
  pushInfo(promises, query);

  query.name = 'Redo Nowait';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 2', 'Redo NoWait %:', 'Column 3'));
  pushInfo(promises, query);

  query.name = 'Buffer Hit';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 0', 'Buffer Hit %:', 'Column 1'));
  pushInfo(promises, query);

  query.name = 'In-memory Sort';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 2', 'In-memory Sort %:', 'Column 3'));
  pushInfo(promises, query);

  query.name = 'Library Hit';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 0', 'Library Hit %:', 'Column 1'));
  pushInfo(promises, query);

  query.name = 'Soft Parse';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 2', 'Soft Parse %:', 'Column 3'));
  pushInfo(promises, query);

  query.name = 'Execute to Parse';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 0', 'Execute to Parse %:', 'Column 1'));
  pushInfo(promises, query);

  query.name = 'Latch Hit';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 2', 'Latch Hit %:', 'Column 3'));
  pushInfo(promises, query);

  query.name = 'Parse CPU to Parse Elapsd';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 0', 'Parse CPU to Parse Elapsd %:', 'Column 1'));
  pushInfo(promises, query);

  query.name = 'Non-Parse CPU';
  query.val = toNumber(row(awr['instance efficiency percentages'], 'Column 2', '% Non-Parse CPU:', 'Column 3'));
  pushInfo(promises, query);

  query.category = 'Foreground Wait Class';
  t = awr['foreground wait class statistics'];
  t && t.data.forEach(function(data) {
    query.name = data['Wait Class'];
    query.val = toNumber(data['Total Wait Time (s)']);
    pushInfo(promises, query);
  });

  query.category = 'Foreground Wait Event';
  t = awr['foreground wait events and their wait statistics'];
  t && t.data.forEach(function(data) {
    // skip non-timed foreground wait events
    if (data['% DB time'] === '') return;
    query.name = data['Event'];
    query.val = toNumber(data['Total Wait Time (s)']);
    pushInfo(promises, query);
  });

  query.category = 'Background Wait Event';
  t = awr['background wait events statistics'];
  t && t.data.forEach(function(data) {
    // skip non-timed background wait events
    if (data['% bg time'] === '') return;
    query.name = data['Event'];
    query.val = toNumber(data['Total Wait Time (s)']);
    pushInfo(promises, query);
  });

  t = awr['service statistics'];
  t && t.data.forEach(function(data) {
    query.name = data['Service Name'];
    query.category = 'Services - DB Time';
    query.val = toNumber(data['DB Time (s)']);
    pushInfo(promises, query);
    query.category = 'Services - DB CPU';
    query.val = toNumber(data['DB CPU (s)']);
    pushInfo(promises, query);
    query.category = 'Services - Physical Reads';
    query.val = toNumber(data['Physical Reads (K)']);
    pushInfo(promises, query);
    query.category = 'Services - Logical Reads';
    query.val = toNumber(data['Logical Reads (K)']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Logical Reads';
  t = awr['top segments by logical reads'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Logical Reads']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Physical Reads';
  t = awr['top segments by physical reads'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Physical Reads']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Physical Read Requests';
  t = awr['top segments by physical read requests'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Phys Read Requests']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Unoptimized Reads';
  t = awr['top segments by unoptimized reads'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['UnOptimized Reads']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Direct Physical Reads';
  t = awr['top segments by direct physical reads'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Direct Reads']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Physical Writes';
  t = awr['top segments by physical writes'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Physical Writes']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Physical Write Requests';
  t = awr['top segments by physical write requests'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Phys Write Requests']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Direct Physical Writes';
  t = awr['top segments by direct physical writes'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Direct Writes']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Table Scans';
  t = awr['top segments by table scans'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Table Scans']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by DB Block Changes';
  t = awr['top segments by db blocks changes'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['DB Block Changes']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Row Lock Waits';
  t = awr['top segments by row lock waits'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Row Lock Waits']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by ITL Waits';
  t = awr['top segments by itl waits'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['ITL Waits']);
    pushInfo(promises, query);
  });

  query.category = 'Segments by Buffer Busy Waits';
  t = awr['top segments by buffer busy waits'];
  t && t.data.forEach(function(data) {
    query.name = data['Obj_ Type'] + ' ' +
      data['Owner'] + '.' + data['Object Name'] + (data['Subobject Name'] ? '.' + data['Subobject Name'] : '');
    query.val = toNumber(data['Buffer Busy Waits']);
    pushInfo(promises, query);
  });

  var impactQ = {
    db: db,
    ds: mongodb.ObjectId(ds),
    start: query.start,
    end: query.end,
    category: 'SQL Impact',
    dimensions: [
    { name: 'DB Name', val: awr['database instance information'].data[0]['DB Name'], }, 
    { name: 'Instance', val: awr['database instance information'].data[0]['Instance'], }, 
    ],
  };

  var moduleQ  = {
    db: db,
    ds: mongodb.ObjectId(ds),
    start: query.start,
    end: query.end,
    category: 'SQL Module',
    dimensions: [
    { name: 'DB Name', val: awr['database instance information'].data[0]['DB Name'], }, 
    { name: 'Instance', val: awr['database instance information'].data[0]['Instance'], }, 
    ],
  };

  query.category = 'SQL by Elapsed Time';
  impactQ.name = query.category;
  t = awr['top sql by elapsed time'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Elapsed Time (s)']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['%Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by CPU Time';
  impactQ.name = query.category;
  t = awr['top sql by cpu time'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['CPU Time (s)']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['%Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by User I/O Time';
  impactQ.name = query.category;
  t = awr['top sql by user i/o time'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['User I/O Time (s)']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['%Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Buffer Gets';
  impactQ.name = query.category;
  t = awr['top sql by buffer gets'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Buffer Gets']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['%Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Physical Reads';
  impactQ.name = query.category;
  t = awr['top sql by physical reads'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Physical Reads']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['%Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Unoptimized Read Requests';
  impactQ.name = query.category;
  t = awr['top sql by unoptimized read requests'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['UnOptimized Read Reqs']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['%Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Number of Executions';
  impactQ.name = query.category;
  t = awr['top sql by number of executions'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Executions']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = Number((toNumber(data['Executions']) * 100 / awr.totalExecutions).toPrecision(2));
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Number of Parse Calls';
  impactQ.name = query.category;
  t = awr['top sql by number of parse calls'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Parse Calls']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['% Total Parses']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Amount of Shared Memory';
  impactQ.name = query.category;
  t = awr['top sql by amount of shared memory used'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Sharable Mem (b)']);
    pushInfo(promises, query);

    impactQ.dimensions.push({ name: 'SQL Id', val: data['SQL Id'] });
    impactQ.val = toNumber(data['% Total']);
    pushInfo(promises, impactQ);
    impactQ.dimensions.pop();

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL by Version Counts';
  t = awr['top sql by version counts'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'] + ' ' + data['SQL Text'];
    query.val = toNumber(data['Version Count']);
    pushInfo(promises, query);

    moduleQ.name = data['SQL Id'];
    moduleQ.val = data['SQL Module'];
    pushInfo(promises, moduleQ);
  });

  query.category = 'SQL Text';
  t = awr['the text of the sql statements which have been referred to in the report'];
  t && t.data.forEach(function(data) {
    query.name = data['SQL Id'];
    query.val = data['SQL Text'];
    pushInfo(promises, query);
  });
 
  Promise
    .all(promises)
    .then(function() {
      callback();
    })
    .catch(console.error);
}


/**
 * Remove list of AWR files from data set.
 * @param {Db} db - Database handler.
 * @param {String} id - Data set id
 * @param {array} awrs - Array of AWR ids.
 * @param {doneCallback} callback - Called when finished.
 */
function unassignAwr(db, id, awrs, callback) {
  var data = awrs.map(function(obj) {
    return mongodb.ObjectId(obj);
  });
 
  db.collection('dataset').updateOne(
      { _id: mongodb.ObjectId(id) }, 
      { $pullAll: { awr: data } },
      function(err, results) {
        if (err) throw err;
        callback();
      }
      );
}

/**
 * Return list of data sets containing given AWR file.
 * @param {Db} db - Database handler.
 * @param {String} awr_id - AWR file id.
 * @param {resultCallback} callback - Called with array of data sets.
 */
function findByAWR(db, awr_id, callback) {
  db.collection('dataset').find({ awr: mongodb.ObjectId(awr_id) }, { name: true, desc: true, createdOn: true }).toArray(function(err, vals) {
    if (err) throw err;
    callback(vals);
  });
}

/**
 * Return count of data sets.
 * @param {Db} db - Database handler.
 * @param {resultCallback} callback - Called with result.
 */
function count(db, callback) {
	db.collection('dataset').count(function(err, c) {
		if (err) throw err;
		callback(c);
	});
}

module.exports = {
  assignAwr: assignAwr,
  count: count,
  create: create,
  findByAWR: findByAWR,
  get: get,
	list: list,
	listAwr: listAwr,
	listNotAssignedAwr: listNotAssignedAwr,
	recalculate: recalculate,
	remove: remove,
  unassignAwr: unassignAwr,
	update: update,
};

