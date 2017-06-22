const express = require('express');
const httpError = require('http-errors');
const dbConns = require('./db');
const searchCriteria = require('./segment/search-criteria');

const router = express.Router();

function isSegmentTypeValid(type, next) {
  if (!Object.keys(searchCriteria).includes(type)) {
    next(null, httpError(400, `The provided segment type '${type}' is not supported.`));
    return false;
  }
  return true;
}

function createSegmentLabel(type) {
  return type.split('-').map(part => part.charAt(0).toUpperCase() + part.substr(1)).join(' ');
}

function getBaseDb() {
  return dbConns.selectDb('legacy', 'base_cygnus_ofcr');
}

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
