/** Configuration for docker environment - database host changed to 'db' */
config = {
        /** Database configuration */
        db: {
                /** Mongo DB host */
                host: 'db',
                /** Mongo DB port */
                port: 27017,
                /** Mongo DB database name; will get created if not exists */
                database: 'spa',
        },
        /** Port number we listen on */
        port: 3300,
}

module.exports = config;

