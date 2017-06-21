const express = require('express');
const httpError = require('http-errors');
const dbConns = require('./db');

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

module.exports = router;
