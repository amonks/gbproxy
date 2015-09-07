var PostTwitter = function () {
  var request = require('request')

  var API = {}

  API.post = function (oauth, params) {
    return new Promise(function (resolve, reject) {
      request.post(
        {
          url: 'https://api.twitter.com/1.1/statuses/update.json',
          oauth: oauth,
          form: params
        },
        function (err, r, body) {
          if (err) {
            reject(err)
          } else {
            resolve(body)
          }
        }
      )
    })
  }

  return API
}
module.exports = new PostTwitter()
