import { SVG } from '@svgdotjs/svg.js';
import { glMatrix, vec3 } from 'gl-matrix/esm/index.js';

glMatrix.setMatrixArrayType(Array);

var draw = SVG().addTo('body').size(300, 300);
var rect = draw.rect(100, 100).attr({ fill: '#f06' });

const camera    = vec3.fromValues(0.0, 0.0, 2.0);
const lookAt    = vec3.fromValues(0.0, 0.0, 0.0);
const up        = vec3.fromValues(0.0, 1.0, 0.0);
const fovY      = 50.0 / 180.0 * Math.PI;
const focalDist = 1.0;

var u = vec3.create(), v = vec3.create(), w = vec3.create();
vec3.normalize(w, vec3.subtract(w, lookAt, camera)); // = normalize(lookAt - camera)
vec3.normalize(v, vec3.scaleAndAdd(v, up, w, -vec3.dot(up, w))); // = normalize(up - dot(up, w) * w)
vec3.cross(u, w, v); // = cross(w, v)

console.log(u);
console.log(v);
console.log(w);
