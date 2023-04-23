import { SVG } from '@svgdotjs/svg.js';
import { glMatrix } from 'gl-matrix/esm/index.js';

console.log('abc');
glMatrix.setMatrixArrayType(Array);

var draw = SVG().addTo('body').size(300, 300);
var rect = draw.rect(100, 100).attr({ fill: '#f06' });
