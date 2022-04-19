const game = require('./game');
_ = game._;
const { logging } = require('./logging');

/// This is a spawn manager registration entry. It represents the caller's desire for the spawn to potentially
/// build a creep. The key here is that it is not an actual request but rather a registration to the spawn that
/// this type of creep needs to be built *IF* it does not already exist. The spawn manager also uses this to track
/// existing creeps and replace them _before_ they expire.
class Reg {
    constructor (clazz, group, build_gf, max_level, priority, count, memory, needed_level, post_ticks) {
        // The creep's memory object field `c` is set to this. (USER DEFINED but may be used for matching)
        this.clazz = clazz;
        // The creep's memory object field `g` is set to this. (USER DEFINED but may be used for matching)
        this.group = group;
        // A generator function that on each iteration yields a body with an additional part added creating
        // the idea of creep levels. The higher the level the bigger/stronger the creep is but obviously
        // the more it costs. Creeps are always attempted to be built at the `max_level`.
        this.build_gf = build_gf;
        // The maximum number of iterations or the highest possible level.
        this.max_level = max_level === undefined ? 999 : max_level;
        // A lower number beats higher numbers. 
        this.priority = priority === undefined ? 0 : priority;
        // This is the number of creeps that should be kept spawned.
        this.count = count === undefined ? 0 : count;
        // This is the memory to provide each spawn creep with. The `c` and `g` fields are merged with
        // memory to create the final memory object. The `c` and `g` fields are from the clazz and group
        // parameters above. If they are specified here they will be overwritten.
        this.memory = memory === undefined ? {} : memory;
        // If this is specified it represents the level needed but if it can not be obtained due to the
        // amount of spawn energy being limited then a number of creeps equal to this level will be spawned
        // . It a nutshell, this dynamically adjusts the `count` parameter depending on the actual maximum
        // level possible to build.
        this.needed_level = needed_level === undefined ? 0 : needed_level;
        // The number of ticks + the ticks needed to spawn the creep to start building before the existing
        // creep expires. In this way, we try to replace the creep before it expires.
        this.post_ticks = post_ticks === undefined ? 10 : post_ticks;
    }

    get_max_level (max_energy, max_level) {
        if (max_energy === undefined || max_energy === null) {
          throw new Error('max_energy *must* not be undefined or null');
        }

        let cnt = 1;
        let best = [];
        for (let build of this.build_gf()) {
            let cost = _.sumBy(build, part => {
                switch (part) {
                    case game.WORK: return 100;
                    case game.CARRY: return 50;
                    case game.MOVE: return 50;
                    case game.CLAIM: return 600;
                    case game.ATTACK: return 80;
                    case game.RANGED_ATTACK: return 150;
                    case game.HEAL: return 250;
                    case game.TOUGH: return 10;
                    default:
                        logging.log('unknown body part', part);
                        return 999999;
                }
            });

            if (cost > max_energy) {
                return {
                  body: best,
                  level: cnt,
                };
            }

            best = _.map(build, part => part);
            if (++cnt >= max_level) {
              return {
                body: best,
                level: cnt,
              };
            }
        }

        return {
          body: best,
          level: cnt,
        };
    }
}

class SpawnManager {
    constructor () {
        this.regs = [];
    }

    reg_build2 ({ clazz, group, build_gf, max_level, priority, count, memory, needed_level, post_ticks }) {
      return this.reg_build(clazz, group, build_gf, max_level, priority, count, memory, needed_level, post_ticks);
    }

    reg_build (clazz, group, build_gf, max_level, priority, count, memory, needed_level, post_ticks) {
        //logging.log(
        //  `reg_build(${clazz}, ${group}, ..., ${max_level}, ${priority}, ${count}, ${memory}, ${needed_level})`
        //);

        this.regs.push(new Reg(
            clazz, group, build_gf, max_level, priority, count, memory, needed_level, post_ticks
        ));
    }

    process (room, max_energy, creeps, spawns) {
        logging.log(`[spawn processing ${room.room.name}]`);
        // Order the registrations by priority.
        this.regs.sort((a, b) => a.priority > b.priority ? 1 : -1);
        // Find creeps of the highest priority that are soon to expire.
        for (let reg of this.regs) {
            let rcreeps = _.filter(creeps, creep => {
                let cm = creep.get_memory();
                return cm.g === reg.group && cm.c === reg.clazz;
            });


            // Determine the maximum level unit we can build.
            let res = reg.get_max_level(max_energy, reg.max_level)
            let body = res.body;
            let level = res.level;

            if (body === null) {
              console.log(JSON.stringify(reg));
            }
  
            let time_to_spawn = body.length * 3;

            let count_mul; 

            if (reg.needed_level !== undefined) {
              count_mul = Math.max(Math.ceil(reg.needed_level / level), 1);
            } else {
              count_mul = 1;
            }

            let count = reg.count * count_mul;

            rcreeps.sort((a, b) => a.get_ttl() < b.get_ttl() ? -1 : 1);
            let frcreep = rcreeps[0];

            // Calculate the fatigue of the creep and multiply it by `post_ticks`, but don't
            // let the value go below one.
            let move_parts = _.sumBy(body, part => part === game.MOVE);
            let other_parts = _.sumBy(body, part => part !== game.MOVE);
            let ratio_multiplier = Math.min(1, other_parts / move_parts);

            let cond_a = frcreep === undefined || 
                         frcreep.get_ttl() <= time_to_spawn + reg.post_ticks * ratio_multiplier;
            let cond_b = rcreeps.length < count;
            let cond_c = rcreeps.length === count;

            if ((cond_a && cond_c) || cond_b) {
                // Try to spawn this creep.
                let free_spawns = _.filter(spawns, spawn => !spawn.spawning);
                if (free_spawns.length > 0) {
                    let n_memory = {};
      
                    for (let k in reg.memory) {
                      n_memory[k] = reg.memory[k];
                    }
      
                    n_memory['c'] = reg.clazz;
                    n_memory['g'] = reg.group;

                    let res = free_spawns[0].spawnCreep(
                        body,
                        `${room.get_name()}:${game.time()}`,
                        { memory: n_memory }
                    );
                    
                    logging.log('spawn', res);
                    logging.log(body);
                    logging.log(`${room.get_name()}:${game.time()}`);
                    logging.log(n_memory);
                }
                return;
            }
        }
    }
}

module.exports.SpawnManager = SpawnManager;
