const game = require('./game');
const { Creep } = require('./creep');
const _ = game._;
const { logging } = require('./logging');

class StateMachineCreep extends Creep {
  constructor (room, creep) {
    super(room, creep);
    const cm = this.creep.memory;
    // The memory persistent state stack.
    cm.ss_ids = cm.ss_ids || {};
    cm.ss = cm.ss || [];

    this.dump_logging_info();
  }

  dump_logging_info () {
    const cm = this.creep.memory;
    logging.debug(`I have ${cm.ss.length} states on my stack.`);
    logging.debug(`I have ${Object.keys(cm.ss_ids).length} unique IDS on my stack.`);

    for (let id in cm.ss_ids) {
      logging.debug(`ID:${id}`);
    }

    for (let e of cm.ss) {
      logging.debug(`entry fname:${e[0]} params:${e[1]} uid:${e[2]}`);
    }
  }

  execute_stack_single () {
    logging.debug('execute_stack_single()');
    const cm = this.creep.memory;
    
    if (cm.ss.length === 0) {
      logging.debug('There are no states to execute.');
      return false;
    }

    let fentry = cm.ss[0];
    let fname = fentry[0];
    let fparams = fentry[1];
    let uid = fentry[2];

    logging.debug(`fentry ${fentry}`);

    if (fname === null || this[fname](fparams)) {
      logging.debug('function return was true');
      // If the function returns true then it means that the state has
      // been completed and it can be removed.
      cm.ss = cm.ss.splice(1);
      if (uid) {
        logging.debug(`popping uid ${uid}`);
        delete cm.ss_ids[uid];
      }
      return true;
    } else {
      logging.debug('function return was false [pending stack pop]');
    }
  
    return false;
  }

  execute_stack () {
    logging.debug('execute_stack()');
    // As long as states are being popped on each
    // call then continue to make the call.
    while (this.execute_stack_single()) {
      // no-op
      logging.debug('execute_stack repeat');
    }
  }

  stmhf_dump_store_to_object (params) {
    const stor = game.getObjectById()(params.id);

    if (!stor) {
      // A storage does not exist in the room.
      return true;
    }

    let rtypes = Object.keys(this.creep.store);
    
    if (rtypes.length === 0) {
      logging.debug('There is nothing left to transfer.');
      // There is nothing left to transfer.
      return true;
    }

    if (this.creep.pos.isNearTo(stor)) {
      let rtype = rtypes[0];
      
      let res = this.creep.transfer(
        stor, rtype, this.creep.store.getUsedCapacity(rtype)
      );
      
      if (res !== game.OK) {
        // There is a problem. Just abort.
        return true;
      }
    } else {
      // We must move closer to the storage.
      this.move_to(stor);
    }
  }

  stmh_dump_store_to_object (ss, obj) {
    ss.push(['stmhf_dump_store_to_object', { id: obj.id || obj }, null]);
  }

  stmhf_load_resource_from_store (params) {
    const stor = game.getObjectById()(params.id);

    if (!stor) {
      // A storage does not exist in the room.
      return true;
    }

    if (this.creep.pos.isNearTo(stor)) {
      let rtype = params.rtype;
      let creep_free = this.creep.store.getFreeCapacity(rtype);
      let stor_used = stor.store.getUsedCapacity(rtype);
      let amount = Math.min(creep_free, stor_used);
      if (amount <= 0) {
        return true;
      }
      this.creep.withdraw(stor, rtype, amount);
    } else {
      // We must move closer to the storage.
      this.move_to(stor);
    }
  }

  stmh_load_resource_from_store (ss, obj, rtype) {
    ss.push(['stmhf_load_resource_from_store', { 
      id: obj.id || obj,
      rtype: rtype,
    }]);
  }

  stmhf_load_all_from_store (params) {
    const stor = game.getObjectById()(params.id);

    if (!stor) {
      // A storage does not exist in the room.
      return true;
    }

    if (this.creep.pos.isNearTo(stor)) {
      let rtypes = Object.keys(stor.store);
      if (rtypes.length === 0) {
        // There is nothing left to transfer.
        return true;
      }
      let rtype = rtypes[0];
      let creep_free = this.creep.store.getFreeCapacity(rtype);
      let stor_used = stor.store.getUsedCapacity(rtype);
      let amount = Math.min(creep_free, stor_used);
      if (amount <= 0) {
        // There is no more room on creep or no more resource in stor object.
        return true;
      }
      this.creep.withdraw(stor, rtype, amount);
    } else {
      // We must move closer to the storage.
      this.move_to(stor);
    }
  }
  
  stmh_load_all_from_store (ss, obj) {
    ss.push(['stmhf_load_all_from_store', { id: obj.id || obj }]);
  }

  stmh_set (uid, f) {
    const cm = this.creep.memory;

    if (cm.ss_ids[uid] !== undefined) {
      return;
    }

    const ss = [];
    
    if (f(ss)) {
      // If the function completed and the return value is true then
      // commit any state pushes of this set to the memory persistent
      // stack.
      _.each(ss, sse => cm.ss.push(sse));
      cm.ss.push([null, null, uid]);
      cm.ss_ids[uid] = true;
    }
  }

  move_to (trgt) {
    return this.creep.moveTo(trgt, {
      visualizePathStyle: {
        fill: 'transparent',
        stroke: '#99ff99',
        lineStyle: 'dashed',
        strokeWidth: .15,
        opacity: .7,
      },
    });
  }

  tick () {
    super.tick();
    this.execute_stack();
  }
}

module.exports.StateMachineCreep = StateMachineCreep;

