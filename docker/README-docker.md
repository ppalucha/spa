Perhaps the easiest way to try out the SPA it to use Docker. Make sure you have Docker Engine
and Docker Compose installed - look for docs at http://docs.docker.com.

Once done, just run following command in current directory:

**docker-compose up**

This will:
- download the MongoDB container image
- download the NodeJS image
- build new 'web' image based on NodeJS image
- pull SPA sources from GitHub into web image
- start both database and web containers
SPA application should be available at port 3300.

If you want to have access to MongoDB, uncomment 'ports' directive in docker-compose.yaml and
rebuild image with:

**docker-compose up --build**

