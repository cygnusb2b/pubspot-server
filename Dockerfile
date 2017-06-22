FROM scomm/node-build:latest
MAINTAINER solocommand
WORKDIR /app
COPY . /app

EXPOSE 8100
ENTRYPOINT ["npm", "run", "start"]
