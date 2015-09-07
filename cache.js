module.exports = function (url) {

  // redis cache
  var redis = require('redis').createClient(url)
  redis.on('error', function (err) {
    console.log('\n\n\nRedis Error ' + err)
  })

  var API = {}

  API.get = function (key, params) {
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
          reject('not cached')
        }
      })
    })
  }

  API.save = function (key, data) {
    redis.set(key, JSON.stringify(data))
    redis.expire(key, parseInt(process.env.REDIS_EXPIRE, 10) || 10)
  }

  return API
}
