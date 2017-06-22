module.exports = {
  'website-channel': {
    collection: 'Section',
    field: 'name',
    query: {
      type: 'Website',
      status: 1,
      channel: true,
    },
  },
  'website-section': {
    collection: 'Section',
    field: 'name',
    query: {
      type: 'Website',
      status: 1,
      $or: [
        { channel: { $exists: false } },
        { channel: false },
      ],
    },
  },
  'newsletter-section': {
    collection: 'Section',
    field: 'name',
    query: {
      type: 'Newsletter',
      status: 1,
    },
  },
  'magazine-section': {
    collection: 'Section',
    field: 'name',
    query: {
      type: 'Magazine',
      status: 1,
    },
  },
  'taxonomy-category': {
    collection: 'Taxonomy',
    field: 'name',
    query: {
      type: 'Category',
      status: 1,
    },
  },
  'content-company': {
    collection: 'Content',
    field: 'name',
    query: {
      contentType: 'Company',
      status: 1,
    },
  },
};
