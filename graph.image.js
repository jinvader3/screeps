class Image {
  constructor (data) {
    this.h = data.length;
    this.w = data[0].length;
    this.d = data;

    if (this.h === undefined)
      throw new Error();
    if (this.w === undefined)
      throw new Error();
    if (this.d === undefined) 
      throw new Error();
  }

  clone () {
    let nd = [];
    for (let y = 0; y < this.h; ++y) {
      const row = [];
      for (let x = 0; x < this.w; ++x) {
        row.push(this.d[y][x]);
      }
      nd.push(row);
    }
    return new Image(nd);
  }

  rect (x, y, w, h, v) {
    for (let cy = 0; cy < h; ++cy) {
      for (let cx = 0; cx < w; ++cx) {
        this.set(cx + x, cy + y, v);
      }
    }
  }

  static zeros (w, h) {
    const d = [];

    for (let y = 0; y < h; ++y) {
      const row = [];
      for (let x = 0; x < w; ++x) {
        row.push(0);
      }
      d.push(row);
    }

    return new Image(d);
  }

  /*
    WALL=0
    PLAIN=1

    0   X   = 0   NOTHING OVER WALL
    1   X   = 1   ANYTHING OVER PLAIN/SWAMP
    13  13  = 1   ROAD OVER ROAD OK

  */  
  valid (other, x, y) {
    let out = Image.zeros(this.w, this.h);

    for (let cy = 0; cy < this.h; ++cy) {
      for (let cx = 0; cx < this.w; ++cx) {
        let b;

        if (cy + y >= other.h || cx + x >= other.w) {
          b = 0; // non-passable
        } else {
          b = other.d[cy + y][cx + x];
        }

        const a = this.d[cy][cx];

        if (b === 14 && a === 14) {
          out.d[cy][cx] = 1;
        } else if (b === 0) {
          out.d[cy][cx] = 0;
        } else if (b === 1) {
          out.d[cy][cx] = 1;
        } else {
          out.d[cy][cx] = 0;
        }
      }
    }

    return out;
  }

  set (x, y, v) {
    this.d[y][x] = v;
  }

  get (x, y) {
    return this.d[y][x];
  }

  blend (x, y, other) {
    for (let cy = 0; cy < other.h; ++cy) {
      for (let cx = 0; cx < other.w; ++cx) {
        this.d[cy + y][cx + x] = other.d[cy][cx];
      }
    }
  }

  rotate_90 () {
    let n = Image.zeros(this.h, this.w);
    for (let y = 0; y < this.h; ++y) {
      for (let x = 0; x < this.w; ++x) {
        n.d[x][y] = this.d[y][x];
      }
    }
    return n;
  }

  sum () {
    let s = 0;
    for (let y = 0; y < this.h; ++y) {
      for (let x = 0; x < this.w; ++x) {
        s += this.d[y][x];
      }
    }
    return s;
  }
}

module.exports.Image = Image;
