const { Creep } = require('./creep');
const game = require('./game');
const { logging } = require('./logging');
const _ = game._;

class RoomNumber {
  constructor (room_name) {
    const cd0 = room_name[0];
    const p0 = room_name.indexOf('N');
    const p1 = room_name.indexOf('S');
    const p = p0 > p1 ? p0 : p1;
    const cd1 = room_name[p];
    const rn0 = parseInt(room_name.substring(1, p));
    const rn1 = parseInt(room_name.substr(p + 1));

    if (cd0 === 'W') {
      // This value is normally -N to 0. Now, it will
      // be -N to -1.
      this.x = rn0 - 1
    } else {
      // This value is normally 0 to N and will stay 
      // the same.
      this.x = rn0;
    }

    if (cd1 === 'N') {
      this.y = rn1 - 1;
    } else {
      this.y = rn1;
    }
  }

  get_name () {
    let p0, p1;

    if (this.x < 0) {
      p0 = 'W' + new String(-(this.x + 1)); 
    } else {
      p0 = 'E' + new String(this.x);
    }

    if (this.y < 0) {
      p1 = 'N' + new String(-(this.y + 1));
    } else {
      p1 = 'S' + new String(this.y);
    }

    return p0 + p1;
  }

  add (x, y) {
    this.x += x;
    this.y += y;
    return this;
  }
}

class CreepScout extends Creep {
  tick () {
    Memory.scout_report = Memory.scout_report || {};
    const scout_report = Memory.scout_report;

    const creep = this.creep;
    const cur_room = creep.room;
    
    if (creep.hits < creep.hitsMax) {
      // If we are damaged then just suicide. The creep
      // should get rebuilt.
      creep.suicide();
      return;
    }

    let gen_report = false;
    let report = scout_report[cur_room.name];

    if (report === undefined) {
      gen_report = true;
    } else {
      if (game.time() - report.tick > 100) {
        gen_report = true;
      }
    }

    if (gen_report === true) {
      scout_report[cur_room.name] = {
        tick: game.time(),
      };

      report = scout_report[cur_room.name];

      // Take note of the controller owner.
      report.username = cur_room.controller ? cur_room.controller.owner.username : null;
      // Take note of any power spawns.
      const deposits = cur_room.find(game.FIND_DEPOSITS);

      report.deposit = _.map(deposits, d => { return {
        last_cool_down: d.lastCooldown,
        ticks_to_decay: d.ticksToDecay,
        deposit_type: d.depositType,
        cooldown: d.cooldown,
        id: d.id,
      };});

      const power_bank = _.find(cur_room.find(game.FIND_STRUCTURES), e => e.structureType === game.STRUCTURE_POWER_BANK);
      if (power_bank !== undefined) {
        report.power_bank = {
          id: power_bank.id,
          power: power_bank.power,
          ticks_to_decay: power_bank.ticks_to_decay,
          hits: power_bank.hits,
          hits_max: power_bank.hitsMax,
        };
      } else {
        report.power_bank = null;
      }
    }
    

    if (cur_room.name !== creep.memory.exit_rn) {
      delete creep.memory.exit_rn;
      delete creep.memory.exit_dir;
    }

    // Pick random exit.
    if (!creep.memory.exit_dir) {
      const room_name = creep.pos.roomName;
      const rn = new RoomNumber(room_name);
      const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const move = moves[Math.floor(Math.random() * moves.length)];
      logging.info('move', move);
      const new_rn = rn.add(move[0], move[1]).get_name();
      const exit_dir = cur_room.findExitTo(new_rn);
      creep.memory.exit_dir = exit_dir;
      creep.memory.exit_rn = room_name;
    }
 
    const exit = creep.pos.findClosestByRange(creep.memory.exit_dir);
    creep.moveTo(exit, { reusePath: 1000 });
  }
}

module.exports = {
  CreepScout: CreepScout,
}
