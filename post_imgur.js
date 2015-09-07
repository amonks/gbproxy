var PostImgur = function () {
  var imgur = require('imgur')
  imgur.setClientId(process.env.IMGUR_KEY)

  var API = {}

  API.post = function (url) {
    return new Promise(function (resolve, reject) {// Include http(s) when specifying URLs
      imgur.uploadUrl(url)
      .then(function (json) {
        console.log('posted to imgur', json)
        resolve(json.data.link)
      })
      .catch(function (err) {
        reject(err.message)
      })
    })
  }

  return API
}
module.exports = new PostImgur()
