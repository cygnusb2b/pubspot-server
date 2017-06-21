module.exports = {
  type: 'organization',
  attributes: ['name', 'description', 'body'],
  relationships: {
    tags: { type: 'many', entity: 'tags' },
  },
};
