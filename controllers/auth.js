const {
  validationResult
} = require('express-validator/check');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jsonwebtoken = require('jsonwebtoken');
const passwords = require('../passwords/passwords');

exports.getUserStatus = async (req, res, next) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId);
    res.status(200).json({
      userId: user._id,
      status: user.status
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
}

exports.postUserStatus = async (req, res, next) => {
  const newStatus = req.body.newStatus;
  const userId = req.userId;
  try {
    const user = await User.findById(userId);
    user.status = newStatus;
    await user.save();
    res.status(200).json({
      message: 'User status updated.',
      userId: user._id,
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
}

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;

  try {
    const hashedPw = await bcrypt.hash(password, 12);
    user = new User({
      email,
      password: hashedPw,
      name
    });
    await user.save();
    res.status(201).json({
      message: 'User created',
      userId: user._id
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  };
}

exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  try {
    const user = await User.findOne({
      email
    });
    if (!user) {
      const error = new Error('A user with this email could not be found.');
      error.statusCode = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Wrong password!');
      error.statusCode = 401;
      throw error;
    }
    const token = jsonwebtoken.sign({
      email: user.email,
      userId: user._id.toString()
      },
      passwords.jsonwebtokenSecret, {
        expiresIn: '1h'
      }
    );
    res.status(200).json({
      token: token,
      userId: user._id.toString()
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
}