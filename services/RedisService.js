const _ = require('lodash');
const Promise = require('bluebird');
const redis = require('../config/init.redis');
const redisSubscriber = redis.duplicate();

const messageSetName = 'message_set';
const messagesMapName = 'message_map';


/**
 * Get messages timestamps that should be printed already
 * @returns {Promise<Array|*>}
 */
async function getSetTimeStamps() {
  const setMembers = await redis.smembersAsync(messageSetName);
  const currentTS = new Date().getTime();
  return _.sortBy(_.filter(_.map(setMembers, _.parseInt), (val) => val <= currentTS), (v) => v);
}

/**
 * Get messages from map that should be printed already
 * @returns {Promise<Array>}
 */
async function getMapTimeStamps() {
  let mapKeys = await redis.hkeysAsync(messagesMapName);
  const currentTS = new Date().getTime();
  return _.sortBy(_.filter(_.map(mapKeys, _.parseInt), (val) => val <= currentTS), (v) => v);
}

/**
 * Vote between instaces and print message to console
 * @param messageTimeStamp
 * @param userMessage
 * @returns {Promise<void>}
 */
async function voteAndPrint(messageTimeStamp, userMessage) {
  const res = await redis.sremAsync(messageSetName, messageTimeStamp);
  const userTime = new Date(messageTimeStamp).toLocaleTimeString();
  const currentTime = new Date().toLocaleTimeString();
  if (res === 1) {
    console.log(`[${currentTime}] [${userTime}] ${userMessage}`);
    redis.hdel(messagesMapName, messageTimeStamp);
  }
}

/**
 * When key is deleted from set, but message was not, We restore SET data and repeat the cycle with vote and print message.
 * @returns {Promise<array>}
 */
async function restoreSetState() {
  const mapKeys = await getMapTimeStamps();
  let setMembers = await getSetTimeStamps();
  const setKeysToRestore = _.difference(mapKeys, setMembers);
  const restoredKeys = await Promise.map(setKeysToRestore, messageTimeStamp => redis.saddAsync(messageSetName, messageTimeStamp), { concurrency: 5 });
  if (_.size(restoredKeys) > 0) {
    // Some timestamps from set was restored, need to update SET data
    setMembers = await getSetTimeStamps();
  }

  return setMembers;
}

/**
 * Restore single record and print if not printed already
 * @param messageTimeStamp
 * @returns {Promise<*>}
 */
async function restoreOneRecord(messageTimeStamp) {
  const userMessage = await redis.hgetAsync(messagesMapName, messageTimeStamp);
  if (_.isString(userMessage)) {
    return voteAndPrint(messageTimeStamp, userMessage);
  }
  return redis.sremAsync(messageSetName, messageTimeStamp);
}

/**
 * @param {array} setData
 * @returns {Promise<*>}
 */
async function restoreDataOnFailure(setData = []) {
  let messageTimeStamp = null;
  let result = _.clone(setData);

  if (_.size(result) > 0) {
    messageTimeStamp = result.shift();
  } else {
    result = await restoreSetState();
    messageTimeStamp = _.size(result) > 0 ? _.head(result) : null;
  }

  if (!_.isNull(messageTimeStamp) && messageTimeStamp <= new Date().getTime()) {
    await restoreOneRecord(messageTimeStamp);
    return restoreDataOnFailure(result);
  }

  // if we do not have message time stamp, all messages are restore and printed, check another time for updated data
  await Promise.delay(1000);
  let setMembers = await getSetTimeStamps();
  if (_.size(setMembers) > 0) {
    return Promise.map(setMembers, restoreOneRecord);
  }
  return true;
}

/**
 * @param {string} pattern
 * @param {string} channel
 * @param {string} message
 * @returns {Promise<void>}
 */
async function printMessageFromSubscribe(pattern, channel, message) {
  if (_.includes(message, 'messages_expire_soon:')) {
    const splitData = message.split(':');
    const messageTimeStamp = _.parseInt(splitData[1]);

    const userMessage = await redis.hgetAsync(messagesMapName, messageTimeStamp);
    const executeTimeout = messageTimeStamp - new Date().getTime();

    if (userMessage) {
      setTimeout(() => {
        return voteAndPrint(messageTimeStamp, userMessage);
      }, executeTimeout);
    } else {
      await redis.sremAsync(messageSetName, messageTimeStamp);
    }
  }
}

/**
 * @param {string} userMessage
 * @param {number} timestamp
 * @returns {boolean}
 */
function setMessage(userMessage, timestamp) {
  redis.hset(messagesMapName, timestamp, userMessage);
  redis.sadd(messageSetName, timestamp);

  const expKeyName = `messages_expire_soon:${timestamp}`;
  const expTime = _.parseInt((timestamp - new Date().getTime()) / 1000);
  if (expTime > 0) {
    redis.set(expKeyName, userMessage, 'EX', expTime);
  }
  return true;
}


redisSubscriber.config("SET", "notify-keyspace-events", "Ex");
redisSubscriber.psubscribe('__key*__:*');
redisSubscriber.on('pmessage', printMessageFromSubscribe);
redisSubscriber.on('psubscribe', () => {
  restoreDataOnFailure().then(() => {
    // console.log('Restore data complete');
  });
});


const RedisService = {
  setMessage,
};

module.exports = RedisService;
