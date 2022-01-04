const { validationResult } = require('express-validator');
const io = require('../socket');
const fs = require('fs');
const path = require('path');
const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = (req, res, next) => {
    const { page = 1 } = req.query;
    const perPage = 2;
    let totalItems;

    Post.find().countDocuments()
    .then(count => {
        totalItems = count;
        return Post.find()
        .populate('creator')
        .sort({createdAt: -1})
        .skip((page-1) * perPage)
        .limit(perPage);
    })
    .then(posts => {
        res.status(200).json({
            message: 'Posts fetched',
            posts: posts,
            totalItems: totalItems
        })
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

exports.createPost = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Validation failed, incorrect data entered.');
        error.statusCode = 422;
        throw error;
    }
    if(!req.file){
        const error = new Error('An image is required.');
        error.statusCode = 422;
        throw error;
    }
    const { title, content } = req.body;
    let creator;
    //create post
    const post = new Post({
        title: title,
        content: content,
        imageUrl: req.file.path,
        creator: req.userId
    });
    post.save()
    .then(result => {
        return User.findById(req.userId);
    })
    .then(user => {
        creator = user;
        user.posts.push(post);
        user.isNew = false;
        return user.save();
    })
    .then(result => {
        io.getIO().emit('posts', {
            action: 'create',
            post: {
                ...post._doc,
                creator: {
                    _id: req.userId,
                    name: creator.name
                }
            }
        })
        res.status(201).json({
            message: 'Post created successfully',
            post: post,
            creator: {
                _id: creator._id,
                name: creator.name
            }
        });
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

exports.getPost = (req, res, next) => {
    const { postId } = req.params;
    Post.findById(postId.trim())
    .then(post => {
        if(!post){
            const error = new Error('No post found');
            error.statusCode = 404;
            throw error;
        }
        post.imageUrl = post.imageUrl.replace('\\', '/');
        res.status(200).json({
            message: 'Post fetched',
            post: post
        });
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

exports.editPost = (req, res, next) => {
    const { postId } = req.params;
    const { title, content, image } = req.body;
    let imageUrl;
    if(req.file){
        imageUrl = req.file.path;
    }else{
        imageUrl = image;
    }

    if(!imageUrl && !req.file.path){
        const error = new Error('No file picked');
        error.statusCode = 422;
        throw error;
    }

    Post.findById(postId)
    .populate('creator')
    .then(post => {
        if(!post){
            const error = new Error('No post found');
            error.statusCode = 404;
            throw error;
        }
        if(post.creator._id.toString() !== req.userId){
            console.log(post);
            console.log('returned id:', post.creator._id.toString());
            console.log('compared id:', req.userId);
            const error = new Error('Not authorized');
            error.statusCode = 403;
            throw error;
        }
        if(imageUrl !== post.imageUrl){
            clearImage(post.imageUrl);
        }
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        post.isNew = false;
        return post.save();
    })
    .then(result => {        
        io.getIO().emit('posts', {
            action: 'update',
            post: result
        })
        res.status(201).json({
            message: 'Post updated successfully',
            post: result
        });
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

exports.deletePost = (req, res, next) => {
    const { postId } = req.params;
    if(!postId){
        const error = new Error('No post ID');
        error.statusCode = 404;
        throw error;
    }

    Post.findById(postId)
    .then(post => {
        if(!post){
            const error = new Error('No post found');
            error.statusCode = 404;
            throw error;
        }        
        if(post.creator.toString().trim() !== req.userId.trim()){
            const error = new Error('Not authorized');
            error.statusCode = 403;
            throw error;
        }
        //check if post belongs to user
        clearImage(post.imageUrl);
        return Post.findByIdAndRemove(postId);
    })
    .then(result => {
        return User.findById(req.userId);
    })
    .then(user => {
        user.posts.pull(postId);
        user.isNew = false;
        return user.save();
    })
    .then(result => {        
        io.getIO().emit('posts', {
            action: 'delete',
            post: postId
        })
        res.status(200).json({
            message: 'Post deleted'
        });
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

const clearImage = filePath => {
    constructedPath = path.join(__dirname, '..', filePath);
    fs.unlink(constructedPath, err => console.log(err));
}