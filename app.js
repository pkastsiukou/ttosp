const express = require('express');
const bodyParser = require('body-parser');

const RedisService = require('./services/RedisService');

const port = process.env.PORT || 4000;
const app = express();
app.use(bodyParser.json({ extended: true }));


app.post('/echoAtTime', async function (req, res) {
  const { time, message } = req.body;
  let response = { success: false };
  try {
    RedisService.setMessage(message, time);
    response = { success: true }
  } catch (e) {
    response.message = e.message;
  }
  return res.json(response);
});


app.listen(port, function() {
  console.log(`http server listening on ${port}`);
});
