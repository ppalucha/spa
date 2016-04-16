#!/usr/bin/env node
/* vim: set tabstop=2 shiftwidth=2 expandtab : */


var argv = require('yargs')
	.usage('Usage: $0 [options] <file> ...')
	.default('d', 'spa')
	.alias('d', 'database')
	.describe('d', 'Use specified MongoDB database')
	.help('h')
	.alias('h', 'help')
	.argv;

function parsed(data) {
  console.log(data['Database instance information']);
}

argv['_'].forEach(function(file) {
	var awr = require('./awr').parse(file, parsed);
});


