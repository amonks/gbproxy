# gifbooth proxy

This is the gifbooth proxy server.

When this repository is pushed to, it automatically builds and deploys to [heroku](gifbooth-proxy.herokuapp.com). That build process usually takes about 4 seconds.

## running locally

To run this app locally, you need npm and node. Once you have them, run `npm install` and `npm start` to start the server. You may need to set `$PORT` to something other than 80.

## env

The following environment variables need to be set:

    CONSUMER_KEY=A_BUNCH_OF_LETTERS
    CONSUMER_SECRET=A_SECRET_BUNCH_OF_LETTERS
    TOKEN=A_BUNCH_OF_NUMBERS
    TOKEN_SECRET=A_SECRET_BUNCH_OF_NUMBERS
    USER_ID=123456789
    HASHTAG=gifHashtag
    CLIENT=http://example.com

On Heroku, set them up as 'Config Vars'. Locally, create a file called `.env` and paste the above text into it, filling in the twitter API info.
