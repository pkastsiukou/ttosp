const request = require('request-promise');

(async function () {
  let i = 0;
  do {
    const time = new Date(new Date().getTime() + 2000 + i * 1000).toISOString();
    const message = `Hello ${i}`;
    const options = {
      method: 'POST',
      uri: 'http://localhost:4000/echoAtTime',
      body: { time, message },
      json: true,
    };
    await request(options);
    i++;
  } while (i < 100);

  process.exit();
})();