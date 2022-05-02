/*
  This implements a notification bus. One can register for notification, push
  notifications, or both.

  One usage of this module is that the scout code can push notification about 
  certain things it observes then another module can listen for these 
  notifications.

  There are a few cavets about this module:

    - notifcations can as late as the next tick
      - this was done because its easier to implement and still keep code running
        under its own task
      - if you really need notifcations on the same tick then create a sub-task
        and set its priority so it runs last and then pull events
    - notifications are kept in memory so resets don't cause them to become lost
    - prefix topic with room name to make topics only for a specific room
      - for example: E3S4:exampletopic 
    - make sure meta contents are JSON serializable and inter-tick safe
      - object references are likely not valid across ticks
      - events are stored in Memory
*/
const game = require('./game');
const { logging } = require('./logging');
const _ = game._;

module.exports = {
  pull: (topic, cb) => {
    Memory.evts = Memory.evts || [];
    const evts = Memory.evts;
    const ctime = game.time();

    for (let x = 0; x < evts.length; ++x) {
      const evt = evts[evts.length - 1];

      let ret = false;

      // Events are valid only for one tick and it must
      // be the next tick. This keeps them from bubbling
      // up more than once and makes sure everyone who
      // listens will hear the event happen.
      if (ctime - evt.time === 1) {
        if (evt.topic === topic) {
          try {
            ret = cb(evt.meta, evt.topic);
          } catch (err) {
            logging.log(`[error-event-cb] ${err}`);
            logging.log(`${err.stack}`); 
          }
        }
      } else {
        if (evt.time === undefined || ctime - evt.time > 1) {
          ret = true;
        }
      }

      evts.pop();

      if (ret !== true) {
        // By returning true we drop the event from future inspection.
        evts.unshift(evt);
      }
    }
  },
  push: (topic, meta) => {
    Memory.evts = Memory.evts || [];
    const evts = Memory.evts;
    // Do this so we can process the events while we are
    // pushing new events and simultanously making it safe
    // not to lose any events if anything errors out badly.
    logging.wrapper('notify-push', () => logging.info(`${topic} ${JSON.stringify(meta)}`));
    evts.unshift({ topic: topic, time: game.time(), meta: meta });
  },
};
