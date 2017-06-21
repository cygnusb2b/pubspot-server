module.exports = (app) => {
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const error = {
      status: String(statusCode),
      title: err.name || 'Internal Server Error',
      detail: err.message || 'An unknown, fatal error occurred!',
    };

    if (process.env.NODE_ENV !== 'production') {
      error.meta = { stack: err.stack.split('\n') };
    }

    res.status(statusCode).json({
      errors: [error],
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((req, res, next) => {
    res.status(404).json({
      errors: [{
        status: '404',
        title: 'Not Found',
        detail: `No resource available for ${req.method} ${req.path}`,
      }],
    });
  });
};

