/* vim: set tabstop=2 shiftwidth=2 expandtab : */

/**
 * This is the SPA configuration
 */
config = {
	/** Database configuration */
	db: {
		/** Mongo DB host */
		host: 'localhost',
		/** Mongo DB port */
		port: 27017,
		/** Mongo DB database name; will get created if not exists */
		database: 'spa',
	},
	/** Port number we listen on */
	port: 3300,
}

module.exports = config;
