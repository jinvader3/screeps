const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

class CreepGeneralWorker extends Creep {
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
    this.creep.memory.t = {
        id: trgt.trgt ? trgt.trgt.id : null,
        opts: trgt.opts,
    };
  }

  set_target_id (id) {
    this.creep.memory.t = id;
  }

  get_target () {
    let t = this.creep.memory.t;

    if (typeof t !== 'object') {
        return {
            trgt: null,
            opts: false,
        };
    }

    let trgt_obj = null;
    
    if (t && t.id) {
        trgt_obj = game.getObjectById()(t.id);
    }

    return {
        trgt: trgt_obj,
        opts: t ? t.opts : false,
    };
  }

  count_work_parts () {
    let body = this.creep.body;
    return _.sumBy(body, part => part.type === game.WORK);
  }

  get (trgt, restype) {
    if (this.creep.store.getFreeCapacity(restype) === 0) {
      return { done: false, oneshot: true };
    }

    let res = this.creep.pickup(trgt);

    if (res === game.OK) {
      return { done: true, oneshot: true };
    }

    if (res === game.ERR_FULL) {
      return { done: false, oneshot: true };
    }

    if (res === game.ERR_INVALID_TARGET) {
      res = this.creep.harvest(trgt);
      if (res === game.OK) {
        return { done: true, oneshot: true };
      }
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return { done: false, oneshot: true };
    }
    
    if (res === game.ERR_INVALID_TARGET || res === game.ERR_NO_BODYPART) {
      let creep_cap = this.creep.store.getFreeCapacity(restype);
      let trgt_cap = trgt.store.getUsedCapacity(restype);
      res = this.creep.withdraw(
        trgt, restype, Math.min(creep_cap, trgt_cap)
      );
    }

    if (res === game.ERR_FULL || res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return { done: false, oneshot: true };
    }

    if (res == game.ERR_NOT_IN_RANGE) {
      let res2 = this.move_to(trgt);
      return { done: true, oneshot: false };
    }

    return { done: true, oneshot: true };
  }

  put (trgt, restype) {
    if (!trgt) {
      return { done: false, oneshot: true };
    }

    if (this.creep.store.getUsedCapacity(restype) === 0) {
      return { done: false, oneshot: true };
    }

    let res;

    if (trgt.hits !== undefined && trgt.hits < trgt.hitsMax) {
      res = this.creep.repair(trgt);

      if (res === game.OK) {
        return { done: true, oneshot: true };
      }

      if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
        return { done: false, oneshot: true };
      }
    } else {
      res = game.ERR_INVALID_TARGET;
    }

    res = this.creep.upgradeController(trgt);

    if (res === game.OK) {
      return { done: true, oneshot: true };
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return { done: false, oneshot: true };
    }

    if (res === game.ERR_INVALID_TARGET || res === game.ERR_NO_BODYPART) {
      res = this.creep.build(trgt);
      if (res === game.OK) {
        return { done: true, oneshot: true };
      }
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return { done: false, oneshot: true };
    }

    if (trgt.store && (res === game.ERR_INVALID_TARGET || res === game.ERR_NO_BODYPART)) {
      let amount = this.creep.store.getUsedCapacity(restype);
      let most = trgt.store.getFreeCapacity(restype);
      res = this.creep.transfer(trgt, restype, Math.min(amount, most));
      if (res === game.OK) {
        return { done: true, oneshot: true };
      }
    }

    if (res === game.ERR_INVALID_TARGET) {
      return { done: false, oneshot: true };
    }

    if (res === game.ERR_NOT_ENOUGH_RESOURCES) {
      return { done: false, oneshot: true };
    }

    if (res === game.ERR_FULL) {
      return { done: false, oneshot: true };
    }

    if (res == game.ERR_NOT_IN_RANGE) {
      let res2 = this.move_to(trgt);
      return { done: true, oneshot: false };
    } 

    return { done: true, oneshot: true };
  }

  move_to (trgt) {
    return this.creep.moveTo(trgt, {
      maxRooms: 1,
      costCallback: (room_name, cm) => {
        if (this.room.get_name() === room_name) {
          return this.room.scm;
        }
      
        return null;
      },
      visualizePathStyle: {
        fill: 'transparent',
        stroke: '#ff9999',
        lineStyle: 'dashed',
        strokeWidth: .15,
        opacity: .7,
      },
    });
  }

  tick (dt_pull, dt_push, cdepth) {
    if (cdepth === undefined) {
      cdepth = 0;
    } else if (cdepth >= 4) {
      logging.warn('[problem] tick on creepgw call graph depth exceeded');
      return;
    }

    let trgt = this.get_target();

    let ecarry = this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY);
    let efree = this.creep.store.getFreeCapacity(game.RESOURCE_ENERGY);

    logging.debug(`trgt:${trgt}`);
    logging.debug(`ecarry:${ecarry} efree:${efree}`);

    if (!trgt.trgt) {
      let a = this.get_mode() === 'pull' && efree > 0;
      let b = ecarry === 0;

      logging.debug(`a:${a} b:${b}`);

      if (a || b) {
        trgt = dt_pull();
        this.set_mode('pull');
        logging.info(this.creep.memory.g, 'pull', trgt.trgt, trgt.opts);
        if (!trgt.trgt) {
            return null;
        }
      } else {
        trgt = dt_push();
        this.set_mode('push');
        logging.info(this.creep.memory.g, 'push', trgt.trgt, trgt.opts);
        if (!trgt.trgt) {
            return null;
        }
      }

      this.set_target(trgt);
    }

    let res;

    if (trgt.trgt) {
      if (this.get_mode() === 'pull') {
        this.room.reg_get_intent(
          this,
          trgt.trgt,
          game.RESOURCE_ENERGY,
          this.creep.store.getFreeCapacity(game.RESOURCE_ENERGY)
        );

        res = this.get(trgt.trgt, game.RESOURCE_ENERGY);

        let oneshot = trgt.opts && trgt.opts.oneshot && (res.oneshot === true);
        
        if (res.done === false || oneshot) {
          this.clear_target();
          this.tick(dt_pull, dt_push, cdepth + 1);
        }
      } else {
        this.room.reg_put_intent(
          this, 
          trgt.trgt, 
          game.RESOURCE_ENERGY,
          this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY)
        );
        res = this.put(trgt.trgt, game.RESOURCE_ENERGY);
        
        let oneshot = trgt.opts && trgt.opts.oneshot && (res.oneshot === true);
        
        if (res.done === false || oneshot) {
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
