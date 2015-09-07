var PostFacebook = function () {
  var fbgraph = require('fbgraph')

  var API = {}

  API.post = function (oauth, url) {
    return new Promise(function (resolve, reject) {
      var params = {
        link: url
      }
      fbgraph.post('/me/feed?access_token=' + oauth, params, function (err, res) {
        if (err) { reject(err) }
        resolve(res)
      })
    })
  }

  return API
}
module.exports = new PostFacebook()
