const express = require('express');
const httpError = require('http-errors');
const modelManager = require('./services/model-manager');
const getCollection = require('./db').collection;
const adapter = require('./services/api-adapter');
const bluebird = require('bluebird');
const ObjectId = require('mongodb').ObjectId;

const router = express.Router();

/**
 * Finds a model by ID, or returns an error to the callback if not found.
 *
 * @param {object} collection The model collection.
 * @param {string} id The model identifier.
 * @param {function} cb The error/result callback function.
 */
const findById = bluebird.promisify((collection, id, cb) => {
  collection.findOne({ _id: ObjectId(id) }, (err, doc) => {
    if (err) {
      cb(err);
    } else if (!doc) {
      cb(httpError(404, `No record found for ID: ${id}`));
    } else {
      cb(null, doc);
    }
  });
});

/**
 * Validates the API request payload.
 * Will return an error to the callback if the payload is invliad.
 *
 * @param {object} payload The request payload.
 * @param {boolean} isNew Whether the payload is for a new model.
 * @param {function} cb The error/result callback function.
 */
const validatePayload = bluebird.promisify((payload, isNew, cb) => {
  if (!payload.data) {
    cb(httpError(400, 'No data member was found in the request.'));
  } else if (!payload.data.type) {
    cb(httpError(400, 'All data payloads must contain the `type` member.'));
  } else if (isNew) {
    if (payload.data.id) {
      cb(httpError(400, 'Client generated identifiers are not supported. Remove the `id` member and try again.'));
    } else {
      cb(null, true);
    }
  } else if (!payload.data.id) {
    cb(httpError(400, 'All update requests must contain the `id` member.'));
  } else {
    cb(null, true);
  }
});

/**
 * Validates that the provided model type exists.
 * Will return an error to the callback if the model type is not registered.
 *
 * @param {string} type The model type (in plural form).
 * @param {function} cb The error/result callback function.
 */
const validateType = bluebird.promisify((type, cb) => {
  if (!modelManager.exists(type)) {
    cb(httpError(404, `No API resource exists for type: ${type}`));
  } else {
    cb(null, true);
  }
});

/**
 * Runs on all API routes with the `type` parameter.
 * Validates the model type and payload (when applicable).
 */
router.param('type', (req, res, next) => {
  validateType(req.params.type).then(() => {
    if (req.method === 'POST' || req.method === 'PATCH') {
      const isNew = req.method === 'POST';
      validatePayload(req.body, isNew).then(() => {
        next();
      }).catch(next);
    } else {
      next();
    }
  }).catch(next);
});

/**
 * Routes for listing all resources.
 */
router.get('/', (req, res) => {
  const resources = {};
  modelManager.getAllTypes().forEach((type) => {
    resources[type] = adapter.createLink(req, type);
  });
  res.json(resources);
});

/**
 * Root resource routes.
 */
router.route('/:type')

  /**
   * The retrieve/list all route.
   */
  .get((req, res, next) => {
    const type = req.params.type;
    // const collection = req.app.locals.db.collection(type);
    getCollection(type).find().toArrayAsync().then((records) => {
      const serializer = adapter.getSerializerFor(type, req);
      res.json(serializer.serialize(records));
    })
    .catch(next);
  })

  /**
   * The create route.
   */
  .post((req, res, next) => {
    const payload = req.body;
    const type = payload.data.type;
    const deserializer = adapter.getDeserializerFor(type);
    deserializer.deserializeAsync(payload).then((data) => {
      const metadata = modelManager.getMetadataFor(type);

      let toInsert = {};
      metadata.attributes.forEach((attr) => {
        toInsert[attr] = data[attr] || null;
        return toInsert;
      });
      toInsert = adapter.applyRelationshipData(type, data, toInsert);

      getCollection(type).insertOneAsync(toInsert).then((r) => {
        // eslint-disable-next-line no-underscore-dangle
        toInsert._id = r.insertedId;
        const serializer = adapter.getSerializerFor(type, req);
        res.json(serializer.serialize(toInsert));
      }).catch(next);
    }).catch(next);
  })
;

/**
 * Single model routes.
 */
