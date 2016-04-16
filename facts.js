/* vim: set tabstop=2 shiftwidth=2 expandtab : */
/**
 * @file Handling of collected facts
 */
var mongodb = require('mongodb');
var dateFormat = require('dateformat');

/**
 *  Lists hosts for dataset.
 *  @param {Db} db - The database handler.
 *  @param {String} ds_id - Data set id.
 *  @param {resultCallback} callback - Function to call with result.
 */
function hosts(db, ds_id, callback) {
  db.collection('fact').aggregate([
      { $match: { 
        ds: mongodb.ObjectId(ds_id),
        category: 'Host CPU', 
        'dimensions.name': 'Host Name'  
      }},
      { $group: { _id: '$dimensions.val' } },
      { $sort: { 'dimensions.val': 1  } },
      ], 
      function(err, result) {
        if (err) throw err;
        callback(result.map(function(obj) {return obj._id} ));
      });
}

/**
 *  Lists databases and instances for dataset.
 *  @param {Db} db - The database handler.
 *  @param {String} ds_id - Data set id.
 *  @param {resultCallback} callback - Function to call with result, being db -> [array of instances] object.
 */
function databases(db, ds_id, callback) {
  db.collection('fact').aggregate([ 
      { 
        $match: { 
          "dimensions.name" : "DB Name",
          ds: mongodb.ObjectId(ds_id),
        } 
      },  
      { 
        $group: { "_id": { name: "$dimensions.name", val: "$dimensions.val" } },
      },
    ], function(err, result) {
    if (err) throw err;
    var ret = {};
    result.forEach(function(obj) {
      var vinst;
      var vdb;
      var v = obj['_id'];
      for(i = 0; i < v.name.length; i++) {
        if (v.name[i] === 'DB Name') {
          vdb = v.val[i];
        } else if (v.name[i] === 'Instance') {
          vinst = v.val[i];
        }
      }
      if (!ret[vdb]) {
        ret[vdb] = [];
      }
      ret[vdb].push(vinst);
    });
    callback(ret);
  });
}

/**
 * @callback resultCallback
 * @param {object,array} result - Result of operation.
 */

/**
 * Returns modules for given sql.
 * @param {Db} db - The database handler.
 * @param {object} options - Options: ds - data set id, sql - SQL id, db - database name, inst - instance name.
 * @param {resultCallback} callback - called with result array.
 */
function sqlModule(db, options, callback) {
  var query = { $and: [
        { ds: mongodb.ObjectId(options.ds) },
        { dimensions: { $elemMatch: { name: 'DB Name', val: options.db } } },
        { dimensions: { $elemMatch: { name: 'Instance', val: options.inst } } },
        { category: 'SQL Module' },
        { name: options.sql },
      ]
  };
  db.collection('fact').distinct('val', query, function(err, ret) {
    if (err) throw err;
    callback(ret);
  });
}

/**
 * Return fact data from database.
 * @param {Db} db - The database handler.
 * @param {graphOptions} options - Fetch options.
 * @param {resultCallback} callback - called with result array.
 */
function find(db, options, callback) {
  /* filter for dimension */
  var dim_query = options.dimensions.map(function(obj) {
    return { dimensions: { $elemMatch: { name: obj.name, val: obj.val } } };
  });
  /* filter for category or names */
  var name_cat_query;
  if (options.category) {
    name_cat_query = { category: options.category };
  } else {
    name_cat_query = { name: { $in: options.names } };
  }
  /* filter for skipped names */
  var skip_query = [];
  if (options.skip) {
    skip_query = [ { name: { $nin: options.skip } }, ];
  }
  /* complete filter */
  var query = { 
    $and: [ 
      { ds: mongodb.ObjectId(options.ds) },
      name_cat_query,
    ].concat(dim_query).concat(skip_query)
  };

  /* no limit - just run query */
  if (!options.limit) {
    db.collection('fact').find(query).sort({ start: 1 }).toArray(function(err, vals) {
      if (err) throw err;
      callback(vals);
    });
    return;
  }
  
  /* find top names by sum of value */
  var arr = db.collection('fact').aggregate([
      { $match : query },
      { $group : { _id: '$name', total: { $sum: '$val' } } },
      { $sort: { total: -1 } },
      { $limit: Number(options.limit) },
  ], function(err, limit_ret) {
    if (err) throw err;
    limit_ret = limit_ret.map(function(obj) {
      return obj._id;
    });
    /* search within top names */
    db.collection('fact').find({ 
      $and: [ 
        { ds: mongodb.ObjectId(options.ds) },
        name_cat_query,
        { name: { $in: limit_ret } },
      ].concat(dim_query)
    }).sort({ start: 1 }).toArray(function(err, vals) {
      if (err) throw err;
      callback(vals);
    });
  });
}

