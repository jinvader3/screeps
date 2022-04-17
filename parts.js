const { Image } = require('./graph.image.js');

let e = 2;  // extension
let s = 3;  // spawn
let l = 4;  // link
let t = 5;  // storage
let w = 6;  // tower
let o = 7;  // observer
let p = 8;  // power core
let x = 9;  // extractor
let m = 10;  // terminal
let a = 11; // lab
let n = 12; // nuker
let f = 13; // factory
let z = 14; // road

let ext_part5 = new Image([
  [z, z, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, z, z],
]);

let ext_part8 = new Image([
  [z, z, z, z, z, z],
  [z, z, e, e, z, z],
  [z, e, e, e, e, z],
  [z, e, e, e, e, z],
  [z, z, e, e, z, z],
  [z, z, z, z, z, z],
]);

let ext_part6 = new Image([
  [z, z, z],
  [z, e, z],
  [z, z, z],
]);

let ext_part7 = new Image([
  [z, z, z, z],
  [z, e, e, z],
  [z, e, e, z],
  [z, z, z, z],
]);


let ext_part4 = new Image([
  [z, z, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, e, z],
  [z, z, z],
]);

let ext_part3 = new Image([
  [z, z, z, z, z, z],
  [z, e, e, e, e, z],
  [z, e, e, z, z, z],
  [z, e, e, e, e, z],
  [z, e, e, e, e, z],
  [z, e, z, z, z, z],
  [z, z, z, z, z, z],
]);

let ext_part2 = new Image([
  [z, z, z, z, z],
  [z, z, e, z, z],
  [z, e, e, e, z],
  [z, e, z, e, z],
  [z, e, e, e, z],
  [z, z, e, z, z],
  [z, z, z, z, z],
]);

let ext_part0 = new Image([
  [z, z, z, z, z],
  [z, e, e, e, z],
  [z, e, z, z, z],
  [z, e, e, e, z],
  [z, e, z, z, z],
  [z, e, e, z, z],
  [z, z, z, z, z],
]);

let ext_part1 = new Image([
  [z, z, z, z, z],
  [z, e, e, e, z],
  [z, e, z, e, z],
  [z, z, z, z, z],
]);

let core_s1w1t1l1_part = new Image([
  [z, z, z, z],
  [z, s, w, z],
  [z, t, l, z],
  [z, z, z, z],
]);

let core_w5_part = new Image([
  [z, z, z, z],
  [z, w, w, z],
  [z, w, w, z],
  [z, w, z, z],
  [z, z, z, z],
]);

let core_w6_part = new Image([
  [z, z, z, z],
  [z, w, w, z],
  [z, w, w, z],
  [z, w, w, z],
  [z, z, z, z],
]);

let core_s2o1p1m1n1f1_part = new Image([
  [z, z, z, z],
  [z, s, z, z],
  [z, s, o, z],
  [z, p, m, z],
  [z, n, f, z],
  [z, z, z, z],
]);

let core_s3o1p1m1n1f1t1l1_part = new Image([
  [z, z, z, z],
  [z, s, s, z],
  [z, s, o, z],
  [z, p, m, z],
  [z, n, f, z],
  [z, t, l, z],
  [z, z, z, z],
]);

let core_a7_part = new Image([
  [z, z, z, z, z],
  [z, a, a, a, z],
  [z, a, z, z, z],
  [z, a, a, a, z],
  [z, a, z, z, z],
  [z, a, a, z, z],
  [z, z, z, z, z],
]);

let parts = [
  //['e10', ext_part0],
  //['e05', ext_part1],
  //['e10', ext_part2],
  //['e15', ext_part3],
  //['e05', ext_part4],
  //['e04', ext_part7],
  //['e01', ext_part6],
  //['e10', ext_part5],
  ['e12', ext_part8],
  ['s01w01t01l01', core_s1w1t1l1_part],
  ['w05', core_w5_part],
  ['w06', core_w6_part],
  ['s03o01p01m01n01f01t01l01', core_s3o1p1m1n1f1t1l1_part],
  //['s02o01p01m01n01f01', core_s2o1p1m1n1f1_part],
  ['a10', core_a7_part],
];

module.exports = {
  parts: parts,
  e: 1,
  s: 2,
  l: 3,
  t: 4,
  w: 5,
  o: 6,
  p: 7,
  x: 8,
  m: 9,
  a: 10,
  n: 11,
  f: 12
};
