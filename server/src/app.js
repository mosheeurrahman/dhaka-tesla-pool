// Postgres BIGINT columns (paisa amounts) come back from Prisma as native
// BigInt values, which JSON.stringify can't serialize by default. This
// patches BigInt globally so it serializes as a string wherever it shows
// up in any API response, rather than crashing res.json().
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const routes = require('./routes');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;