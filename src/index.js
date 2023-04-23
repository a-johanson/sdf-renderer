import { SVG } from '@svgdotjs/svg.js'

console.log('abc');

var draw = SVG().addTo('body').size(300, 300);
var rect = draw.rect(100, 100).attr({ fill: '#f06' });
