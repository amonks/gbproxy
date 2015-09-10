var ProxyTwitter = function () {
  // create twitter object
  var Twitter = require('twit')
  var t = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_TOKEN,
    access_token_secret: process.env.TWITTER_TOKEN_SECRET
  })

  // cache
  var Cache = require('./cache')
  var cache = new Cache(process.env.REDIS_URL)

  var API = {}

  // load a stream of the user's tweets
  API.stream = t.stream(
    'statuses/filter',
    {
      follow: process.env.USER_ID
    }
  )

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
              resolve(data)
            }
          }
        )
      })
    })
  }

  return API
}
module.exports = new ProxyTwitter()
