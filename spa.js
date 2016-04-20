#!/usr/bin/env node
/* vim: set tabstop=2 shiftwidth=2 expandtab : */


//import express package
var express = require('express');
//import mongodb package
var mongodb = require('mongodb');
//NPM Module to integrate Handlerbars UI template engine with Express
var exphbs  = require('express-handlebars');
// Handling file uploads
var multer = require('multer');
// POST body parser
var bodyParser = require('body-parser');
// logger
var morgan = require('morgan');
// readline
var readline = require('readline')
// fs
var fs = require('fs');
// path
var path = require('path')

// Internal app modules
var config = require(__dirname + '/config')
var awr = require(__dirname + '/awr');
var dataset = require(__dirname + '/dataset');
var facts = require(__dirname + '/facts');

//MongoDB connection URL - mongodb://host:port/dbName
var dbHost = 'mongodb://' + config.db.host + ':' + config.db.port + '/' + config.db.database;
//DB Object
var dbObject;
//get instance of MongoClient to establish connection
var MongoClient = mongodb.MongoClient;

//create express app
var app = express();
// upload handler
var upload = multer({ dest: 'uploads/' });

//Declaring Express to use Handlerbars template engine with main.handlebars as
//the default layout
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// parser for POST body
app.use(bodyParser.urlencoded({ extended: true }));

// logging
app.use(morgan('dev'));

// external npm modules
[ 
  'bootstrap/dist',
  'bootstrap-list-filter',
  'bootstrap-menu/dist',
  'bootbox',
  'c3',
  'clipboard/dist',
  'datatables.net',
  'datatables.net-bs',
  'datatables.net-buttons',
  'datatables.net-buttons-bs',
  'datatables.net-select',
  'datatables.net-select-bs',
  'dateformat/lib',
  'font-awesome',
  'handlebars/dist',
  'highlightjs',
  'jquery/dist',
].every(function(m) {
  app.use('/modules/' + m.split('/', 2)[0], express.static('node_modules/' + m));
  return true;
});
app.use('/modules/d3', express.static('node_modules/c3/node_modules/d3'));

// project's static files
app.use('/public', express.static('public'));

/**
 * Middleware to prevent caching.
 */
function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

/********************
 * START OF ROUTERS *
 ********************/

/*
 * index
 */
app.get("/", function(req, res){
  res.render("index");
});

/*
 *  simple renders
 */
[ 
  'admin',
  'chart',
  'help',
  'list-awr',
  'list-ds',
  'new-ds',
  'upload-awr',
].every(function(i) {
  app.get('/' + i, function(req, res) {
    res.render(i);
  });
  return true;
});

/*
 * renders with parameters
 */

// search and show AWR
app.get('/search-awr', function(req, res) {
  awr.search(dbObject, req.query, function(id) {
    if (!id) {
      res.status(500).send('Cannot find AWR file for specified database / time!');
    } else {
      awr.toHtml(dbObject, id, function(html, fname) {
        res.render("show-awr", { awr: html, id: id, fname: fname });
      });
    }
  });
});
// show AWR
app.get("/show-awr", function getShowAwr(req, res) {
  awr.toHtml(dbObject, req.query.id, function(html, fname) {
    res.render("show-awr", { awr: html, id: req.query.id, fname: fname });
  });
});

// show Data Set
app.get("/show-ds", function getShowDataSet(req, res) {
  dataset.get(dbObject, req.query.id, function(ds) {
    res.render("show-ds", { ds: ds });
  });
});

// show SQL details
app.get('/show-sql', function(req, res) {
  res.render('show-sql', { ds: req.query.ds, db: req.query.db, inst: req.query.inst, sqlid: req.query.sqlid });
});

/*
 *  other functions
 */
app.get('/awr-original', function(req, res) {
  awr.original(dbObject, req.query.id, res);
});

/*
 *  API
 */

// assign AWRs to Data Set
app.post("/api/assign-awr", function(req, res) {
  dataset.assignAwr(dbObject, req.body.id,  JSON.parse(req.body.awrs), function() {
    res.sendStatus(200);
  });
});

// get AWR files count
app.get('/api/awr-cnt', nocache, function(req, res) {
  awr.count(dbObject, function(count) {
    res.json(count);
  });
});

// list available database charts
app.get('/api/charts', nocache, function(req, res) {
  facts.charts(dbObject, function(result) {
    res.json(result);
  });
});

// delete AWR files
app.post("/api/delete-awr", function(req, res){
  var promises = JSON.parse(req.body.to_remove).map(function(awr_id) {
    return new Promise(function(resolve, reject) {
      awr.remove(dbObject, awr_id, resolve);
    });
  });
  Promise.all(promises)
    .then(function() {
      res.sendStatus(200);
    })
    .catch(console.error);
});

// delete Data Set
app.get("/api/delete-ds", nocache, function(req, res){
  JSON.parse(req.query.to_remove).forEach(function(id) {
    dataset.remove(dbObject, id);
  });
  res.sendStatus(200);
});

// get Data Sets count
app.get('/api/ds-cnt', nocache, function(req, res) {
  dataset.count(dbObject, function(count) {
    res.json(count);
  });
});

// list databases for Data Set
app.get('/api/ds-databases', nocache, function(req, res) {
  facts.databases(dbObject, req.query.id, function(result) {
    res.json(result);
  });
});

