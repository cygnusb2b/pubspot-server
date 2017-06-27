const express = require('express');
const httpError = require('http-errors');
const promisify = require('bluebird').promisify;
const searchCriteria = require('./segment/search-criteria');
const getPipeline = require('./segment/report-pipelines');
const getHook = require('./segment/report-hooks');
const getAnalyticsDb = require('./db').getAnalyticsDb;
const getBaseDb = require('./db').getBaseDb;

const router = express.Router();

function isSegmentTypeValid(type, next) {
  if (!Object.keys(searchCriteria).includes(type)) {
    next(null, httpError(404, `The provided segment type '${type}' was not found.`));
    return false;
  }
  return true;
}

function createSegmentLabel(type) {
  return type.split('-').map(part => part.charAt(0).toUpperCase() + part.substr(1)).join(' ');
}

const runReport = promisify((segmentType, segmentId, reportKey, params, cb) => {
  const loadPipeline = getPipeline(segmentType, segmentId, reportKey);
  const hook = getHook(reportKey, params);
  const collection = getAnalyticsDb().collection('content');

  loadPipeline().then((pipeline) => {
    collection.aggregateAsync(pipeline).then(hook).then(res => cb(null, res)).catch(cb);
  })
  .catch(cb);
});

router.get('/report/:type/:id/:key', (req, res, next) => {
  const id = Number(req.params.id);
  const type = req.params.type;

  if (isSegmentTypeValid(type, next)) {
    runReport(type, id, req.params.key, req.query).then(data => res.json({ data })).catch(next);
  }
});

router.get('/retrieve/:type/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const type = req.params.type;

  if (isSegmentTypeValid(type, next)) {
    const criteria = searchCriteria[type];
    const collection = getBaseDb().collection(criteria.collection);

    collection.findOneAsync({ _id: id })
      .then((result) => {
        if (result) {
          res.json({ data: result, meta: { type, label: createSegmentLabel(type) } });
        } else {
          throw httpError(404, `No record found for ${type} ID: ${id}`);
        }
      })
      .catch(next)
    ;
  }
});

router.get('/search/:type/:phrase', (req, res, next) => {
  const type = req.params.type;

  if (isSegmentTypeValid(type, next)) {
    const criteria = searchCriteria[type];
    const collection = getBaseDb().collection(criteria.collection);
    const query = Object.assign({}, criteria.query);
    query[criteria.field] = new RegExp(`${req.params.phrase}`, 'i');
    const projection = {
      _id: 1,
      [criteria.field]: 1,
    };

    collection.find(query)
      .project(projection)
      .toArrayAsync()
      .then(docs => res.json({ data: docs }))
      .catch(next)
    ;
  }
});

module.exports = router;
