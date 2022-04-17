class Image {
  constructor (w, h, data) {
    if (h === undefined) {
      data = w;
      h = data.length;
      w = data[0].length;
      let _d = new Uint8Array(w * h);
      for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
          const i = x + y * w;
          _d[i] = data[y][x];
        }
      }
      data = _d;
    }
    this.h = w;
    this.w = h;
    this.d = data;
  }

  clone () {
    return new Image(this.w, this.h, Uint8Array.from(this.d));
  }

  static zeros (w, h) {
    const d = new Uint8Array(w * h);
    return new Image(w, h, d);
  }

  valid (other, x, y) {
    //let out = Image.zeros(this.w, this.h);

    let sum = 0;

    for (let cy = 0; cy < this.h; ++cy) {
      for (let cx = 0; cx < this.w; ++cx) {
        let b;

        let other_i = (cx + x) + (cy + y) * other.w;

        if (cy + y >= other.h || cx + x >= other.w) {
          b = 0; // non-passable
        } else {
          b = other.d[other_i];
        }

        let this_i = cx + cy * this.w;

        const a = this.d[this_i];

        if (b === 14 && a === 14) {
          //out.d[this_i] = 1;
          sum += 1;
        } else if (b === 0) {
          //out.d[this_i] = 0;
        } else if (b === 1) {
          //out.d[this_i] = 1;
          sum += 1;
        } else {
          //out.d[this_i] = 0;
        }
      }
    }

    //return out;
    return sum;
  }

  set (x, y, v) {
    this.d[x + y * this.w] = v;
  }

  get (x, y) {
    return this.d[x + y * this.w];
  }

  blend (x, y, other) {
    for (let cy = 0; cy < other.h; ++cy) {
      for (let cx = 0; cx < other.w; ++cx) {
        const other_i = cx + cy * other.w;
        const this_i = (cx + x) + (cy + y) * this.w;
        this.d[this_i] = other.d[other_i];
      }
    }
  }

  rotate_90 () {
    let n = Image.zeros(this.h, this.w);
    for (let y = 0; y < this.h; ++y) {
      for (let x = 0; x < this.w; ++x) {
        const this_i = x + y * this.w;

        // (h - y - 1) + x * h

        const n_i = (this.h - y - 1) + x * this.h;

        n.d[n_i] = this.d[this_i];
      }
    }
    return n;
  }

  sum () {
    let s = 0;
    for (let y = 0; y < this.h; ++y) {
      for (let x = 0; x < this.w; ++x) {
        const i = x + y * this.w;
        s += this.d[i];
      }
    }
    return s;
  }
}

module.exports.Image = Image;
