const express = require('express');
const routes = require('./routes/index.js');
require('dotenv').config();

const server = express();
const port = process.env.PORT || 5000;

server.use('/', routes);

server.listen(port, () => {
    console.log(`Server listing at http://localhost:${port}`);
})