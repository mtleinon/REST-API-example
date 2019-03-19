const express = require('express');

const { body } = require('express-validator/check');

const authController = require('../controllers/auth');
const isAuth = require('../middleware/is-auth');
const User = require('../models/user');

const router = express.Router();

router.put('/signup', 
[
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .custom((value, { req }) => {
      return User
        .findOne({email: value})
        .then(userDoc => {
          if (userDoc) {
            return Promise.reject('E-Mail address already exists!');
          }
        })
    }),
  body('password')
    .trim()
    .isLength({min: 5}),
  body('name')
    .trim()
    .not()
    .isEmpty()
  ],
  authController.signup);

  router.post('/login', authController.login);

  router.get('/getuserstatus', isAuth, authController.getUserStatus);
  router.patch('/setuserstatus', isAuth, authController.postUserStatus);

module.exports = router;