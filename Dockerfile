FROM mhart/alpine-node:6
MAINTAINER solocommand
WORKDIR /app
COPY . /app

EXPOSE 8100
ENTRYPOINT ["npm", "run", "start"]
