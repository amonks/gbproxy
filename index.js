// load config
require('dotenv').load()

// monitoring
require('newrelic')

var request = require('request')
var fs = require('fs')
var del = require('del')

var ui = require('./ui')

// redis cache
var redis = require('redis').createClient(process.env.REDIS_URL)
redis.on('error', function (err) {
  console.log('\n\n\nRedis Error ' + err)
})

// email
var mandrill = require('mandrill-api/mandrill')
var mandrill_client = new mandrill.Mandrill(process.env.MANDRILL_KEY)

// create app
var express = require('express')
var session = require('express-session')
var cors = require('cors')
var app = express()

var sessionOptions = {
  secret: 'powerful ox',
  cookie: { maxAge: 60000 }
}
app.use(session(sessionOptions))

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

var UserTwitter = require('node-twitter-api')
var tu = new UserTwitter({
  consumerKey: process.env.CONSUMER_KEY,
  consumerSecret: process.env.CONSUMER_SECRET,
  callback: process.env.HOST + '/authorized-twitter'
})

var authorizeTwitter = function (req, res) {
  console.log('\n\n\nauthorizing twitter', req.session)
  tu.getRequestToken(function (err, requestToken, requestTokenSecret, results) {
    if (err) {
      console.log(err)
    } else {
      // get access token
      req.session.twitterRequestToken = requestToken
      req.session.twitterRequestTokenSecret = requestTokenSecret
      res.redirect(tu.getAuthUrl(requestToken))
    }
  })
}

var postAsTweet = function (req, res) {
  // upload media
  var localFileName = __dirname + '/tmp/' + req.session.tweet_id + '-tweeting.mp4'
  del.sync(localFileName)
  var r = request(req.session.mp4_url)
  r.on('error', function (err) {
    console.log('error downloading media', err)
  })
  r.pipe(fs.createWriteStream(localFileName))
  .on('finish', function () {
    var oauth = {
      consumer_key: process.env.CONSUMER_KEY,
      consumer_secret: process.env.CONSUMER_SECRET,
      token: req.session.twitterAccessToken,
      token_secret: req.session.twitterAccessTokenSecret,
      verifier: req.session.twitterOauthVerifier
    }
    var up = require('./upload_twitter')
    up.upload(oauth, localFileName).then(function (result) {
      var postTwitter = require('./post_twitter')
      postTwitter.post(oauth, {
        'status': req.session.text,
        'media_ids': result
      }).then(function (result) {
        ui.alert(res, 'tweet posted', 'success')
      })
    }).catch(function (err) { console.log('error!', err) })
  })
}

app.get('/post-as-tweet', function (req, res) {
  req.session.goal = 'post-as-tweet'
  req.session.mp4_url = req.query.mp4_url
  req.session.tweet_id = req.query.tweet_id
  req.session.text = req.query.text
  console.log('\n\n\nposting as tweet', req.session)
  authorizeTwitter(req, res)
})

app.get('/authorized-twitter', function (req, res) {
  var requestToken = req.session.twitterRequestToken
  var requestTokenSecret = req.session.twitterRequestTokenSecret
  var oauth_verifier = req.session.twitterOauthVerifier = req.query.oauth_verifier
  req.query.twitterOauthToken = req.query.oauth_token

  tu.getAccessToken(
    requestToken, requestTokenSecret, oauth_verifier,
    function (err, accessToken, accessTokenSecret, results) {
      if (err) {
        console.log('\n\n\nerror getting access token', err)
      } else {
        req.session.twitterAccessToken = accessToken
        req.session.twitterAccessTokenSecret = accessTokenSecret
        tu.verifyCredentials(req.session.twitterAccessToken, req.session.twitterAccessTokenSecret, function (err, dat, response) {
          if (err) {
            console.log(err)
          }
          if (req.session.goal === 'post-as-tweet') {
            postAsTweet(req, res)
          }
        })
      }
    }
  )
})

// display something when '/' is requested
app.get('/', function (req, res) {
  req.redirect(process.env.CLIENT)
})

// email gifs using mandrill
app.post('/email', function (req, res) {
  mandrill_client.messages.sendTemplate({
    'template_name': 'share-gif',
    'template_content': [{}],
    'message': {
      'global_merge_vars': [
        {
          'name': 'from_name',
          'content': 'Gif Booth'
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
      'from_email': 'gifs@gifbooth.co',
      'from_name': 'Gif Booth',
      'to': [{
        'email': req.query.to_email,
        'name': req.query.to_name
      }]
    }
  }, function (result) {
    res.send('sent')
  }, function (err) {
    console.log('\n\n\nerror sending email:', err)
  })
})

// proxy initial timeline request
app.get('/tweets', function (req, res) {
  var send = function (data) { res.send(data) }
  var timelineParams = {key: req.url}
  cacheGet('tweets', getTimeline, timelineParams).then(send).catch(console.log)
})

app.get('/tweets/:maxID', function (req, res) {
  var send = function (data) { res.send(data) }
  var maxID = req.params.maxID
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
        console.log('\n\n\ncache fail', err)
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

  console.log('\n\n\nlistening at http://%s:%s', host, port)
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
  io.emit('tweet', tweet)

  // if testing, upload streamed tweets to s3 as gifs
  if (process.env.S3_TEST === 'true') {
    console.log('\n\n\nTESTING; gonna upload this one to s3')
    var https = require('https')
    var gifify = require('gifify')
    var aws = require('aws-sdk')
    var path = require('path')
    var fs = require('fs')

    // download the mp4 from twitter
    console.log('\n\n\nTESTING; gonna download the mp4 from twitter')
    https.get(tweet.extended_entities.media[0].video_info.variants[0].url, function (res, err) {
      if (err) {
        console.log('\n\n\nhttps get error', err)
      }
      var file = fs.createWriteStream('tmp/' + tweet.id_str + '.mp4')
      res.pipe(file)

      // convert the mp4 to a gif
      console.log('\n\n\nTESTING; gonna convert the mp4 to a gif')
      res.on('end', function () {
        var output = path.join(__dirname, 'tmp/' + tweet.id_str + '.gif')
        var gif = fs.createWriteStream(output)
        gifify('tmp/' + tweet.id_str + '.mp4', {}).pipe(gif).on('finish', function () {
          // read the converted gif
          console.log('\n\n\nTESTING; gonna read the converted gif')
          fs.readFile('tmp/' + tweet.id_str + '.gif', function (err, fileContents) {
            if (err) {
              console.log('\n\n\nerror reading file', file, err)
            } else {
              // and upload it to s3
              console.log('\n\n\nTESTING; gonna put it in a bucket')
              var params = {
                'Bucket': process.env.AWS_S3_BUCKET,
                'Key': tweet.id_str + '.gif',
                'Body': fileContents,
                'ACL': 'public-read'
              }
              new aws.S3().upload(params, function (err, data) {
                if (err) {
                  console.log('\n\n\nError uploading data:', err)
                } else {
                  console.log('\n\n\nSuccessfully uploaded data to myBucket/myKey')
                }
              })
            }
          })
        })
      })
    })
  }
})
