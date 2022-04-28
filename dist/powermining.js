const game = require('./game');
const _ = game._;
const notify = require('./notify');
const { logging } = require('./logging');

class PowerMiner {
  constructor () {
  }

  entry (room, task) {
    const ecfg = room.ecfg;

    notify.pull('power_bank_spotted', meta => {
      // id
      // room_name 
    });
  }
}

module.exports.PowerMiner = PowerMiner;
