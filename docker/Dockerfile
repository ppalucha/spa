FROM node:latest
RUN apt-get update -qq && apt-get install -y git
RUN mkdir /myapp
WORKDIR /myapp
RUN git clone https://github.com/ppalucha/spa.git
WORKDIR /myapp/spa
COPY docker-spa-config.js /myapp/spa/config.js
RUN npm install
