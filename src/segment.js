const express = require('express');
const httpError = require('http-errors');
const dbConns = require('./db');
const searchCriteria = require('./segment/search-criteria');

const router = express.Router();

function getBaseDb() {
  return dbConns.selectDb('legacy', 'base_cygnus_ofcr');
}

router.get('/section/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const collection = getBaseDb().collection('Section');
  collection.findOneAsync({ _id: id })
    .then((result) => {
      if (result) {
        if (result.channel) {
          // eslint-disable-next-line no-param-reassign
          result.type = `${result.type} Channel`;
        } else {
          // eslint-disable-next-line no-param-reassign
          result.type = `${result.type} Section`;
        }
        res.json({ data: result });
      } else {
        throw httpError(404, `No record found for ID: ${id}`);
      }
    })
    .catch(next)
  ;
});

router.get('/search/:type/:phrase', (req, res, next) => {
  const type = req.params.type;
  if (!Object.keys(searchCriteria).includes(type)) {
    next(null, httpError(400, `The provided segment type '${type}' is not supported.`));
  }
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
});

module.exports = router;
