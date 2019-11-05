const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Post = require('../models/post');
const validator = require('validator');
const jsonWebToken = require('jsonwebtoken');

// const passwords = require('../passwords/passwords');

let jsonwebtokenSecret;
if (process.env.NODE_ENV === 'production') {
  jsonwebtokenSecret = process.env.JSON_WEBTOKEN_SECRET;
} else {
  jsonwebtokenSecret = passwords.jsonwebtokenSecret;
}

module.exports = {
  createUser: async function ({ userInput }, req) {
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: 'E-Mail is invalid.', status: 1 });
    }
    if (validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })) {
      errors.push({ message: 'Password too short!', status: 2 });
    }
    if (validator.isEmpty(userInput.name) ||
      !validator.isLength(userInput.name, { min: 5 })) {
      errors.push({ message: 'Name too short!', status: 3 });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input(s).');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error('User exists already!');
      throw error;
    }

    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPw,
    })

    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },

  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found.');
      error.code = 404;
      throw error;
    }
    return { ...user._doc, _id: user._id.toString() };
  },

  updateUserStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found.');
      error.code = 404;
      throw error;
    }
    user.status = status;

    await user.save();
    return { ...user._doc, _id: user._id.toString() };
  },

  login: async function ({ email, password }) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error('User not found.');
      error.code = 404;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Wrong password!');
      error.statusCode = 401;
      throw error;
    }
    const token = jsonWebToken.sign({
      userId: user._id.toString(),
      email: user.email
    }, jsonwebtokenSecret, { expiresIn: '1h' });

    return { token: token, userId: user._id.toString() };
  },

  createPost: async function ({ postInput }, req) {
    console.log('createPost');

    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: 'Title is invalid.' })
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Title is invalid.' })
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input(s).');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found from database!');
      error.code = 401;
      throw error;
    }
    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user
    });
    console.log('post=', post);
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    }
  },

  deletePost: async function ({ postId }, req) {
    console.log('deletePost:', postId);
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('Post not found from database!');
      error.code = 404;
      throw error;
    }

    if (req.userId !== post.creator._id.toString()) {
      const error = new Error('User is not authorized to edit the post!');
      error.code = 403;
      throw error;
    }
    await deleteOldImage(post.imageUrl);
    await Post.findByIdAndRemove(postId);
    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();
    return true;
  },

  updatePost: async function ({ postInput, postId }, req) {
    console.log('UpdatePost:', postId);

    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: 'Title is invalid.' })
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Title is invalid.' })
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input(s).');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const oldPost = await Post.findById(postId).populate('creator');
    if (!oldPost) {
      const error = new Error('Post not found from database!');
      error.code = 401;
      throw error;
    }

    if (req.userId !== oldPost.creator._id.toString()) {
      const error = new Error('User is not authorized to edit the post!');
      error.code = 401;
      throw error;
    }

    oldPost.title = postInput.title;
    oldPost.content = postInput.content;
    if (postInput.imageUrl !== 'undefined') {

      oldPost.imageUrl = postInput.imageUrl;
    }
    // oldPost.creator = user;

    const updatedPost = await oldPost.save();
    console.log('updatedPost=', updatedPost);

    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    }
  },


  posts: async function ({ page }, req) {
    console.log('posts');

    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post
      .find()
      .skip((page - 1) * perPage)
      .limit(perPage)
      .sort({ createdAt: -1 })
      .populate('creator');
    return {
      posts: posts.map(p => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts
    }
  },

  post: async function ({ postId }, req) {
    console.log('post: postId=', postId);

    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const post = await Post
      .findById(postId)
      .populate('creator');
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}

const deleteOldImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.log('deleteOldImage: Error', err));
}