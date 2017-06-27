const promisify = require('bluebird').promisify;
const httpError = require('http-errors');

function getBaseMatch(type, identifier) {
  // @todo Will need to add dates when a range is eventually sent.
  // createdAt: { $gte: startDate, $lt: endDate },
  switch (type) {
    case 'website-channel':
      return {
        'entity.keyValues.primarySection': identifier,
        action: 'view',
      };
    case 'website-section':
      return {
        'entity.keyValues.primarySection': identifier,
        action: 'view',
      };
    case 'taxonomy-category':
      return {
        'entity.relatedTo.type': 'taxonomy',
        'entity.relatedTo.clientId': identifier,
        action: 'view',
      };
    case 'content-company':
      // @todo This should query base first for content ids, then run.
      return {
        $or: [
          { clientId: identifier },
          {
            'entity.relatedTo.type': 'content',
            'entity.relatedTo.clientId': identifier,
          },
        ],
        action: 'view',
      };
    default:
      return { action: 'view' };
  }
}

module.exports = (segmentType, segmentId, reportKey) => {
  const pipelines = {
    'content-engagement': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $group: {
          _id: '$clientId',
          title: { $first: '$entity.keyValues.name' },
          type: { $first: '$entity.keyValues.contentType' },
          identified: { $sum: { $cond: { if: { $eq: ['$session.customerId', null] }, then: 0, else: 1 } } },
          total: { $sum: 1 },
        } },
        { $sort: { total: -1 } },
        { $limit: 250 },
        { $project: {
          id: '$_id',
          _id: 0,
          type: 1,
          title: 1,
          identified: 1,
          total: 1,
          pctIdentified: { $divide: ['$identified', '$total'] },
        } },
      ]);
    },
    'user-demographic': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $match: { 'session.customerId': { $ne: null } } },
        { $group: {
          _id: null,
          users: { $addToSet: '$session.customerId' },
        } },
        { $project: { _id: 0 } },
      ]);
    },
    'user-states': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $match: { 'session.customerId': { $ne: null } } },
        { $group: {
          _id: null,
          users: { $addToSet: '$session.customerId' },
        } },
        { $project: { _id: 0 } },
      ]);
    },
    'user-countries': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $match: { 'session.customerId': { $ne: null } } },
        { $group: {
          _id: null,
          users: { $addToSet: '$session.customerId' },
        } },
        { $project: { _id: 0 } },
      ]);
    },
    'top-users': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $match: { 'session.customerId': { $ne: null } } },
        { $group: {
          _id: '$session.customerId',
          actions: { $sum: 1 },
        } },
        { $sort: { actions: -1 } },
        { $limit: 20 },
      ]);
    },
    'user-count': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $match: { 'session.customerId': { $ne: null } } },
        { $group: {
          _id: '$session.customerId',
        } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
        } },
        { $project: { _id: 0 } },
      ]);
    },
    'session-counts': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $group: {
          _id: { sessionId: '$session.id', customerId: '$session.customerId' },
        } },
        { $group: {
          _id: null,
          anonymous: { $sum: { $cond: { if: { $eq: ['$_id.customerId', null] }, then: 1, else: 0 } } },
          identified: { $sum: { $cond: { if: { $eq: ['$_id.customerId', null] }, then: 0, else: 1 } } },
          total: { $sum: 1 },
        } },
        { $project: { _id: 0 } },
      ]);
    },
    'session-timeline': (cb) => {
      cb(null, [
        { $match: getBaseMatch(segmentType, segmentId) },
        { $group: {
          _id: {
            sessionId: '$session.id',
            customerId: '$session.customerId',
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
        } },
        { $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day',
          },
          anonymous: { $sum: { $cond: { if: { $eq: ['$_id.customerId', null] }, then: 1, else: 0 } } },
          identified: { $sum: { $cond: { if: { $eq: ['$_id.customerId', null] }, then: 0, else: 1 } } },

        } },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        { $project: { date: '$_id', anonymous: 1, identified: 1, _id: 0 } },
      ]);
    },
  };

  const notFound = (cb) => {
    cb(httpError(404, `The provided report key '${reportKey}' was not found.`));
  };
  const toCall = (pipelines[reportKey]) ? pipelines[reportKey] : notFound;
  return promisify(toCall);
};
