const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  } else {
    console.error(`${err.name}: ${err.message}`);
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      data: { errors: messages },
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}: '${value}' already exists`,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field '${err.path}': ${err.value}`,
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum allowed size is 10 MB',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: `Unexpected file field. Use 'file' as the form field name`,
    });
  }

  if (err.message && err.message.startsWith('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err.isAxiosError) {
    const status = err.response?.status || 502;
    const spError = err.response?.data?.errors?.[0];
    const spMessage = spError
      ? `Amazon SP-API error [${spError.code}]: ${spError.message}`
      : `Amazon SP-API request failed: ${err.message}`;

    return res.status(status >= 400 && status < 600 ? status : 502).json({
      success: false,
      message: spMessage,
      data: { amazonError: err.response?.data || null },
    });
  }

  if (err.message && err.message.includes('Missing Amazon SP-API config')) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

export default errorHandler;