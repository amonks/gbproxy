var SendTwilio = function () {
  var twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  var API = {}

  API.sendMedia = function (to, url) {
    return new Promise(function (resolve, reject) {
      twilio.messages.create({
        to: to,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: process.env.TWILIO_TEXT_MESSAGE,
        mediaUrl: url
      }, function (err, message) {
        if (err) {
          reject(err)
        } else {
          resolve(message)
        }
      })
    })
  }

  return API
}
module.exports = new SendTwilio()
