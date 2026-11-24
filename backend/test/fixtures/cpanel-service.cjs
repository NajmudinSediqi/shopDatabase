const http = require("node:http");
if (process.env.TEST_FAIL_SERVICE && process.env.TEST_FAIL_SERVICE === process.env.TEST_SERVICE)
  process.exit(2);
http
  .createServer((req, res) => {
    res.end(JSON.stringify({ service: process.env.TEST_SERVICE, path: req.url }));
  })
  .listen(Number(process.env.PORT), "127.0.0.1");
