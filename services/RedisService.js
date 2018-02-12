const redis = require('../config/init.redis');
const redisSubscriber = redis.duplicate();

/**
 * @param {string} pattern
 * @param {string} channel
 * @param {string} message
 * @returns {Promise<void>}
 */
async function printMessageFromSubscribe(pattern, channel, message) {
  if (message.indexOf('messages_expire_soon:') !== -1) {
    const splitData = message.split(':');
    const messageTimeStamp = parseInt(splitData[1]);

    const userMessage = await redis.getAsync(`messages_data:${messageTimeStamp}`);
    if (userMessage) {
      setTimeout(async () => {
        const res = await redis.sremAsync('messages', messageTimeStamp);
        const userTime = new Date(messageTimeStamp).toLocaleTimeString();
        const currentTime = new Date().toLocaleTimeString();
        if (res === 1) {
          console.log(`[${currentTime}] [${userTime}] ${userMessage}`);
          redis.del(`messages_data:${messageTimeStamp}`);
        }
      }, messageTimeStamp - new Date().getTime());
    }
  }
}

/**
 * @param {string} userMessage
 * @param {date} time
 * @returns {boolean}
 */
function setMessage(userMessage, time) {
  const messageTimeStamp = new Date(time).getTime();
  const expTime = parseInt((messageTimeStamp - new Date().getTime()) / 1000);
  const expNotificationTime = expTime - 2;
  if (expTime <= 0) {
    throw new Error('Message time already passed');
  }
  if (expNotificationTime <= 0) {
    throw new Error('Message time is too close to present time. Should be more than 2 seconds to future.');
  }

  redis.sadd(`messages`, messageTimeStamp);
  redis.set(`messages_data:${messageTimeStamp}`, userMessage);
  redis.set(`messages_expire_soon:${messageTimeStamp}`, userMessage, 'EX', expNotificationTime);
  return true;
}


redisSubscriber.config("SET", "notify-keyspace-events", "Ex");
redisSubscriber.psubscribe('__key*__:*');
redisSubscriber.on('pmessage', printMessageFromSubscribe);

const RedisService = {
  setMessage,
};

module.exports = RedisService;
