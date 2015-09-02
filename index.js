// load config
require('dotenv').load()

// create app
var express = require('express')
var app = express()

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
    track: 'slowcore'
  }
)

// proxy initial timeline request
app.get('/tweets', function (req, res) {
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
      }
      res.send(data)
    }
  )
})

// delete this and use s3 instead
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html')
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
