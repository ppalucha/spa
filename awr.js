/* vim: set tabstop=2 shiftwidth=2 expandtab : */
var htmlparser = require('htmlparser2');
var fs = require('fs');
var mongodb = require('mongodb');
var grid = require('gridfs-stream');
var assert = require('assert');

/**
 * Inserts parsed AWR document into database.
 * @param {Db} db - Database handler.
 * @param {Object} data - AWR data object.
 * @param {doneCallback} callback - Called when done.
 */
function insertParsedAWR(db, data, callback) {
	data.start = new Date(Date.parse(data['snapshot information'].data[0]['Snap Time']));
  var coll = db.collection('awr');
  var ret = coll.insertOne(data, function(err, result) {
    if (err) throw err;
		callback();
  });
}

/**
 * Parse AWR file and insert it into DB.
 * @param {Db} db - Database handler.
 * @param {string} file - Path of file to parse.
 * @param {strig} original_fname - Original file name (for reference).
 * @param {doneCallback} callback - Called when done.
 */
function parse(db, file, original_fname, callback) {
	// Return object
	var ret = { 
		original_file_name: original_fname,
		parse_dttm: new Date(),
	};

  /* first save file to GridFS */
	var gfs = grid(db, mongodb);
	var gfs_stream = gfs.createWriteStream();

	var readable = fs.createReadStream(file);
	readable.pipe(gfs_stream);
	gfs_stream.on('close', function(gfs_file) {
		/* remove file */
		fs.unlink(file);
		/* now parse file */
		ret.gfs_id = gfs_file._id;
		var parser = createParser(db, ret, function(result) {
			insertParsedAWR(db, result, callback);
		});
		
		gfs_readable = gfs.createReadStream({ _id: ret.gfs_id });
		gfs_readable.pipe(parser);
	});
};

/**
 * Returns HTML parser for parsing AWR file.
 * @param {Db} db - Database handler.
 * @param {object} ret - Initial return object.
 * @param {doneCallback} callback - Called when parsing is finished.
 */
function createParser(db, ret, callback) {
	// Stack of tags
	var tags = [ ];
	// Currently parsed table object
	var table;
	// List of headers for current table
	var header = [];
	// Current row
	var row = {};
	// Column counter for current table
	var column = 0;

	// Returns copy of object with keys lowercase (for html attributes)
  function keysToLowerCase(dict) {
		var key;
		var keys = Object.keys(dict);
		var ret = {};
		var n = keys.length;
		while (n--) {
			key = keys[n];
			ret[key.toLowerCase()] = dict[key];
		}
		return ret;
	}

	// Trim spaces and dots from string, replace all dots with underscore
	function trimAlsoDots(str) {
		return str.replace(new RegExp('[\. ]+$'), '').replace(new RegExp('^[\. ]+'), '');
	}

	// Split table description into title and details
	function summaryParse(summary) {
		var pos = summary.indexOf('. ');
		if (pos < 0) {
			return { title: trimAlsoDots(summary), details: '' };
		}
		return { 
			title: trimAlsoDots(summary.slice(0, pos)), 
			details: summary.slice(pos+1).trim()
		};
	}

	// Records currently opened tags; parses summary on table start
	function opentag(name, attrs) {	
		name = name.toLowerCase();
		attrs = keysToLowerCase(attrs);
		tags.push({ name: name, attrs: attrs });
		switch (name) {
		  case 'table':
				var prefix = 'This table displays ';
				var summary = attrs['summary'];
				if (!summary) {
					table = undefined;
					return;
				}
				if (summary && summary.startsWith(prefix)) {
					summary = summary.slice(prefix.length)[0].toUpperCase() + summary.slice(prefix.length+1);
				}
				summary = summaryParse(summary);
				
				table = { summary : summary, data : [], };
				header = [];
				break;
			case 'tr': 
				column = 0;
				row = {};
				break;
			case 'td':
				break;
			default:
				break;
		}
	}
	
	// sanitize string
	function clearStr(s) {
		s = s.replace(/(\n)|(\r)|(&[^;]{2,4};)/g, ' ').replace(/[ ]{2,}/g,' ').trim();
    sU = {
      'D B Time (s)': 'DB Time (s)',
    }
    return sU[s] ? sU[s] : s;
	}

	// Pops closed tag from stack; process end of table or row.
  function closetag(name) {
		name = name.toLowerCase();
		tag = tags.pop();
		if (!tag) {
			throw new Error('Empty tags stack');
		}
		if (tag.name != name) {
			throw new Error('Expected tag ' + tag.name + ', got ' + name);
		}
		switch (name) {
			case 'table':
				if (table) {
					ret[clearStr(table.summary.title.replace(/\./g, '_').toLowerCase())] = table;
				}
				break;

			case 'td':
				column += 1;
				break;

			case 'th':
				column += 1;
				// check if we had column id, if no - generate 'Column x'
				if (header.length < column) {
					header.push('Column ' + column);
				}
				break;

			case 'tr':
				if (Object.keys(row).length > 0) { // do we have any data collected?
					table.data.push(row);
				}
				break;

			default:
				break;
		}
	}


	// Process text content
	function text(str) {
		var current = tags.slice(-1)[0];
		if (!current) return;
		switch (current.name) {
			case 'th':
				header.push(clearStr(str.trim().replace(/\./g,'_')));
				break;

			case 'a':
				if (tags.slice(-2)[0].name !== 'td') {
					break;
				}
				/* no break - continue to 'td' */
			case 'td':
				if (column >= header.length) {
					row["Column " + String(column)] = clearStr(str);
				} else {
					if (row[header[column]]) {
						/* append - we process another chunk of the same text */
						row[header[column]] += clearStr(str);
					} else {
						row[header[column]] = clearStr(str);
					}
				}
				break;

			case 'li':
				if (str.startsWith('Total Executions:')) {
					ret.totalExecutions = Number(str.trim().replace(/[ ]{2,}/, ' ').split(' ')[2].replace(/,/g,''));
				}

			default:
				break;
		}
	}

	var parser = new htmlparser.Parser({
		onopentag: opentag,
		ontext: text,
		onclosetag: closetag,
		onend: function onEnd() {
			callback(ret);
		},
	}, {
		decodeEntities: false,
	});

	return parser;
}


