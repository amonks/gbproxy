// load config
require('dotenv').load()

// monitoring
require('newrelic')

var ui = require('./ui')
var proxy_twitter = require('./proxy_twitter')
var email = require('./email')

// create app
var express = require('express')
var app = express()

var session = require('express-session')
var sessionOptions = {
  secret: process.env.SALT,
  cookie: { maxAge: 60000 }
}
app.use(session(sessionOptions))

var Grant = require('grant-express')
var grant = new Grant({
  'server': {
    'protocol': process.env.PROTOCOL,
    'host': process.env.HOST,
    'callback': '/callback',
    'transport': 'session'
  },
  'twitter': {
    'key': process.env.TWITTER_CONSUMER_KEY,
    'secret': process.env.TWITTER_CONSUMER_SECRET,
    'callback': '/twitter/callback'
  },
  'facebook': {
    'key': process.env.FACEBOOK_KEY,
    'secret': process.env.FACEBOOK_SECRET,
    'scope': ['publish_actions'],
    'callback': '/facebook/callback'
  }
})
app.use(grant)

// set up cross-origin request handling
var cors = require('cors')
var corsOptions = {
  origin: process.env.CLIENT
}
app.use(cors(corsOptions))

var shareTwitter = function (req, res) {
  var oauth = makeTwitterOauth(req)
  var up = require('./upload_twitter')
  var filename = req.session.tweet_id + '.mp4'
  up.uploadURL(oauth, req.session.mp4_url, filename)
    .then(function (media_id) {
      var postTwitter = require('./post_twitter')
      postTwitter.post(oauth, {
        'status': req.session.text,
        'media_ids': media_id
      }).then(function () {
        ui.alert(res, 'tweet posted', 'success')
      })
    })
    .catch(console.log)
}

var shareFacebook = function (req, res) {
  var oauth = makeFacebookOauth(req)
  res.send(oauth)
}

var makeFacebookOauth = function (req) {
  return {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    token: req.session.grant.response.access_token
  }
}

var makeTwitterOauth = function (req) {
  return {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    token: req.session.grant.response.access_token,
    token_secret: req.session.grant.response.access_secret,
    verifier: req.session.grant.step1.oauth_token
  }
}

app.get('/share/facebook', function (req, res) {
  req.session.mp4_url = req.query.mp4_url
  req.session.tweet_id = req.query.tweet_id
  req.session.text = req.query.text
  res.redirect('/connect/facebook')
})
app.get('/facebook/callback', shareFacebook)

app.get('/share/twitter', function (req, res) {
  req.session.mp4_url = req.query.mp4_url
  req.session.tweet_id = req.query.tweet_id
  req.session.text = req.query.text
  res.redirect('/connect/twitter')
})
app.get('/twitter/callback', shareTwitter)

// display something when '/' is requested
app.get('/', function (req, res) {
  res.redirect(process.env.CLIENT)
})

// email gifs using mandrill
app.post('/share/email', function (req, res) {
  email.send({
    gif_url: req.query.gif_url,
    to_email: req.query.to_email,
    to_name: req.query.to_name
  })
  .then(function () {
    res.send('sent')
  })
  .catch(function (err) {
    res.send('error!' + err)
  })
})

// proxy initial timeline request
app.get('/tweets', function (req, res) {
  var send = function (data) { res.send(data) }
  proxy_twitter.getTimeline()
  .then(send)
  .catch(console.log)
})

app.get('/tweets/:max_id', function (req, res) {
  var send = function (data) { res.send(data) }
  proxy_twitter.getTimeline(req.params.max_id)
  .then(send)
  .catch(console.log)
})

// proxy initial timeline request
app.get('/tweet/:tweet_id', function (req, res) {
  var send = function (data) { res.send(data) }
  proxy_twitter.getTimeline(req.params.tweet_id)
  .then(send)
  .catch(console.log)
})

// create server
var server = app.listen(process.env.PORT || 8080, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('\n\n\nlistening at http://%s:%s', host, port)
})

// proxy stream to connected clients
var io = require('socket.io')(server)
proxy_twitter.stream.on('tweet', function (tweet) {
  io.emit('tweet', tweet)
  if (process.env.S3_TEST === 'true') {
    var s3backup = require('./s3_backup')
    s3backup.do(tweet)
  }
})
