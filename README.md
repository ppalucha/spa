## SPA Performance Analyzer

Tool to analyze multiple Oracle Database AWR reports - upload them and admire beautiful charts.

### Quick Setup

1. Install Mongo DB, Node JS and npm.

2. Get SPA source code.

3. Install dependencies by running `npm install` in SPA top directory.

4. Make sure your Mongo database is up and running.

5. Edit `config.js` if you want to change Mongo database connection or listen port. SPA will create
a new empty database for you if necessarry.

6. Start SPA: `node spa.js`. Hopefully you will get `SPA server up at http://localhost:3300`.

7. Point your browser to address as printed above. Check *Help* menu for usage instructions.
