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
  }

  execute_stack_single () {
    let fentry = cm.ss[0];
    let fname = fentry[0];
    let fparams = fentry[1];

    if (this[fname](fparams)) {
      // If the function returns true then it means that the state has
      // been completed and it can be removed.
      cm.ss.pop(0);
      return true;
    }
  
    return false;
  }

  execute_stack () {
    // As long as states are being popped on each
    // call then continue to make the call.
    while (this.execute_stack_single()) {
      // no-op
    }
  }

  push_state (uid, params, fname) {
    const cm = this.creep.memory;
    cm.ss.push([fname, params]);
  }

  stmhf_dump_store_to_object (params) {
    const stor = game.getObjectById()(params.id);

    if (!stor) {
      // A storage does not exist in the room.
      return true;
    }

    if (this.creep.pos.isNearTo(stor)) {
      let rtypes = Object.keys(this.creep.store);
      if (rtypes.length === 0) {
        // There is nothing left to transfer.
        return true;
      }
      let rtype = rtypes[0];
      this.creep.transfer(stor, rtype, this.creep.store.getUsedCapacity(rtype));
    } else {
      // We must move closer to the storage.
      this.creep.moveTo(stor);
    }
  }

  stmh_dump_store_to_object (ss, obj) {
    ss.push(['stmhf_dump_store_to_room_storage', { id: obj.id || obj }]);
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
      this.creep.moveTo(stor);
    }
  }
  
  stmh_load_all_from_store (ss, obj) {
    ss.push(['stmhf_load_all_from_store', { id: obj.id || obj }]);
  }

  stmh_set (uid, f) {
    if (this.ss_ids[uid] !== undefined) {
      return;
    }

    const ss = [];
    
    if (f(ss)) {
      // If the function completed and the return value is true then
      // commit any state pushes of this set to the memory persistent
      // stack.
      _.each(ss, sse => cm.ss.push(sse));
    }
  }

  tick () {
    super.tick();
    this.execute_stack();
  }
}

module.exports.StateMachineCreep = StateMachineCreep;