router.route('/:type/:id')
  /**
   * The retrieve route.
   */
  .get((req, res, next) => {
    const type = req.params.type;
    findById(getCollection(type), req.params.id).then((record) => {
      const serializer = adapter.getSerializerFor(type, req);
      res.json(serializer.serialize(record));
    }).catch(next);
  })

  /**
   * The delete route.
   */
  .delete((req, res, next) => {
    const collection = getCollection(req.params.type);
    findById(collection, req.params.id).then(() => {
      collection.removeAsync({ _id: ObjectId(req.params.id) }).then(() => {
        res.status(204).send();
      }).catch(next);
    }).catch(next);
  })

  /**
   * The update route.
   */
  .patch((req, res, next) => {
    const payload = req.body;
    if (payload.data.id !== req.params.id) {
      throw httpError(400, 'The ID found in the request URI does not match the value of the `id` member.');
    }
    const type = payload.data.type;
    const deserializer = adapter.getDeserializerFor(type);
    deserializer.deserializeAsync(payload).then((data) => {
      const metadata = modelManager.getMetadataFor(type);

      let toUpdate = {};
      metadata.attributes.forEach((attr) => {
        if (typeof data[attr] !== 'undefined') {
          toUpdate[attr] = data[attr] || null;
        }
      });
      toUpdate = adapter.applyRelationshipData(type, data, toUpdate);

      const collection = getCollection(type);
      collection.updateOneAsync({ _id: ObjectId(payload.data.id) }, { $set: toUpdate }).then(() => {
        findById(collection, payload.data.id).then((record) => {
          const serializer = adapter.getSerializerFor(type, req);
          res.json(serializer.serialize(record));
        }).catch(next);
      }).catch(next);
    }).catch(next);
  })
;

/**
 * Relationship routes.
 */
router.route('/:type/:id/relationships/:key')
  /**
   * Display related models.
   */
  .get((req, res, next) => {
    const type = req.params.type;
    const key = req.params.key;

    if (!modelManager.hasRelationship(type, key)) {
      throw httpError(400, `The relationship '${key}' does not exist on model '${type}'`);
    }
    findById(getCollection(type), req.params.id).then((record) => {
      const rel = modelManager.getRelationshipFor(type, key);
      const serializer = adapter.getSerializerFor(rel.entity, req);
      const defaultResponse = serializer.serialize((rel.type === 'many') ? [] : null);

      if (!record[key]) {
        res.json(defaultResponse);
      } else {
        const relCollection = getCollection(rel.entity);
        if (rel.type === 'many') {
          if (Array.isArray(record[key])) {
            const identifiers = [];
            record[key].forEach((value) => {
              if (value.id) {
                identifiers.push(value.id);
              }
            });
            if (identifiers.length) {
              relCollection.find({ _id: { $in: identifiers } }).toArrayAsync().then((records) => {
                res.json(serializer.serialize(records));
              }).catch(next);
            } else {
              res.json(defaultResponse);
            }
          } else {
            res.json(defaultResponse);
          }
        } else if (record[key].id) {
          findById(relCollection, record[key].id).then((relRecord) => {
            res.json(serializer.serialize(relRecord));
          }).catch(() => res.json(defaultResponse));
        } else {
          res.json(defaultResponse);
        }
      }
    }).catch(next);

    // @todo Must determine HOW the rel should be saved in the database.
    // The default { id: "", type: "" } format is probably fine, however
    // we would need the ability to munge this hash for different schemas.
    // By always keeping a type, we could (but should we?) support a
    // relationships where ANY model type (or multiple, disparate model types)
    // could be related.
    // For now, this assumes that multiple model types are NOT supported.
    // The persistence side would need to enforce the rules about what can
    // and cannot be saved.

    // @todo This is now forced to use JSON:API format all the time.
    // Likely, the entire routing structure should be a part of the adapter, as
    // different formats may have completely different routing needs.
    // This complicates things more depending on which framework one is using.
    // Perhaps we don't care and will just enforce a standard somewhere in the microservice

    // @todo This is enforcing a native database query.
    // Once microserviced, this should use the entity service to retrieve data
    // and not the db directly.

    // @todo Relationships should support more options than just a foreign id.
    // The rel definition could (and probably should) support query parameters of any kind.
  })
;
router.route('/:type/:id/:relField')
  .post((req, res, next) => {
    next(httpError(501, 'Modifying relationships via the `related` link is not yet available.'));
  })
  .patch((req, res, next) => {
    next(httpError(501, 'Modifying relationships via the `related` link is not yet available.'));
  })
;

module.exports = router;
