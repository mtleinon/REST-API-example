const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const uuidv4 = require('uuid');
const passwords = require('./passwords/passwords');
const graphqlHttp = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + '--' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json()); // application/json
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  console.log('REQ CAME:', req.method, req.url, req.body);
  next();
});

// If a client and this server runs in different domains, the headers shown below
// must be set. Otherwise client gets "Access to fetch at ... from origin ...
// has been blocked by CORS policy" error.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // graphql sends OPTIONS request before sending POST request to /graphql endpoint.
  // We must handle it here and not continue further by returning from this point:
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not authenticated');
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided!' });
  }
  if (req.body.oldPath) {
    deleteOldImage(req.body.oldPath);
  }
  return res
    .status(201)
    .json({ message: 'File stored.', filePath: req.file.path });
});

app.use(
  '/graphql',
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || 'An error occured';
      const status = err.originalError.code || 500;
      return { message, status, data };
    }
  })
);

// Generic error handling functionality. If Error is thrown in synchronous
// code or next(err) called in asynchronous code,
// this will send error message to client
app.use((error, req, res, next) => {
  console.log('DEBUG', error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({
    message: message,
    data: data
  });
});

console.log('process.env.NODE_ENV =', process.env.NODE_ENV);
let MONGO_URI;
if (process.env.NODE_ENV === 'production') {
  MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-ipmon.mongodb.net/messages?retryWrites=true`;
} else {
  MONGODB_URI = 'mongodb+srv://resttest:' +
    passwords.mongoTestPassword +
    '@cluster0-ipmon.mongodb.net/messages?retryWrites=true';
}
mongoose
  .connect(
    MONGODB_URI
  )
  .then(result => {
    const server = app.listen(8080);
    console.log('Listening port 8080');
  })
  .catch(err => console.log('CATCH: ', err));


const deleteOldImage = filePath => {
  filePath = path.join(__dirname, filePath);
  fs.unlink(filePath, err => {
    if (err) console.log('deleteOldImage: Error', err);
  });
}