/**
 * Get AWR object from database.
 * @param {Db} db - Database handler.
 * @param {string} id - Id of AWR.
 * @param {resultCallback} callback - Called with result document.
 */
function get(db, id, callback) {
  db.collection('awr').findOne(mongodb.ObjectId(id), function(err, result) {
		if (err) throw err;
		callback(result);
	});
}

// Get AWR from database and convert to HTML document.
// param db - database handler
// param id - id of awr file
// param callback - called when document is complete with result HTML text as argument
function toHtml(db, id, callback) {
  get(db, id, function(result) {
    var html = '';
    Object.keys(result).forEach(function(i) {
      e = result[i];
      if (e.summary) {
        html += '<p>' + e.summary.title + '\n<br/>\n' + e.summary.details + '</p>\n';
        html += '<p>\n<table class="table-bordered">\n<thead>\n<tr>\n';
        Object.keys(e.data[0]).forEach(function(label) {
          if (label.startsWith('Column ')) {
            html += '<th></th>';
          } else {
            html += '<th>' + label + '</th>';
          }
        });
        html += '\n</tr>\n</thead>\n<tbody>\n';
        e.data.forEach(function(row) {
          html += '<tr>';
          Object.keys(row).forEach(function(v) {
            html += '<td>' + row[v] + '</td>';
          });
          html += '</tr>\n';
        });
        html += '\n</tbody>\n</table>\n</p>\n';

      }
    });
    callback(html, result.original_file_name);
  });
}

/**
 * List all AWR files in the database.
 * @param {Db} db - Database handler.
 * @param {listCallback} callback - Called with result.
 */
function list(db, callback) {
	listWithFilter(db, { }, callback);
}

/**
 * @callback listCallback
 * @param {array} rows - Array of result rows.
 */

/**
 * List AWR files specified by filter.
 * @param {Db} db - Database handler.
 * @param {Object} filter - Mongodb filter object.
 * @param {listCallback} callback - Called with result.
 */
function listWithFilter(db, filter, callback) {
  db.collection('awr').find(filter).toArray(function(err, docs){
    if (err) throw err;
    var rows = docs.map(function cb(i) {
      return [
        i._id,
        i.original_file_name,
        i.parse_dttm,
        i['database instance information'].data[0]['DB Name'],
        i['database instance information'].data[0]['DB Id'],
        i['database instance information'].data[0]['Instance'],
        i['host information'].data[0]['Host Name'],
        i['snapshot information'].data[0]['Snap Id'],
        i['snapshot information'].data[0]['Snap Time'],
        i['snapshot information'].data[1]['Snap Id'],
        i['snapshot information'].data[1]['Snap Time'],
      ];
    });
		callback(rows);
  });
}

