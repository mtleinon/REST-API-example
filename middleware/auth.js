const jsonwebtoken = require('jsonwebtoken');
// const passwords = require('../passwords/passwords');

let jsonwebtokenSecret;
if (process.env.NODE_ENV === 'production') {
  jsonwebtokenSecret = process.env.JSON_WEBTOKEN_SECRET;
} else {
  jsonwebtokenSecret = passwords.jsonwebtokenSecret;
}

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }
  const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    decodedToken = jsonwebtoken.verify(token, jsonwebtokenSecret);
  } catch (err) {
    req.isAuth = false;
    return next();
  }
  if (!decodedToken) {
    req.isAuth = false;
    return next();
  }
  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
}