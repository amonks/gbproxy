// load config
require('dotenv').load()

// monitoring
require('newrelic')

// redis cache
var redis = require('redis').createClient(process.env.REDIS_URL)
redis.on('error', function (err) {
  console.log('Error ' + err)
})

// email
var mandrill = require('mandrill-api/mandrill')
var mandrill_client = new mandrill.Mandrill(process.env.MANDRILL_KEY)

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

// display something when '/' is requested
app.get('/', function (req, res) {
  res.send('This is the gifbooth proxy server.')
})

// email gifs using mandrill
app.post('/email', function (req, res) {
  console.log(req.query)
  mandrill_client.messages.sendTemplate({
    'template_name': 'share-gif',
    'template_content': [{}],
    'message': {
      'global_merge_vars': [
        {
          'name': 'from_name',
          'content': req.query.from_name
        },
        {
          'name': 'gif_url',
          'content': req.query.gif_url
        }, {
          'name': 'event_url',
          'content': 'http://example.com'
        }, {
          'name': 'event_title',
          'content': 'fashion week'
        }
      ],
      'subject': 'Gifbooth Gif!',
      'from_email': req.query.from_email,
      'from_name': req.query.from_name,
      'to': [{
        'email': req.query.to_email,
        'name': req.query.to_name
      }]
    }
  }, function (result) {
    console.log('sent an email to ', req.query.to_email)
    console.log(result)
  }, function (err) {
    console.log(err)
  })
  res.send('email sent')
})

// proxy initial timeline request
app.get('/tweets', function (req, res) {
  var send = function (data) { res.send(data) }
  var timelineParams = {key: req.url}
  cacheGet('tweets', getTimeline, timelineParams).then(send).catch(console.log)
})

app.get('/tweets/:maxID', function (req, res) {
  var send = function (data) { res.send(data) }
  var maxID = req.params.maxID - 1
  var timelineParams = {maxID: maxID, key: req.url}
  cacheGet(req.url, getTimeline, timelineParams).then(send).catch(console.log)
})

var getTimeline = function (params) {
  return new Promise(function (resolve, reject) {
    var requestParams = {
      user_id: process.env.USER_ID,
      exclude_replies: true,
      include_rts: false,
      trim_user: true
    }
    if (typeof params.maxID !== 'undefined') {
      requestParams.max_id = params.maxID
    }
    t.get(
      'statuses/user_timeline',
      requestParams,
      function (err, data, response) {
        if (err) {
          reject(err)
        } else {
          // cache the tweets
          redis.set(params.key, JSON.stringify(data))
          redis.expire(params.key, parseInt(process.env.REDIS_EXPIRE, 10) || 10) // seconds{
          // send it off
          resolve(data)
        }
      }
    )
  })
}

var cacheGet = function (key, cb, params) {
  return new Promise(function (resolve, reject) {
    // if it's cached already, send that
    redis.get(key, function (err, cached) {
      if (err) {
        console.log('cache fail', err)
        reject('cache fail', err)
      }
      if (cached) {
        resolve(JSON.parse(cached))
      } else {
        // not cached
        cb(params).then(resolve)
      }
    })
  })
}

// create server
var server = app.listen(process.env.PORT || 8080, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('listening at http://%s:%s', host, port)
})

// load a stream of the user's tweets
var stream = t.stream(
  'statuses/filter',
  {
    follow: process.env.USER_ID,
    track: process.env.HASHTAG
  }
)
// proxy stream to connected clients
var io = require('socket.io')(server)
stream.on('tweet', function (tweet) {
  console.log('got a tweet!')
  io.emit('tweet', tweet)

  // if testing, upload streamed tweets to s3 as gifs
  if (process.env.S3_TEST === 'true') {
    console.log('TESTING; gonna upload this one to s3')
    var https = require('https')
    var gifify = require('gifify')
    var aws = require('aws-sdk')
    var path = require('path')
    var fs = require('fs')

    // download the mp4 from twitter
    console.log('TESTING; gonna download the mp4 from twitter')
    https.get(tweet.extended_entities.media[0].video_info.variants[0].url, function (res, err) {
      if (err) {
        console.log('https get error', err)
      }
      var file = fs.createWriteStream('tmp/' + tweet.id_str + '.mp4')
      res.pipe(file)

      // convert the mp4 to a gif
      console.log('TESTING; gonna convert the mp4 to a gif')
      res.on('end', function () {
        var output = path.join(__dirname, 'tmp/' + tweet.id_str + '.gif')
        var gif = fs.createWriteStream(output)
        gifify('tmp/' + tweet.id_str + '.mp4', {}).pipe(gif).on('finish', function () {
          // read the converted gif
          console.log('TESTING; gonna read the converted gif')
          fs.readFile('tmp/' + tweet.id_str + '.gif', function (err, fileContents) {
            if (err) {
              console.log('error reading file', file, err)
            } else {
              // and upload it to s3
              console.log('TESTING; gonna put it in a bucket')
              var params = {
                'Bucket': process.env.AWS_S3_BUCKET,
                'Key': tweet.id_str + '.gif',
                'Body': fileContents,
                'ACL': 'public-read'
              }
              new aws.S3().upload(params, function (err, data) {
                if (err) {
                  console.log('Error uploading data:', err)
                } else {
                  console.log('Successfully uploaded data to myBucket/myKey')
                }
              })
            }
          })
        })
      })
    })
  }
})
