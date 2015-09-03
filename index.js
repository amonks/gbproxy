// load config
require('dotenv').load()

// monitoring
require('newrelic')

// redis cache
var redis = require('redis').createClient(process.env.REDIS_URL)
redis.on('error', function (err) {
  console.log('Error ' + err)
})

// create app
var express = require('express')
var cors = require('cors')
var app = express()

// set up cross-origin request handling
var corsOptions = {
  origin: process.env.CLIENT
}
app.use(cors(corsOptions))

// create twitter object
var Twitter = require('twit')
var t = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.TOKEN,
  access_token_secret: process.env.TOKEN_SECRET
})

// load a stream of the user's tweets
var stream = t.stream(
  'statuses/filter',
  {
    follow: process.env.USER_ID,
    track: process.env.HASHTAG
  }
)

// display something when '/' is requested
app.get('/', function (req, res) {
  res.send('This is the gifbooth proxy server.')
})

// proxy initial timeline request
app.get('/tweets', function (req, res) {

  // if it's cached already, send that
  redis.get('tweets', function (err, tweets) {
    if (err) {
      console.log(err)
    }
    if (tweets) {
      res.send(tweets)
    // otherwise fetch the tweets from the twitter rest api
    } else {
      t.get(
        'statuses/user_timeline',
        {
          user_id: process.env.USER_ID,
          exclude_replies: true,
          include_rts: false,
          trim_user: true
        },
        function (err, data, response) {
          if (err) {
            console.log(err.stack)
          } else {
            // send it off
            res.send(data)
            // cache the tweets
            redis.set('tweets', data)
            redis.expire('tweets', 2) // seconds
          }
        }
      )
    }
  })
})

// create server
var server = app.listen(process.env.PORT || 8080, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('listening at http://%s:%s', host, port)
})

// proxy stream to connected clients
var io = require('socket.io')(server)
io.on('connection', function (socket) {
  console.log('connection made')
  stream.on('tweet', function (tweet) {
    socket.emit('tweet', tweet)
  })
})
