var ProxyTwitter = function () {
  var gif_queue = require('./gif_queue')

  // create twitter object
  var Twitter = require('twit')
  var t = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_TOKEN,
    access_token_secret: process.env.TWITTER_TOKEN_SECRET
  })

  // cache
  var cache = require('./cache')

  var API = {}

  // load a stream of the user's tweets
  API.stream = function (server) {
    var io = require('socket.io')(server)
    t.stream(
      'statuses/filter',
      {
        follow: process.env.USER_ID
      }
    ).on('tweet', function (tweet) {
      console.log('\n\ngot streaming tweet', tweet.id_str)
      if (!process.env.HASHTAG || tweetHasHashtag(tweet, process.env.HASHTAG)) {
        gif_queue.add(tweet, function () {
          cache.del('tweets')
          io.emit('tweet', tweet)
          console.log('\n\nresolved!')
        })
        if (process.env.S3_TEST === 'true') {
          var s3backup = require('./s3_backup')
          s3backup.do(tweet)
        }
      }
    })
  }

  API.getTweet = function (id) {
    return new Promise(function (resolve, reject) {
      cache.get('tweet/' + id).then(resolve)
      .catch(function () {
        t.get(
          'statuses/show',
          {id: id},
          function (err, data, response) {
            if (err) {
              reject(err)
            } else {
              cache.save('tweet/' + id, data)
              resolve(data)
            }
          }
        )
      })
    })
  }

  API.getTimeline = function (max_id) {
    return new Promise(function (resolve, reject) {
      var key = 'tweets'
      if (max_id) {
        key = 'tweets/' + max_id
      }

      cache.get(key)
      .then(resolve)
      .catch(function () {
        var requestParams = {
          user_id: process.env.USER_ID,
          exclude_replies: true,
          include_rts: false,
          trim_user: true
        }
        if (typeof max_id !== 'undefined') {
          requestParams.max_id = max_id
        }
        t.get(
          'statuses/user_timeline',
          requestParams,
          function (err, data, response) {
            if (err) {
              reject(err)
            } else {
              cache.save(key, data)
              // send it off
              if (process.env.HASHTAG) {
                data = filterTweets(data, process.env.HASHTAG)
              }
              resolve(data)
            }
          }
        )
      })
    })
  }

  var tweetHasHashtag = function (tweet, hashtag) {
    for (var h of tweet.entities.hashtags) {
      if (h.text === hashtag) {
        return true
      } else {
        return false
      }
    }
  }

  var filterTweets = function (tweets, hashtag) {
    var out = []
    for (var tweet of tweets) {
      if (tweetHasHashtag(tweet, hashtag)) {
        out.push(tweet)
      }
    }
    return out
  }

  return API
}
module.exports = new ProxyTwitter()
