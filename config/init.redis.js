const redis = require('redis');
const Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const { host, port, db } = require('./settings').redis;

/**
 * @param {string} host
 * @param {number} port
 * @param {number} db
 * @returns {Promise.<redis.RedisClient.prototype>}
 */
function initRedis(host = '127.0.0.1', port = 6379, db = 0) {
  return redis.createClient({
    host,
    port,
    db,
    retry_strategy: function (options) {
      console.log(`${new Date().toISOString()} [initRedis] reconnect`);
      if (options.error && options.error.code === 'ECONNREFUSED') {
        return new Error(`${new Date().toISOString()} [initRedis] The server refused the connection`);
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        return new Error(`${new Date().toISOString()} [initRedis] Retry time exhausted`);
      }
      if (options.attempt > 100) {
        return undefined;
      }
      return 5 * 1000;
    }
  });
}

const client = initRedis(host, port, db);


module.exports = client;
