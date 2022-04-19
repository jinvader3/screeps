class Logging {
  constructor () {
    this.groups = [];
    this.known_groups = new Set();
  }

  get_known_groups () {
    return this.known_groups;
  }

  print (color, args) {
    let _args = [];

    const group = this.groups.join('/');
    this.known_groups.add(group);

    if (this.groups.length > 0) {
      _args.push(`<span style="color: ${color};">${group}</span>`);
    }

    for (let x = 0; x < args.length; ++x) {
      _args.push(args[x]);
    }

    Memory.logrules = Memory.logrules || [];
    const logrules = Memory.logrules;

    const text = _args.join(' ');

    if (!_.some(logrules, rule => {
      try {
        const re = new RegExp(rule);
        return re.test(text);
      } catch (err) {
        console.log(`logrules error ${err} for ${rule}`);
      }
    })) {
      return;
    }

    console.log.apply(console, _args);
  }

  debug () {
    this.print('yellow', arguments);
  }

  info () {
    this.print('#99ff99', arguments);
  }

  warn () {
    this.print('#ff9999', arguments);
  }

  log () {
    this.print('white', arguments);
  }

  reset () {
    this.groups = [];
  }

  wrapper (group, f) {
    this.push(group);
    let res = f();
    this.pop();
    return res;
  }

  push (group) {
    this.groups.push(group);
  }

  pop () {
    this.groups.pop();
  }
}


module.exports.logging = new Logging();
