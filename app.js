const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const uuidv4 = require('uuid');
const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');
const passwords = require('./passwords/passwords');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: function(req, file, cb) {
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
app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image'));
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
  next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

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

const MONGODB_URI = 'mongodb+srv://test:' +
  passwords.mongoTestPassword +
  '@cluster0-ipmon.mongodb.net/messages?retryWrites=true';

mongoose
  .connect(
    MONGODB_URI
  )
  .then(result => {
    const server = app.listen(8080);
    const io = require('./socket').init(server);
    io.on('connection', socket => {
      console.log('Client connected');
    });
    console.log('Listening port 8080');
  })
  .catch(err => console.log('CATCH: ', err));