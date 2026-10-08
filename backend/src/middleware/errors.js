export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  res.status(status).json({
    error: {
      message: err.message || "Server error"
    }
  });
}

