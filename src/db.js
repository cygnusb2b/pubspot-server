const MongoDb = require('mongodb');
const Promise = require('bluebird');

Promise.promisifyAll(MongoDb);

const connections = [
  {
    name: 'analytics',
    server: 'mongodb://mongo.analytics.baseplatform.io:27017',
    options: {
      readPreference: 'nearest',
      replicaSet: 'analytics',
      w: 1,
    },
  },
  {
    name: 'legacy',
    server: 'mongodb://mongo.legacy.baseplatform.io:27017',
    options: {
      readPreference: 'nearest',
      replicaSet: 'merrick',
    },
  },
];

const state = {
  established: false,
  connections: {},
};

function getConnection(name) {
  if (state.established && Object.prototype.hasOwnProperty.call(state.connections, name)) {
    return state.connections[name];
  }
  throw new Error(`Unable to obtain the requested database connection: ${name}`);
}

function createConnectionPromise(config) {
  return MongoDb.MongoClient.connectAsync(config.server, config.options)
    .then((db) => {
      process.stdout.write(`Successful database connection to '${config.name}' on '${config.server}'\n`);
      return Object.create(null, {
        name: { value: config.name },
        db: { value: db },
      });
    })
  ;
}

function selectDb(connName, dbName) {
  return getConnection(connName).db(dbName);
}

function selectCollection(connName, dbName, collName) {
  return selectDb(connName, dbName).collection(collName);
}

function getAnalyticsDb() {
  return selectDb('analytics', 'oly_cygnus_ofcr_events');
}

function getBaseDb() {
  return selectDb('legacy', 'base_cygnus_ofcr');
}

function getMerrickDb() {
  return selectDb('legacy', 'merrick');
}

function getOmedaCollection() {
  return getMerrickDb().collection('omeda_brand_data');
}

function getUsersCollection() {
  return getMerrickDb().collection('users_v2');
}

exports.selectDb = selectDb;
exports.getAnalyticsDb = getAnalyticsDb;
exports.getBaseDb = getBaseDb;
exports.getMerrickDb = getMerrickDb;
exports.getOmedaCollection = getOmedaCollection;
exports.getUsersCollection = getUsersCollection;

exports.connect = function connect() {
  if (state.established) {
    return Promise.resolve(state.connections);
  }

  const promises = [];
  connections.forEach((config) => {
    promises.push(createConnectionPromise(config));
  });
  return Promise.all(promises).then((conns) => {
    state.established = true;
    conns.forEach((conn) => {
      state.connections[conn.name] = conn.db;
    });
    return state.connections;
  });
};

exports.selectCollection = selectCollection;
