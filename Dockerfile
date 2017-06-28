FROM mhart/alpine-node:6
MAINTAINER solocommand
WORKDIR /app
COPY . /app

EXPOSE 8100
ENTRYPOINT ["node", "src/app.js"]
ENV NODE_ENV production
