const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const databases = require('./db');

const loadErrorHandlers = require('./error-handlers');

const app = express();
const rootRouter = express.Router();
const port = process.env.PORT || 8100;

// @see https://expressjs.com/en/advanced/best-practice-security.html#use-helmet
// @see https://github.com/helmetjs/helmet
app.use(helmet());
app.use(helmet.noCache());

// Should be replaced with a reverse proxy in production!
// @see https://expressjs.com/en/advanced/best-practice-performance.html#proxy
// @see https://github.com/expressjs/compression
app.use(compression({
  level: 6,
  memLevel: 8,
}));

// Parse JSON bodies.
// @see https://github.com/expressjs/body-parser
app.use(bodyParser.json({
  type: ['application/vnd.api+json', 'application/json'],
}));
app.use(bodyParser.urlencoded({ extended: true }));

rootRouter.use('/rest', require('./api'));
rootRouter.use('/segment', require('./segment'));
rootRouter.use('/health-check', require('./health-check'));

app.use('/api', rootRouter);

loadErrorHandlers(app);

databases.connect().then((conns) => {
  app.locals.conns = conns;
  app.listen(port);
  process.stdout.write(`API server listening on port ${port}\n`);
});
