FROM mhart/alpine-node:6
WORKDIR /app
COPY . /app

EXPOSE 8100
ENTRYPOINT ["node", "src/app.js"]
ENV NODE_ENV production
