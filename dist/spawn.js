const game = require('./game');
_ = game._;


class Reg {
    constructor (clazz, group, build_gf, max_level, priority, count, memory, needed_level) {
        this.clazz = clazz;
        this.group = group;
        this.build_gf = build_gf;
        this.max_level = max_level === undefined ? 999 : max_level;
        this.priority = priority === undefined ? 0 : priority;
        this.count = count === undefined ? 0 : count;
        this.memory = memory === undefined ? {} : memory;
        this.needed_level = needed_level === undefined ? 0 : needed_level;
    }

    get_max_level (max_energy, max_level) {
        if (max_energy === undefined || max_energy === null) {
          throw new Error('max_energy *must* not be undefined or null');
        }

        let cnt = 1;
        let best = null;
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
                        console.log('unknown body part', part);
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

    reg_build (clazz, group, build_gf, max_level, priority, count, memory, needed_level) {
        this.regs.push(new Reg(
            clazz, group, build_gf, max_level, priority, count, memory, needed_level
        ));
    }

    process (room, max_energy, creeps, spawns) {
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
            let time_to_spawn = body.length * 3;

            let count_mul = Math.ceil(reg.needed_level / level);
            let count = reg.count * count_mul;

            rcreeps.sort((a, b) => a.get_ttl() < b.get_ttl() ? -1 : 1);
            let frcreep = rcreeps[0];

            let cond_a = frcreep === undefined || frcreep.get_ttl() <= time_to_spawn + 10;
            let cond_b = rcreeps.length < count;
            let cond_c = rcreeps.length === count;

            //console.log('reg.group', reg.group, cond_a, cond_b, cond_c);

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

                    free_spawns[0].spawnCreep(
                        body,
                        `${room.get_name()}:${game.time()}`,
                        { memory: n_memory }
                    );
                    //console.log('pretend spawn');
                    //console.log(body);
                    //console.log(`${room.get_name()}:${game.time()}`);
                    //console.log(n_memory);
                }
                return;
            }
        }
    }
}

module.exports.SpawnManager = SpawnManager;
