const express = require('express');
const boduParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

//for ssl
// const https = require('https');

//initialize express
const app = express();

//ssl cont
// const privateKey = fs.readFileSync('server.key');
// const certificate = fs.readFileSync('server.cert');

//constants
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.n4owb.mongodb.net/${process.env.MONGO_DEFAULT_DB}?retryWrites=true&w=majority`;

//configs
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        const fileExt = file.originalname.substring(file.originalname.lastIndexOf('.')+1, file.originalname.length);
        cb(null, `${crypto.createHash('md5').update(Math.floor(Math.random() * 100000).toString()).digest('hex')}.${fileExt}`);
    }
});

const fileFilter = (req, file, cb) => {
    if(file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg'){
        cb(null, true);
    }else{
        cb(null, false);
    }
}

//import routes
const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

//middlewares
app.use(boduParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access_log'), {
    flags: 'a'
});
app.use(multer({
    storage: fileStorage,
    fileFilter: fileFilter
}).single('image'));
app.use(compression());
app.use(morgan('combined', {
    stream: accessLogStream
}));

//cors headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
app.use(helmet());

//use routes
app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

//error handling routes
app.use((error, req, res, next) => {
    console.log(error);
    const { statusCode, message, data } = error;
    res.status(statusCode ? statusCode : 500).json({
        message: message,
        data: data
    });
})

//connect to db and listen
mongoose.connect(MONGODB_URI)
.then(result => {    
    console.log('Mongoose connected');
    // const server = https.createServer({
    //     key: privateKey, 
    //     cert: certificate
    // }, app)
    // .listen(process.env.PORT || 5100);
    const server = app.listen(process.env.PORT || 5100);
    const io = require('./socket').init(server);
    io.on('connection', socket => {
        console.log('Client connected');
    })
})
.catch(err => console.log(err));