/**
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 * 
 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/murmurhash-js
 * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
 * @see http://sites.google.com/site/murmurhash/
 * 
 * @param {string} key ASCII only
 * @param {number} seed Positive integer only
 * @return {number} 32-bit positive integer hash 
 */
function murmurhash3_32_gc(key, seed) {
	var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;
	
	remainder = key.length & 3; // key.length % 4
	bytes = key.length - remainder;
	h1 = seed;
	c1 = 0xcc9e2d51;
	c2 = 0x1b873593;
	i = 0;
	
	while (i < bytes) {
	  	k1 = 
	  	  ((key.charCodeAt(i) & 0xff)) |
	  	  ((key.charCodeAt(++i) & 0xff) << 8) |
	  	  ((key.charCodeAt(++i) & 0xff) << 16) |
	  	  ((key.charCodeAt(++i) & 0xff) << 24);
		++i;
		
		k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
		k1 = (k1 << 15) | (k1 >>> 17);
		k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

		h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
		h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
		h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
	}
	
	k1 = 0;
	
	switch (remainder) {
		case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
		case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
		case 1: k1 ^= (key.charCodeAt(i) & 0xff);
		
		k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
		k1 = (k1 << 15) | (k1 >>> 17);
		k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
		h1 ^= k1;
	}
	
	h1 ^= key.length;

	h1 ^= h1 >>> 16;
	h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
	h1 ^= h1 >>> 13;
	h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
	h1 ^= h1 >>> 16;

	return h1 >>> 0;
}

/**
 * Converts string to color.
 * Based on https://gist.github.com/ro-sharp/49fd46a071a267d9e5dd
 * @param {string} str - String to hash
 * @return {string} - HTML color (#rrggbb).
 */
function hashColor(str) {
  /* palette generated by https://github.com/google/palette.js/tree/master:
   * palette.listSchemes('rainbow')[0](64, 0.7)
   */
  var palette =
    // these colors are a little to bright, genarated with palette.listSchemes('rainbow')[0](64)
    // ["ff0000","ff1800","ff3000","ff4800","ff6000","ff7800","ff8f00","ffa700","ffbf00","ffd700","ffef00","f7ff00","dfff00","c7ff00","afff00","97ff00","80ff00","68ff00","50ff00","38ff00","20ff00","08ff00","00ff10","00ff28","00ff40","00ff58","00ff70","00ff87","00ff9f","00ffb7","00ffcf","00ffe7","00ffff","00e7ff","00cfff","00b7ff","009fff","0087ff","0070ff","0058ff","0040ff","0028ff","0010ff","0800ff","2000ff","3800ff","5000ff","6800ff","8000ff","9700ff","af00ff","c700ff","df00ff","f700ff","ff00ef","ff00d7","ff00bf","ff00a7","ff008f","ff0078","ff0060","ff0048","ff0030","ff0018"];
    // these are a little to dim
    // palette.listSchemes('rainbow')[0](64, 0.5)
     [ "ff8080","ff8b80","ff9780","ffa380","ffaf80","ffbb80","ffc780","ffd380","ffdf80","ffeb80","fff780","fbff80","efff80","e3ff80","d7ff80","cbff80","bfff80","b3ff80","a7ff80","9bff80","8fff80","83ff80","80ff87","80ff93","80ff9f","80ffab","80ffb7","80ffc3","80ffcf","80ffdb","80ffe7","80fff3","80ffff","80f3ff","80e7ff","80dbff","80cfff","80c3ff","80b7ff","80abff","809fff","8093ff","8087ff","8380ff","8f80ff","9b80ff","a780ff","b380ff","bf80ff","cb80ff","d780ff","e380ff","ef80ff","fb80ff","ff80f7","ff80eb","ff80df","ff80d3","ff80c7","ff80bb","ff80af","ff80a3","ff8097","ff808b" ];
//    [ "ff4d4d","ff5d4d","ff6e4d","ff7f4d","ff8f4d","ffa04d","ffb14d","ffc24d","ffd24d","ffe34d","fff44d","f9ff4d","e9ff4d","d8ff4d","c7ff4d","b6ff4d","a6ff4d","95ff4d","84ff4d","74ff4d","63ff4d","52ff4d","4dff58","4dff68","4dff79","4dff8a","4dff9b","4dffab","4dffbc","4dffcd","4dffde","4dffee","4dffff","4deeff","4ddeff","4dcdff","4dbcff","4dabff","4d9bff","4d8aff","4d79ff","4d68ff","4d58ff","524dff","634dff","744dff","844dff","954dff","a64dff","b64dff","c74dff","d84dff","e94dff","f94dff","ff4df4","ff4de3","ff4dd2","ff4dc2","ff4db1","ff4da0","ff4d8f","ff4d7f","ff4d6e","ff4d5d" ];

  var s = palette.length;

  // 43 gives wait classes colors similar to Enterprise Manager ;-)
  var seed = murmurhash3_32_gc(str, 43);

  return '#' + palette[seed % s];
}


