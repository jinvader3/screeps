const game = require('./game');
const _ = game._;

module.exports.register = function () {
  Memory.ecfg = Memory.ecfg || {};
  const ecfg = Memory.ecfg;

  Game.help = () => {
    const lines = ['Help'];

    _.each(Game, (v, k) => {
      if (v.help === undefined) {
        return;
      }

      const desc = v.help.desc;

      lines.push(`<div>[${k}] ${desc}</div>`);
      
      _.each(v.help.params, param => {
        lines.push(`<div style="padding-left: 5px;">${param[0]}:${param[1]} - ${param[2]}</div>`);
      });
    });

    lines.push('<div>End of Help</div>');
  
    return lines.join('');
  };

  Game.show_cpuavg = () => {
    let sum = 0;

    for (let x = 0; x < Memory.cpuhis.length; ++x) {
      sum += Memory.cpuhis[x];
    }

    const avg = sum / Memory.cpuhis.length;
  
    return `The average historical CPU usage is ${avg}.`;
  };

  Game.show_intentions = () => {
    const lines = [];

    _.each(game.rooms(), (g_room, name) => {
      const room = g_room.robj;

      lines.push(`<div>${name}</div>`);
      _.each(room.reg_put_intents, pi => {
        lines.push(`<div style="padding-left: 5px;">${pi.creep.creep.name} ${pi.trgt} ${pi.restype} +${pi.amount}</div>`);
      });
      _.each(room.reg_get_intents, gi => {
        lines.push(`<div style="padding-left: 5px;">${gi.creep.creep.name} ${gi.trgt} ${gi.restype} -${gi.amount}</div>`);
      });
    });

    return lines.join('');
  };

  Game.show_intentions.help = {
    desc: 'Shows get/put intentions by creeps per room.',
  };

  Game.show_room_config = () => {
    const lines = [];
    const ecfg = Memory.ecfg;

    _.each(game.rooms(), room => {
      const name = room.name;
      const rcfg = ecfg[name];
      const ab = rcfg['autobuild'] ? 'on' : 'off';
      lines.push(`<div>${name}</div>`);
      lines.push(`<div style="padding-left: 5px;" tooltip="Use Game.autobuild_on(<room_name>) or Game.autobuild_off(<room_name>).">autobuild: ${ab}</div>`);
    });
  
    return lines.join('');
  };

  Game.show_room_config.help = {
    desc: 'Print room configuration in a formatted easy to read way.',
  };

  Game.autobuild_on = (room_name) => {
    ecfg[room_name] = ecfg[room_name] || {};
    ecfg[room_name].autobuild = true;
    return `AutoBuild activated for room ${room_name}`;
  };

  Game.autobuild_on.help = {
    desc: 'Turn autobuild on for the room specified.',
    params: [
      ['room_name', 'string', 'The room name.'],
    ],
  };

  Game.autobuild_off = (room_name) => {
    ecfg[room_name] = ecfg[room_name] || {};
    ecfg[room_name].autobuild = undefined;
    return `AutoBuild deactivated for room ${room_name}`;
  };

  Game.autobuild_off.help = {
    desc: 'Turn autobuild off for the room sepcified.',
    params: [
      ['room_name', 'string', 'The room name.'],
    ],
  };

  Game.ops_create_claim_team = (home_room, target_room, allowable_rooms) => {
    const op = { 
      tr: target_room,
      ar: allowable_rooms,
    };

    ecfg[home_room] = ecfg[home_room] || {};
    ecfg[home_room].claimteam = ecfg[home_room].claimteam || [];
    ecfg[home_room].claimteam.push(op);
    return `Added claim operation on room ${target_room}.`; 
  };

  Game.ops_create_claim_team.help = {
    desc: 'Create team of creeps needed to claim a room.',
    params: [
      ['home_room', 'string', 'The room that produces the creeps.'],
      ['target_room', 'string', 'The room that the creeps will claim.'],
      ['allowable_rooms', 'string', 'May be undefined. A list of rooms the creep MAY travel into and none others. Must include both the target room and the home room.'],
    ],
  };

  Game.ops_create_warfare_small = (home_room, uid, room, max_level, count) => {
    const op = {
      uid: uid,
      room: room,
      max_level: max_level,
      count: count,
    };

    ecfg[home_room] = ecfg[home_room] || {};
    ecfg[home_room].warfare_small = 
    ecfg[home_room].warfare_small || [];
    ecfg[home_room].warfare_small.push(op);
  };

  Game.ops_create_warfare_small.help = {
    desc: 'Create small team of one or more attackers to clear a room or provide area denial.',
  };

  Game.ops_del = (hroom, mod, index) => {
    ecfg[hroom][mod].splice(index, 1);
    return `Deleted op of room ${hroom} with mod ${mod} on index ${index}.`
  };

  Game.ops_del.help = {
    desc: 'Delete an operation from the list (<b>Game.ops_list()</b>).',
  };

  Game.ops_list = () => {
    console.log('== OPS CON [LIST] ==');
    for (let hroom in ecfg) {
      for (let mod in ecfg[hroom]) {
        for (let ndx = 0; ndx < ecfg[hroom][mod].length; ++ndx) {
          let unit = ecfg[hroom][mod][ndx];
          if (mod === 'warfare_small') {
            console.log(`[${hroom}/${mod}/${ndx}] uid=${unit.uid} room=${unit.room} max_level=${unit.max_level} count=${unit.count}`);
          } else {
            console.log(`[${hroom}/${mod}/${ndx}] <unimplemented parameter display>`);
          }
        }
      }
    }
  };

  Game.ops_list.help = {
    desc: 'List all known operations.',
  };

  ecfg.ally = ecfg.ally || {};

  Game.ally_add = (name) => {
    ecfg.ally[name] = true;
    return `Added ally ${name}.`;
  };

  Game.ally_add.help = {
    desc: 'Adds an ally to the ally list.',
  };

  Game.ally_del = (name) => {
    ecfg.ally[name] = undefined;
    return `Removed ally ${name}.`;
  };

  Game.ally_del.help = {
    desc: 'Deletes an ally from the ally list.',
  };

  Game.log_rule_list = () => {
    console.log('== LOG RULES ==');
    const logrules = Memory.logrules || [];
    for (let x = 0; x < logrules.length; ++x) {
      const rule = logrules[x];
      console.log(`[${x}] ${rule}`);
    }
    return 'End of List';
  };

  Game.log_rule_list.help = { desc: 'List log rules.' };

  Game.log_rules_clear = () => {
    Memory.logrules = [];
    return 'Cleared All Log Rules';
  };

  Game.log_rules_clear.help = { desc: 'Clear all log rules.' };

  Game.log_print_known_groups = () => {
    const kgroups = logging.get_known_groups();
    console.log('== KNOWN LOG GROUPS ==');
    logging.get_known_groups().forEach(gtext => {
      console.log(gtext);
    });
    return 'Done';
  };

  Game.log_print_known_groups.help = {
    desc: 'Print known groups for the log output.',
  };

  Game.log_rule_del = (ndx) => {
    const logrules = Memory.logrules || [];
    const rule = logrules[ndx];
    logrules.splice(ndx, 1);
    return `Removed log rule ${ndx}: ${rule}`;
  }; 

  Game.log_rule_del.help = {
    desc: 'Delete a log rule by its index.',
  };

  Game.log_rule_add = (rule) => {
    const logrules = Memory.logrules || [];
    logrules.push(rule);
    return `Added log rule: ${rule}`;
  };

  Game.log_rule_add.help = {
    desc: 'Add a new log rule using a regular expression pattern.',
  };

}
