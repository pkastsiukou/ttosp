const express = require('express');
const bodyParser = require('body-parser');

const RedisService = require('./services/RedisService');

const port = process.env.PORT || 4000;
const app = express();
app.use(bodyParser.json({ extended: true }));


function getTSFromUserDate(time) {
  const messageTimeStamp = new Date(time).getTime();
  if (isNaN(messageTimeStamp) || messageTimeStamp === 0) {
    throw new Error('Incorrect input date');
  }
  if (messageTimeStamp < new Date().getTime() + 2000) {
    throw new Error('Message time should be future time');
  }

  return messageTimeStamp;
}

app.post('/echoAtTime', async function (req, res) {
  const { time, message } = req.body;
  let response = { success: false };

  try {
    const messageTimeStamp = getTSFromUserDate(time);
    RedisService.setMessage(message, messageTimeStamp);
    response = { success: true };
  } catch (e) {
    response.message = e.message;
  }

  return res.json(response);
});


app.listen(port, function() {
  console.log(`http server listening on ${port}`);
});
