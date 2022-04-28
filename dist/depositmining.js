const game = require('./game');
const _ = game._;
const notify = require('./notify');
const { logging } = require('./logging');

class CreepDepositMiner extends Creep {
}

class DepositMiner {
  constructor () {
  }

  entry (room, task) {
    const ecfg = room.ecfg;

    notify.pull('deposit_spotted', meta => {
      // id
      // room_name
    });
  }
}

module.exports.DepositMiner = DepositMiner;