function hashColor2(str) {
  var baseRed = 255;
  var baseGreen = 255;
  var baseBlue = 255;

  var seed = 0; 
  var k = 0;
  for (var i = 0; i < str.length; i++) {
    seed = seed ^ ((str.charCodeAt(i) + i) % 256);
  }
  var rand_1 = Math.abs((Math.sin(seed++) * 10000)) % 256;
  var rand_2 = Math.abs((Math.sin(seed++) * 10000)) % 256;
  var rand_3 = Math.abs((Math.sin(seed++) * 10000)) % 256;

  
  var red = Math.round((rand_1 + baseRed) / 2);
  var green = Math.round((rand_2 + baseGreen) / 2);
  var blue = Math.round((rand_3 + baseBlue) / 2);

  return '#' 
    + ('00' + red.toString(16)).slice(-2)
    + ('00' + green.toString(16)).slice(-2)
    + ('00' + blue.toString(16)).slice(-2);
}
/**
 * Get graph data.
 * @param {Db} db - Database handler.
 * @param {graphOptions} options - Graph options.
 * @param {resultCallback} callback - called with result object; result object is in c3js data format
 */
function graph(db, options, callback) {
  find(db, options, function(vals) {
    var curr_start = null;
    var snapshot_len = null;
    var data = { x: [], };
    vals.forEach(function(v) {
      /* records snapshot length */
      if (!snapshot_len) {
        snapshot_len = (Math.floor((v.end - v.start - 1) / (60*1000)) + 1) * (60*1000);
      }
      /* create array for newly spotted name */
      if (!data[v.name]) {
        data[v.name] = [];
      }
      /* record current date, add to x axis */
      if (!curr_start || (v.start > curr_start)) {
        curr_start = v.start;
        data.x.push(dateFormat(v.start, 'yyyy-mm-dd HH:MM'));
      }
      /* push missing previous records for name */
      while (data[v.name].length < data.x.length - 1) {
        data[v.name].push(0);
      }
      /* push current value for name */
      data[v.name].push(v.val);
    });
    /* add missing 0 values at end */
    Object.keys(data).forEach(function(k){
      while (data[k].length < data.x.length) {
        data[k].push(0);
      }
    });
    /* add missing snapshots with 0 values */
    while (true) {
      /* repeat while we have some missing snapshots */
      var missing = undefined;
      data.x.slice(1).every(function(v, i, arr) {
        var s = new Date(Date.parse(data.x[i]));
        var e = new Date(Date.parse(v));
        if ((e - s) > (snapshot_len * 1.5)) {
          missing = i;
          return false; // break
        }
        return true;
      });
      if (!missing) break;
      // add empty values after index missing
      new_date = new Date(Date.parse(data.x[missing]));
      new_date.setTime(new_date.getTime() + snapshot_len);
      Object.keys(data).forEach(function(k) {
        data[k].splice(missing+1, 0, k === 'x' ? dateFormat(new_date, 'yyyy-mm-dd HH:MM'): 0);
      });
    }
    var ret = {
      x: 'x',
      xFormat: '%Y-%m-%d %H:%M',
      columns: Object.keys(data).map(function(k) {
        return [ k, ].concat(data[k]);
      }),
      type: 'area-step',
    };
    /* sort columns, 'x' will be first */
    ret.columns.sort(function(a, b) {
      if (a[0] === 'x') return -1;
      if (b[0] === 'x') return 1;
      return a[0].localeCompare(b[0]);
    });
    /* add groups in sorted order */
    ret.groups = [ 
      ret.columns.slice(1).map(function(arr) {
        return arr[0];
      }),
    ];
    /* add colors */
    ret.colors = {};
    ret.columns.slice(1).forEach(function(arr) {
      var dname = arr[0];
      ret.colors[dname] = hashColor(dname);
    });

    callback(ret);
  });
}


