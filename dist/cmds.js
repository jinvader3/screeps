const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

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

  Game.show_terminals = () => {
    const lines = [];
    for (let rname in Game.rooms) {
      const room = Game.rooms[rname];
      const terminal = room.terminal;
      if (terminal) {
        lines.push(`<h6>${rname}</h6>`);
        lines.push('<table>');
        let line = [];
        for (let product in terminal.store) {
          const amount = terminal.store.getUsedCapacity(product);
          if (line.length === 4) {
            lines.push('<tr>' + line.join('') + '</tr>');
            line = [];
          }
          line.push(`<td style="padding: 5px;">${product}</td><td style="padding: 5px;">${amount}</td>`);
        }
        lines.push('<tr>' + line.join('') + '</tr>');
        lines.push('</table>');
      }
    }
    return lines.join('');
  };

  Game.autobuild2_rebuild = (room_name) => {
    const rm = Game.rooms[room_name].memory;
    rm.plan = undefined;
    return `Plan scheduled for rebuild for autobuild2 on room ${room_name}.`;
  };

  Game.show_comp_orders_room = (room) => {
    const m = game.memory().rooms[room];

    if (m === undefined) {
      return ['==${room}==', 'Bad Room'].join('<br/>');
    }

    const comp_orders = m.labman_comp_orders;
    
    if (comp_orders === undefined) {
      return [`==${room}==`, 'No Orders'].join('<br/>');
    }

    const lines = [`==${room}==`];

    for (let x = 0; x < comp_orders.length; ++x) {
      const order = comp_orders[x];
      const action = order.action;

      switch (action) {
        case 'buy':
          lines.push(`BUY ${order.what} ${order.count}`);
          break;
        case 'combine':
          lines.push(`COMBINE ${order.inputs[0]} + ${order.inputs[1]} = ${order.output} [${order.count}]`);
          break;
        default:
          lines.push(`unknown action ${action}`);
          break;
      }
    }

    return lines.join('<br/>');
  };

  Game.show_comp_orders = () => {
    let lines = [];
    for (let room_name in game.rooms()) {
      lines.push(Game.show_comp_orders_room(room_name));
    }
    return lines.join('<br/>');
  };

  Game.show_rooms = () => {
    let lines = [];
    for (let room_name in game.rooms()) {
      lines.push(`${room_name}`);
    }
    return lines.join('<br/>');
  };

  Game.show_cpuavg = (sort_by_name) => {
    const memory = game.memory();
    // Calculate CPU usage per task.
    const tasks = memory.tasks;

    let rows = [];
    for (let task_id in tasks) {
      const parts = task_id.split('/');
      const task = tasks[task_id];
      const bucket = task.amount;
      const avgcpu = task.avgsum / task.avgcnt;
      const tpt = task.delay / task.tick;
      let creep_name = null;
      let extra = '';

      if (parts.length >= 3) {
        const sub_parts = parts[2].split(':');
        if (sub_parts.length === 3 && sub_parts[0] === 'creep') {
          creep_name = `${sub_parts[1]}:${sub_parts[2]}`;
        }
      }

      if (creep_name !== null) {
        extra = `${memory.creeps[creep_name].g}`;
      }

      rows.push([task_id, avgcpu, bucket, tpt]);
      //console.log(`${task_id} avg=${avgcpu} bucket=${bucket} ${extra}`);
    }

    if (sort_by_name) {
      rows.sort((a, b) => a[0] > b[0] ? 1 : -1);
    } else {
      rows.sort((a, b) => a[1] - b[1]);
    }

    let lines = [];

    const h0 = 'avg'.padStart(7);
    const h1 = 'buc'.padStart(7);
    const h2 = 'tpt'.padStart(7);
    lines.push(`   ${h0}${h1}${h2}`);

    for (let x = 0; x < rows.length; ++x) {
      const row = rows[x];
      let state;
      if (row[2] !== undefined && row[2] <= 0) {
        state = '[<span style="color: red;">OFF</span>]';
      } else {
        state = '[<span style="color: green;">ON </span>]';
      }

      const r2 = (row[2] === null || row[2] === undefined) ? 0 : row[2];
      const c0 = new String(row[1].toFixed(2)).padStart(7);
      const c1 = new String(r2.toFixed(2)).padStart(7);
      const c2 = new String(row[3].toFixed(2)).padStart(7);

      lines.push(`${state}${c0}${c1}${c2} ${row[0]}`);
    }

    // Calculate overall CPU usage.
    let sum = 0;
    for (let x = 0; x < memory.cpuhis.length; ++x) {
      sum += memory.cpuhis[x];
    }

    const avg = sum / memory.cpuhis.length;
  
    lines.push(`The average historical CPU usage is ${avg}.`);
    return lines.join('<br/>');
  };

  Game.show_cpuavg.help = {
    desc: 'Shows the average CPU usage minus serialization.',
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

  Game.lab_enable = (room_name, enabled) => {
    ecfg[room_name] = ecfg[room_name] || {};
    ecfg[room_name].lab = enabled;
    return `Lab enabled=${enabled} for room ${room_name}`;
  };

  Game.lab_enable.help = {
    desc: 'Turn the labman on/off for the room specified.',
  };

  Game.lab_boosts = (room_name, enabled) => {
    ecfg[room_name] = ecfg[room_name] || {};
    ecfg[room_name].lab_boosting = enabled;

    if (enabled) {
      return `Lab enabled for boosting for room ${room_name}.`;
    } else {
      return `Lab disabled for boosting for room ${room_name}.`;
    }
  };

  Game.lab_boosts.help = {
    desc: 'Switch the labman mode into boost mode.',
  };

  Game.autobuild_on = (room_name) => {
    ecfg[room_name] = ecfg[room_name] || {};
    ecfg[room_name].autobuild = true;
    return `AutoBuild activated for room ${room_name}`;
  };

  Game.autobuild2 = (room_name, active) => {
    ecfg[room_name] = ecfg[room_name] || {};
    ecfg[room_name].autobuild2 = active;
    return `AutoBuild2 for room ${room_name} set to ${active}.`;
  };

  Game.autobuild2.help = {
    desc: 'Turn autobuild2 on/off for the room specified.'
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