// list Data Sets for AWR file
app.get('/api/ds-for-awr', nocache, function(req, res) {
  dataset.findByAWR(dbObject, req.query.awr, function(vals) {
    res.json({
      data: vals.map(function(ds) {
        return [ ds._id, ds.name, ds.createdOn, ds.desc, ];
      }),
    });
  });
});

// list hosts for Data Set
app.get('/api/ds-hosts', nocache, function(req, res) {
  facts.hosts(dbObject, req.query.id, function(result) {
    res.json(result);
  });
});

// get Data Set name
app.get('/api/ds-name', nocache, function(req, res) {
  dataset.get(dbObject, req.query.id, function(ds) {
    res.json(ds.name);
  });
});

// edit Data Set name/description
app.post("/api/edit-ds", function(req, res){
  dataset.update(dbObject, {
    _id: req.body['ds-id'],
    name: req.body['ds-name'], 
    desc: req.body['ds-desc'],
  }, function() {
    res.redirect('/show-ds?id=' + req.body['ds-id']);
  });
});

// prepare chart data
app.post('/api/graph', function(req, res) {
  facts.graph(dbObject, req.body, function(result) {
    res.json(result);
  });
});

// list AWR files
app.get("/api/list-awr", function(req, res){
  awr.list(dbObject, function onResult(result) {
    res.json({data: result});
  });
});

// list Data Sets
app.get("/api/list-ds", nocache, function(req, res){
  dataset.list(dbObject, function onResult(result) {
    res.json({data: result});
  });
});

// list AWR files assigned to Data Set
app.get("/api/list-ds-awr", nocache, function(req, res) {
  dataset.listAwr(dbObject, req.query.id, function onResult(result) {
    res.json({data: result});
  });
});

// list AWR files not assigned to Data Set
app.get("/api/list-no-ds-awr", nocache, function(req, res) {
  dataset.listNotAssignedAwr(dbObject, req.query.id, function onResult(result) {
    res.json({data: result});
  });
});

// create new AWR file
app.post("/api/new-ds", function(req, res){
  dataset.create(dbObject, req.body['ds-name'], req.body['ds-desc']);
  res.redirect('/list-ds');
});

// reparse all AWR files
app.get("/api/reparse-awr", function(req, res){
  awr.reparse(dbObject, function() {
    res.sendStatus(200);
  });
});

// un-assign AWR file(s) from Data Set
app.post("/api/unassign-awr", function(req, res) {
  dataset.unassignAwr(dbObject, req.body.id,  JSON.parse(req.body.awrs), function() {
    res.sendStatus(200);
  });
});

// upload AWR file
app.post("/api/upload-awr", upload.array('awr'), function post_upload_awr(req, res, next) {
  var promises = req.files.map(function(file) {
    return new Promise(function(resolve, reject) {
      awr.parse(dbObject, file.path, file.originalname, resolve);
    });
  });
  Promise.all(promises)
    .then(function() {
      res.redirect('/list-awr');
    })
    .catch(console.error);
});

// recalc Data Set
app.get("/api/recalc-ds", nocache, function(req, res){
  dataset.recalculate(dbObject, req.query.id, function() {
    res.sendStatus(200);
  });
});

// search SQL by id or text
app.get('/api/sql-search', function(req, res) {
  facts.searchSQL(dbObject, { 
    ds: req.query.ds, 
    db: req.query.db, 
    inst: req.query.inst, 
    id: req.query.id, 
    text: req.query.text
  }, function(arr) {
    res.json(arr);
  });
});

// list modules for SQL
app.get('/api/sql-module', function(req, res) {
  facts.sqlModule(
      dbObject, 
      {
        ds: req.query.ds, sql: req.query.sql, db: req.query.db, inst: req.query.inst 
      }, 
      function(text) {
        res.json(text);
      }
  );
});

// get SQL text
app.get('/api/sql-text', function(req, res) {
  facts.sqltext(
      dbObject, 
      { 
        ds: req.query.ds, sql: req.query.sql, db: req.query.db, inst: req.query.inst 
      }, 
      function(text) {
        res.json(text);
      }
    );
});

// prepare table data
app.post('/api/table', function(req, res) {
  facts.table(dbObject, req.body, function(result) {
    res.json(result);
  });
});

/******************
 * END OF ROUTERS *
 ******************/

/**
 * Prepare new database - creates indexes and load charts configuration.
 */
function newDB(db) {
  console.log("Creating new database");
  var lineReader = readline.createInterface({
    input: fs.createReadStream(path.join(__dirname, 'charts.json')),
  });
  lineReader.on('line', function(line) {
    var doc = JSON.parse(line);
    delete doc._id;
    db.collection('charts').insertOne(doc, function(err, res) {
      if (err) throw err;
    });
  });
  db.collection('fact').createIndex({
    ds: 1,
    category: 1,
    "dimensions.name": 1,
    "dimensions.val": 1
  });
  db.collection('fact').createIndex({
    ds: 1,
    name: 1,
    "dimensions.name": 1,
    "dimensions.val": 1
  });
}

// connect to database and start listening
MongoClient.connect(dbHost, function(err, db){
  if (err) throw err;
  dbObject = db;
  // check for empty database
  db.collection('charts').count({}, {limit:1}, function(err, result) {
    if (err) throw err;
    if (result <= 0) {
      newDB(db);
    }
    app.listen(config.port, function(){
      console.log('SPA server up at http://localhost:' + config.port);
    });
  });
});