/**
 * @typedef graphOptions
 * @type {object}
 * @property {string} ds - Data Set Id.
 * @property {Array.graphDimension} dimensions - Array of dimensions' values.
 * @property {Array.string} names - Array of value names.
 * @property {string} category - Value category, may be used instead of names.
 */

/**
 * @typedef graphDimension
 * @type {object}
 * @property {string} name - dimension's name
 * @property {string} val - dimension's value
 */

/**
 * Get table data.
 * @param {Db} db - Database handler.
 * @param {graphOptions} options - Graph options.
 * @param {resultCallback} callback - called with result object; result object is in c3js data format
 */
function table(db, options, callback) {
  find(db, options, function(vals) {
    ret = { };
    vals.forEach(function(v) {
      ret[v.name] = v.val;
    });
    callback(
      { 
        data: Object.keys(ret).map(function(i) {
          return [ i, ret[i] ]; 
        }),
      });
  });
}

/**
 * List available charts.
 */
function charts(db, callback) {
  db.collection('charts').find({}).sort({ name: 1 }).toArray(function(err, vals) {
    if (err) throw err;
    var ret = {};
    vals.forEach(function(v) {
      ret[v._id] = v;
    });
    callback(ret);
  });  
}

/**
 * Get SQL text.
 * @param {Db} db - Database handler.
 * @param {object} options - object with members: ds (id of data set), sql (id of SQL), db (database name), inst (instance name)
 * @param {resultCallback} callback - called with result text
 */
function sqltext(db, options, callback) {
  var query = { $and: [
        { ds: mongodb.ObjectId(options.ds) },
        { dimensions: { $elemMatch: { name: 'DB Name', val: options.db } } },
        { dimensions: { $elemMatch: { name: 'Instance', val: options.inst } } },
        { category: 'SQL Text' },
        { name: options.sql },
      ]
  };
  db.collection('fact').findOne(
      query,
      { val: true },
      function(err, result) {
        if (err) throw err;
        callback(result ? result.val: null);
      });
}

/**
 * Escapes special RegExp characters.
 */
function escapeRegExp(str) {
  return str.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1');
}

/**
 * Perform search for SQL by sqlid prefix or SQL text fragment.
 * @param {Db} db - Database handler.
 * @param {object} options - object with members: ds (id of data set), db (database name), inst (instance name), id (prefix of SQL id), text (part of SQL text)
 * @param {resultCallback} callback - called with result array
 */
function searchSQL(db, options, callback) {
  var trx;
  if (!(options.ds && options.db && options.inst)) {
    callback([]);
    return;
  }
  var query = { $and: [
        { ds: mongodb.ObjectId(options.ds) },
        { dimensions: { $elemMatch: { name: 'DB Name', val: options.db } } },
        { dimensions: { $elemMatch: { name: 'Instance', val: options.inst } } },
        { category: 'SQL Text' },
      ]
  };
  if (options.id) {
    query['$and'].push({ name: RegExp('^' + escapeRegExp(options.id), 'i') });
  } else {
    trx = RegExp(escapeRegExp(options.text), 'i');
    query['$and'].push({ val: trx });
  }
  db.collection('fact').aggregate([ 
      { 
        $match: query,
      },  
      { 
        $group: { "_id": { name: "$name", val: "$val" } },
      },
      {
        $limit: 10,
      },
    ])
      .toArray(function(err, result) {
    if (err) throw err;
    result = result.map(function(i) {
      return i._id;
    });
    // max length of SQL text
    var limit = 200;
    if (options.id) {
      // just cut at limit
      result = result.map(function(i) {
        if (i.val.length > limit + 3) {
          i.val = i.val.slice(0, limit) + '...';
        }
        return i;
      });
    } else {
      result = result.map(function(i) {
        // check for search string position
        var pos = i.val.search(RegExp(trx));
        var shift = 10;
        if (i.val.length > limit + 3) {
          // cut so search string is visible
          if (pos > limit - options.text.length) {
            i.val = '...' + i.val.slice(pos - shift, pos - shift + limit) + '...';
            pos = shift + 3;
          } else {
            i.val = i.val.slice(0, limit) + '...';
          }
        }
        if (pos >= 0) {
          // color search string
          i.val = i.val.slice(0, pos) + '<span style="color: red">' + i.val.slice(pos, pos + options.text.length) + '</span>' + i.val.slice(pos + options.text.length);
        }
        return i;
      });
    }
    callback(result);
  });
}


module.exports = {
  charts: charts,
  databases: databases,
  graph: graph,
  hosts: hosts,
  searchSQL: searchSQL,
  sqlModule: sqlModule,
  sqltext: sqltext,
  table: table,
};

