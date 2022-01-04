const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.signup = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Validation failed, incorrect data entered.');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }

    const { email, name, password } = req.body;
    bcrypt.hash(password, 10)
    .then(hashedPassword => {
        const user = new User({
            email: email,
            name: name,
            password: hashedPassword
        });
        return user.save();
    })
    .then(result => {
        res.status(201).json({
            message: 'User created',
            userId: result._id
        })
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}

exports.login = (req, res, next) => {
    const { email, password } = req.body;
    let loadedUser
    User.findOne({email: email})
    .then(user => {
        if(!user){
            const error = new Error('Incorrect login credentials');
            error.statusCode = 401;
            throw error;
        }
        loadedUser = user;
        return bcrypt.compare(password, user.password);
    })
    .then(isEqual => {
        if(!isEqual){
            const error = new Error('Incorrect login credentials');
            error.statusCode = 401;
            throw error;
        }
        const token = jwt.sign({
            email: loadedUser.email,
            userId: loadedUser._id.toString()
        }, 
        'first_app_secret_token', 
        {
            expiresIn: '1h'
        });
        res.status(200).json({
            token: token,
            userId: loadedUser._id.toString()
        })
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}