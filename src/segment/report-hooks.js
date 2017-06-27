const httpError = require('http-errors');
const promisify = require('bluebird').promisify;
const getOmedaCollection = require('../db').getOmedaCollection;
const getUsersCollection = require('../db').getUsersCollection;

function getDemoraphicLabelFor(id, values) {
  const demoValue = values.find(value => value.Id === Number(id));
  return demoValue ? demoValue.ShortDescription : 'N/A';
}

function getOmedaDemographicValueIds(values, cast = true) {
  return values.map(value => (cast ? String(value.Id) : value.Id));
}

function retrieveOmedaDemograpic(brand, id) {
  const dbId = `omeda_brand_data_${brand}`;
  return getOmedaCollection().findOneAsync({
    _id: dbId,
    'Demographics.Id': Number(id),
  }, {
    fields: { 'Demographics.$': 1 },
  }).then((res) => {
    if (!res) {
      throw httpError(404, `No Omeda demographic id '${id}' found for brand '${brand}'.`);
    } else {
      return res.Demographics[0];
    }
  });
}

function sortByActions(a, b) {
  if (a.actions < b.actions) {
    return 1;
  }
  if (a.actions > b.actions) {
    return -1;
  }
  return 0;
}

/**
 * @param {string} reportKey The report key.
 * @param {object} params The report hook parameters.
 * @return {Promise}
 */
module.exports = (reportKey, params) => {
  const hooks = {
    'user-demographic': (reportData, cb) => {
      if (!params.service || !params.identifier) {
        cb(httpError(400, 'A demographic service and identifier must be in the request.'));
      } else if (params.service !== 'omeda') {
        cb(httpError(422, 'Currently, only the `omeda` service is supported.'));
      } else if (reportData.length && Array.isArray(reportData[0].users)) {
        const userIds = reportData[0].users;
        retrieveOmedaDemograpic(...params.identifier.split('|'))
          .then((demo) => {
            const response = {
              id: demo.Id,
              label: demo.Description,
              count: userIds.length,
              values: [],
            };

            const key = `omeda_${demo.Id}`;
            const values = demo.DemographicValues;
            const valueIds = getOmedaDemographicValueIds(values);
            if (valueIds.length) {
              const pipeline = [
                { $match: { _id: { $in: userIds } } },
                { $group: { _id: `$${key}`, count: { $sum: 1 } } },
                { $match: { _id: { $in: valueIds } } },
                { $project: { id: '$_id', count: 1 } },
              ];
              getUsersCollection().aggregateAsync(pipeline)
                .then((res) => {
                  let total = 0;
                  res.forEach((doc) => {
                    const label = getDemoraphicLabelFor(doc.id, values);
                    response.values.push({ id: doc.id, label, count: doc.count });
                    total += doc.count;
                  });
                  const unknown = userIds.length - total;
                  if (unknown) {
                    response.values.push({ id: null, label: 'Unknown', count: unknown });
                  }
                  cb(null, response);
                })
                .catch(cb)
              ;
            } else {
              response.values.push({ id: null, label: 'Unknown', count: userIds.length });
              cb(null, response);
            }
          })
          .catch(cb)
        ;
      } else {
        cb(null, []);
      }
    },
    'user-states': (reportData, cb) => {
      if (reportData.length && Array.isArray(reportData[0].users)) {
        const userIds = reportData[0].users;
        getUsersCollection().aggregateAsync([
          { $match: {
            _id: { $in: userIds },
            country: 'USA',
          } },
          { $group: {
            _id: '$region',
            count: { $sum: 1 },
          } },
          { $sort: { count: -1 } },
          { $project: {
            code: { $cond: {
              if: {
                $or: [{ $eq: ['$_id', null] }, { $eq: ['$_id', ''] }],
              },
              then: 'Unknown',
              else: '$_id',
            } },
            count: 1,
            _id: 0,
          } },
        ]).then(res => cb(null, res))
          .catch(cb)
        ;
      } else {
        cb(null, []);
      }
    },
    'user-countries': (reportData, cb) => {
      if (reportData.length && Array.isArray(reportData[0].users)) {
        const userIds = reportData[0].users;
        getUsersCollection().aggregateAsync([
          { $match: {
            _id: { $in: userIds },
          } },
          { $group: {
            _id: '$country',
            count: { $sum: 1 },
          } },
          { $sort: { count: -1 } },
          { $project: {
            code: { $cond: { if: { $eq: ['$_id', null] }, then: 'Unknown', else: '$_id' } },
            count: 1,
            _id: 0,
          } },
        ]).then(res => cb(null, res))
          .catch(cb)
        ;
      } else {
        cb(null, []);
      }
    },
    'top-users': (reportData, cb) => {
      const userIds = [];
      const actions = {};
      reportData.forEach((row) => {
        // eslint-disable-next-line no-underscore-dangle
        const userId = row._id;
        actions[userId.valueOf()] = row.actions;
        userIds.push(userId);
      });
      if (userIds.length) {
        // eslint-disable-next-line no-underscore-dangle
        const mapActions = doc => Object.assign({}, doc, { actions: actions[doc._id.valueOf()] });

        getUsersCollection()
          .find({ _id: { $in: userIds } })
          .project({ email: 1, first_name: 1, last_name: 1, company_name: 1 })
          .toArrayAsync()
          .then(res => cb(null, res.map(mapActions).sort(sortByActions)))
          .catch(cb)
        ;
      } else {
        cb(null, []);
      }
    },
    'user-count': (reportData, cb) => {
      if (reportData.length) {
        cb(null, reportData[0]);
      } else {
        cb(null, { total: 0 });
      }
    },
    'session-counts': (reportData, cb) => {
      if (reportData.length) {
        cb(null, reportData[0]);
      } else {
        cb(null, { anonymous: 0, identified: 0, total: 0 });
      }
    },
  };
  const defaultHook = (reportData, cb) => {
    cb(null, reportData);
  };
  const toCall = (hooks[reportKey]) ? hooks[reportKey] : defaultHook;
  return promisify(toCall);
};
