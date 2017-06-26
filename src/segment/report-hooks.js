const promisify = require('bluebird').promisify;
const dbConns = require('../db');

function getMerrickDb() {
  return dbConns.selectDb('legacy', 'merrick');
}

function getUsersCollection() {
  return getMerrickDb().collection('users_v2');
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

module.exports = (reportKey) => {
  const hooks = {
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
