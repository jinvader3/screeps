class Logging {
  constructor () {
    this.groups = [];
  }

  debug () {
    let args = [];
    if (this.groups.length > 0) {
      args.push(`<span style="color: #99ff99;">${this.groups.join('/')}</span>`);
    }

    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }
    console.log.apply(console, args);
  }

  info () {
    let args = [];
    if (this.groups.length > 0) {
      args.push(`${this.groups.join('/')}`);
    }

    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }
    console.log.apply(console, args);
  }

  warn () {
    let args = [];
    if (this.groups.length > 0) {
      args.push(`<span style="color: #ff9999;">${this.groups.join('/')}</span>`);
    }

    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }
    console.log.apply(console, args);
  }

  log () {
    let args = [];
    if (this.groups.length > 0) {
      args.push(`>>${this.groups.join('/')}`);
    }
    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }
    console.log.apply(console, args);
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
