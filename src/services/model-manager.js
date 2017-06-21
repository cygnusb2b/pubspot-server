const models = require('../models');

/**
 * Determines if the provided model type exists.
 *
 * @param {string} type The model type.
 * @return {boolean}
 */
function exists(type) {
  return Object.prototype.hasOwnProperty.call(models, type);
}

/**
 * Gets all available model types.
 *
 * @return {array}
 */
function getAllTypes() {
  return Object.keys(models);
}

/**
 * Gets the metadata (attributes, relationships, etc) for the provided model type.
 *
 * @param {string} type The model type.
 * @return {object}
 * @throws {Error} If the model type could not be found.
 */
function getMetadataFor(type) {
  if (!exists(type)) {
    throw new Error(`No model exists for type ${type}`);
  }
  return models[type];
}

/**
 * Gets all relationship field keys for the provided model type.
 *
 * @param {string} type The model type.
 * @return {array}
 */
function getRelationshipKeys(type) {
  const metadata = getMetadataFor(type);
  if (typeof metadata.relationships === 'object') {
    return Object.keys(metadata.relationships);
  }
  return [];
}

/**
 * Determines if relationship exists for the provided model type and property key.
 *
 * @param {string} type The model type.
 * @paran {string} key The relationship field key.
 * @return {boolean}
 */
function hasRelationship(type, key) {
  return getRelationshipKeys(type).indexOf(key) !== -1;
}

/**
 * Gets all relationship metadata objects for the provided model type.
 *
 * @param {string} type The model type.
 * @return {array}
 */
function getRelationshipsFor(type) {
  const relationships = [];

  const validTypes = { one: true, many: true };
  const metadata = getMetadataFor(type);

  getRelationshipKeys(type).forEach((key) => {
    const relMeta = metadata.relationships[key];
    if (!relMeta.entity || !Object.prototype.hasOwnProperty.call(validTypes, relMeta.type)) {
      // Invalid relationship metadata.
      return;
    }
    relationships.push({
      key,
      type: relMeta.type,
      entity: relMeta.entity,
    });
  });
  return relationships;
}

/**
 * Gets a single relationship metadata object for the provided model type and property key.
 *
 * @param {string} type The model type.
 * @paran {string} key The relationship field key.
 * @return {object}
 */
function getRelationshipFor(type, key) {
  if (!hasRelationship(type, key)) {
    throw new Error(`No ${key} relationship assigned on model ${type}`);
  }
  return getRelationshipsFor(type).find(rel => rel.key === key);
}

module.exports = {
  getAllTypes,
  getMetadataFor,
  exists,
  getRelationshipFor,
  getRelationshipsFor,
  getRelationshipKeys,
  hasRelationship,
};
