'use strict';
const { createHandlers } = require('./lib/oauth');

exports.handler = async (event) => createHandlers().auth(event);