// Delete AWR file from database.
// param db - database handler
// param id - id of document to remove
function remove(db, id, callback) {
	/* find corresponding file in GFS */
	var m_id = mongodb.ObjectId(id);
	db.collection('awr').findOne({ _id: mongodb.ObjectId(id), }, { gfs_id: true }, function(err, result) {
		if (!err) {
			/* remove file from GFS */
			var gfs = grid(db, mongodb);
			gfs.remove({ _id: result.gfs_id });
		}
		/* remove pointers in data sets */
		db.collection('dataset').update(
				{ awr: m_id },
				{ $pull: { awr: m_id } },
				{ multi: true }
			);
		/* remove from awr collection */
  	db.collection('awr').remove({ _id: m_id }, function(err, result) {
			if (err) throw err;
			callback();
		});
	});
}

/**
 * Send original AWR file to response stream.
 * @param {Db} db - Database handler.
 * @param {string} id - AWR id.
 * @param {stream} resp - Response stream to write to.
 */
function original(db, id, resp) {
	db.collection('awr').findOne({ _id: mongodb.ObjectId(id) }, { gfs_id: true }, function(err, ret) {
		if (err) throw err;
		var gfs = grid(db, mongodb);
		gfs_readable = gfs.createReadStream({ _id: ret.gfs_id });
		gfs_readable.pipe(resp);
	});
}

/**
 * Search AWR file by database, instance and date.
 * @param {Db} db - Database handler.
 * @param {object} opts - Object with ds (dataset), db (database), inst (instance) and dttm (start time) members.
 * @param {resultCallback} callback - Called with id of AWR found.
 */
function search(db, opts, callback) {
	opts.dttm = new Date(Date.parse(opts.dttm));
	var end_dttm = new Date(opts.dttm);
	end_dttm.setSeconds(end_dttm.getSeconds() + 60);
	db.collection('dataset').findOne(
			{ _id: mongodb.ObjectId(opts.ds) }, 
			{ awr: true },
			function(err, ds) {
				if (err) throw err;
				db.collection('awr').findOne(
						{
							_id: { $in: ds.awr.map(function(id) { return mongodb.ObjectId(id) }) },
						  'database instance information.data.DB Name': opts.db,
						  'database instance information.data.Instance': opts.inst,
							start:  { $gte: opts.dttm, $lt: end_dttm },
						},
						{ _id: true, start: true },
						function(err, awr) {
							if (err) throw err;
							callback(awr ? awr._id : null);
						}
					);
			}
		);
}


/**
 * Return count of AWR files.
 * @param {Db} db - Database handler.
 * @param {resultCallback} callback - Called with result.
 */
function count(db, callback) {
	db.collection('awr').count(function(err, c) {
		if (err) throw err;
		callback(c);
	});
}

/**
 * Reparses all AWR files in database.
 * @param {Db} db - Database handler.
 * @param {doneCallback} callback - Called when done.
 */
function reparse(db, callback) {
	var promises = [];
	var gfs = grid(db, mongodb);
	var cursor = db.collection('awr').find({}, { original_file_name: true, parse_dttm: true, gfs_id: true });
	cursor.each(function(err, doc) {
		assert(!err);
		if (!doc) {
		  Promise.all(promises)
				.then(callback)
				.catch(console.error);
			return;
		}
		promises.push(new Promise(function(resolve, reject) {
			var parser = createParser(db, doc, function(result) {
				db.collection('awr').replaceOne({ _id: mongodb.ObjectId(doc._id) }, doc, function(err, ret) {
					assert(!err);
					resolve();
				});
			});
			var gfs_readable = gfs.createReadStream({ _id: doc.gfs_id });
			gfs_readable.pipe(parser);
		}));
	});
}

module.exports = {
	count: count,
	get: get,
	list: list,
	listWithFilter: listWithFilter,
	original: original,
	parse: parse,
	remove: remove,
	reparse: reparse,
	search: search,
 	toHtml: toHtml,
};

