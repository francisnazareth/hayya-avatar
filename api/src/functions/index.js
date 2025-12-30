const { app } = require('@azure/functions');

// Import all function handlers
require('./apiProxy');
require('./avatarProxy');

module.exports = { app };
