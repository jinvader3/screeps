const game = require('./game');
const _ = game._;

class CreepGeneralWorker {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  get_mode () {
    let mode = this.creep.memory.m;
    if (mode === undefined || mode === null) {
      return 'p';
    }
    return mode;
  }

  set_mode (mode) {
    this.creep.memory.m = mode;
  }

  clear_target () {
    this.creep.memory.t = null;
  }

  set_target (trgt) {
    if (trgt === null) {
      this.creep.memory.t = null;
    } else {
      this.creep.memory.t = trgt.id;
    }
  }

  set_target_id (id) {
    this.creep.memory.t = id;
  }

  get_target () {
    if (this.creep.memory.t === null) {
      return null;
    }
    return game.getObjectById()(this.creep.memory.t);
  }

  count_work_parts () {
    let body = this.creep.body;
    return _.sumBy(body, part => part.type === game.WORK);
  }

  get (trgt, restype) {
    if (this.creep.store.getFreeCapacity(restype) === 0) {
      return false;
    }

    let res = this.creep.pickup(trgt);

    if (res === game.OK) {
      return true;
    }

    if (res === game.ERR_FULL) {
      return false;
    }

    if (res === game.ERR_INVALID_TARGET) {
      res = this.creep.harvest(trgt);
      if (res === game.OK) {
        return true;
      }
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return false;
    }
    
    if (res === game.ERR_INVALID_TARGET) {
      res = this.creep.withdraw(
        trgt, restype, this.creep.store.getFreeCapacity(restype)
      );
    }

    if (res === game.ERR_FULL || res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return false;
    }

    if (res == game.ERR_NOT_IN_RANGE) {
      let res2 = this.move_to(trgt);
      if (res2 === game.OK) {
        return res;
      }
      return res2;
    }
    return res;
  }

  put (trgt, restype) {
    if (this.creep.store.getUsedCapacity(restype) === 0) {
      return false;
    }

    let res;

    if (trgt.hits !== undefined && trgt.hits < trgt.hitsMax) {
      res = this.creep.repair(trgt);

      if (res === game.OK) {
        return true;
      }

      if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
        return false;
      }
    } else {
      res = game.ERR_INVALID_TARGET;
    }

    res = this.creep.upgradeController(trgt);

    if (res === game.OK) {
      return true;
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return false;
    }

    if (res === game.ERR_INVALID_TARGET) {
      res = this.creep.build(trgt);
      if (res === game.OK) {
        return true;
      }
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return false;
    }

    if (res === game.ERR_INVALID_TARGET) {
      let amount = this.creep.store.getUsedCapacity(restype);
      let most = trgt.store.getFreeCapacity(restype);
      res = this.creep.transfer(trgt, restype, Math.min(amount, most));
      if (res === game.OK) {
        return true;
      }
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return false;
    }

    if (res === game.ERR_FULL) {
      return false;
    }

    if (res == game.ERR_NOT_IN_RANGE) {
      let res2 = this.move_to(trgt);
      return true;
    }    

    return true;
  }

  move_to (trgt) {
    return this.creep.moveTo(trgt);
  }

  debug () {
    if (this.creep.memory.g !== true) {
      return;
    }

    let args = [];

    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }

    console.log.apply(console, args);
  }

  tick (dt_pull, dt_push, cdepth) {
    if (cdepth === undefined) {
      cdepth = 0;
    } else if (cdepth >= 4) {
      console.log('[problem] tick on creepgw call graph depth exceeded');
      return;
    }

    let trgt = this.get_target();
    let ecarry = this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY);
    if (!trgt) {
      if (ecarry === 0) {
        trgt = dt_pull();
        this.set_mode('pull');
      } else {
        trgt = dt_push();
        this.set_mode('push');
      }

      this.set_target(trgt);
    }

    if (trgt) {
      if (this.get_mode() === 'pull') {
        this.room.reg_get_intent(
          this,
          trgt,
          game.RESOURCE_ENERGY,
          this.creep.store.getFreeCapacity(game.RESOURCE_ENERGY)
        );
        if (this.get(trgt, game.RESOURCE_ENERGY) === false) {
          this.clear_target();
          this.tick(dt_pull, dt_push, cdepth + 1);
        }
      } else {
        this.room.reg_put_intent(
          this, 
          trgt, 
          game.RESOURCE_ENERGY,
          this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY)
        );
        if (this.put(trgt, game.RESOURCE_ENERGY) === false) {
          this.clear_target();
          this.tick(dt_pull, dt_push, cdepth + 1);
        }
      }
    }
  }
}

module.exports = {
  CreepGeneralWorker: CreepGeneralWorker,
};
