const game = require('./game');
const _ = game._;
const notify = require('./notify');
const { logging } = require('./logging');
const { Creep } = require('./creep');

class CreepDepositMiner extends Creep {
  tick () {
    logging.wrapper('depositminer', () => this.inner_tick());
  }

  inner_tick () {
    const cm = this.creep.memory;
    const rm = this.room.room.memory;
    const dm = rm.depositmem || {};

    logging.debug('tick');

    if (Object.keys(this.creep.store).length > 0) {
      logging.debug('going to terminal/storage');
      const cont = this.room.room.terminal || this.room.room.storage;
      if (this.creep.transfer(cont, Object.keys(this.creep.store)[0]) === game.ERR_NOT_IN_RANGE) {
        this.creep.moveTo(cont, {
          reusePath: 1000,
        });
      }
      return;
    }

    if (!cm.target) {
      logging.debug('picking target');
      const meta = _.sample(_.filter(dm, entry => {
        if (entry.used === true) {
          return false;
        }

        if (!entry.room_name) {
          return false;
        }

        const delta = game.time() - entry.seen;
        const cur_cooldown = entry.cooldown - delta;

        if (cur_cooldown > 0) {
          return false;
        } 

        return true;
      }));

      if (meta) {
        cm.target = meta.id;
        cm.meta = meta;
      }
    }

    if (!cm.target) {
      return;
    }

    const cur_room = this.creep.pos.roomName;

    if (!cm.meta.room_name) {
      delete cm.target;
      delete cm.meta;
      return;
    }

    ///
    if (cur_room !== cm.meta.room_name) {
      logging.debug('moving to room', cm.meta.room_name);
      this.creep.moveTo(new RoomPosition(25, 25, cm.meta.room_name), {
        reusePath: 1000,
      });
      return;
    }
    ///
    let obj = game.getObjectById()(cm.target);
    
    if (!obj || obj.cooldown > 0) {
      if (obj) {
        dm[cm.target].seen = game.time();
        dm[cm.target].cooldown = obj.cooldown;
      } else {
        delete dm[cm.target];
      }

      delete cm.target;
      delete cm.meta;
      return;
    } 

    if (this.creep.harvest(obj) == game.ERR_NOT_IN_RANGE) {
      this.creep.moveTo(obj);
    }
    ///
  }
}

class DepositMiner {
  constructor () {
  }

  entry (room, task) {
    const ecfg = room.ecfg;

    if (!ecfg.depositmining) {
      return;
    }

    const creeps = room.creeps_by_group['depositmining'] || [];
    const rm = room.memory;
    rm.depositmem = rm.depositmem || {};
    const dm = rm.depositmem;

    function *body_bf() {
      let body = [];
      body.push(game.MOVE);
      body.push(game.CARRY);
      while (true) {
        body.push(game.MOVE);
        body.push(game.WORK);
        yield body;
      }
    } 

    logging.debug('ticking');

    room.spawnman.reg_build2({
      clazz: 'depositminer',
      group: 'depositmining',
      build_gf: body_bf,
      max_level: 40,
      priority: -90,
      count: 2,
      memory: {},
      post_ticks: 0,
    });

    _.each(dm, entry => entry.used = false);
    _.each(creeps, creep => {
      const cm = creep.creep.memory;
      const target = cm.target;
      if (dm[target]) {
        dm[target].used = true; 
      }
    });

    notify.pull('deposit_spotted', meta => {
      // meta.id, meta.room_name
      // track all deposits
      dm[meta.id] = dm[meta.id] || {
        id: meta.id,
      };

      dm[meta.id].seen = meta.seen;
      dm[meta.id].cooldown = meta.cooldown;
      dm[meta.id].room_name = meta.room_name;
    });
  }
}

module.exports.DepositMiner = DepositMiner;
module.exports.CreepDepositMiner = CreepDepositMiner;
