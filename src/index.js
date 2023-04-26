import { SVG } from '@svgdotjs/svg.js';
import { glMatrix, vec2, vec3 } from 'gl-matrix/esm/index.js';

glMatrix.setMatrixArrayType(Array);

const canvasDim = vec2.fromValues(800, 600);
let draw = SVG().addTo('body').size(canvasDim[0], canvasDim[1]);

const camera    = vec3.fromValues(0.0, 0.0, 5.0);
const lookAt    = vec3.fromValues(0.0, 0.0, 0.0);
const up        = vec3.fromValues(0.0, 1.0, 0.0);
const fovY      = 30.0 / 180.0 * Math.PI;
const focalDist = 1.0;

let u = vec3.create(), v = vec3.create(), w = vec3.create();
vec3.normalize(w, vec3.subtract(w, lookAt, camera)); // w = normalize(lookAt - camera)
vec3.normalize(v, vec3.scaleAndAdd(v, up, w, -vec3.dot(up, w))); // v = normalize(up - dot(up, w) * w)
vec3.cross(u, w, v); // u = cross(w, v)

console.log(u);
console.log(v);
console.log(w);

function distanceToScene(p) {
    return vec3.len(p) - 1.0;
}

function sceneNormal(sdf, p) {
    const eps = 0.005;
    const dX = vec3.fromValues(eps, 0.0, 0.0);
    const dY = vec3.fromValues(0.0, eps, 0.0);
    const dZ = vec3.fromValues(0.0, 0.0, eps);

    const ppdX = vec3.add(vec3.create(), p, dX);
    const pmdX = vec3.sub(vec3.create(), p, dX);
    const ppdY = vec3.add(vec3.create(), p, dY);
    const pmdY = vec3.sub(vec3.create(), p, dY);
    const ppdZ = vec3.add(vec3.create(), p, dZ);
    const pmdZ = vec3.sub(vec3.create(), p, dZ);

    let n = vec3.fromValues(
        sdf(ppdX) - sdf(pmdX),
        sdf(ppdY) - sdf(pmdY),
        sdf(ppdZ) - sdf(pmdZ),
    );
    vec3.normalize(n, n);
    return n;
}

function sampleScene(sdf, s, dir) {
    const maxIter = 75;
    const minDist = 0.005;
    let l = 0.0;
    for (let i = 0; i < maxIter; i++) {
        let p = vec3.create();
        vec3.scaleAndAdd(p, s, dir, l); // p = s + l * dir
        const dist = sdf(p);
        if (dist < minDist) {
            const n = sceneNormal(sdf, p);
            const iTime = 7.0;
            const light = vec3.fromValues(100.0*Math.sin(0.5*iTime), 30.0*Math.cos(0.5*iTime), 50.0*Math.cos(0.5*iTime));
            let temp = vec3.create();
            return Math.max(vec3.dot(vec3.normalize(temp, vec3.sub(temp, p, light)), n), 0.0); // = max(dot(normalize(p - light), n), 0.0)
        }
        l += dist;
    }
    return 0.0;
}

const ar = canvasDim[0] / canvasDim[1];
const screenDimY = Math.tan(0.5 * fovY);

const tileCount = vec2.fromValues(100, 75);
const tileDim   = vec2.div(vec2.create(), canvasDim, tileCount);
for (let ix = 0; ix < tileCount[0]; ix++) {
    for (let iy = 0; iy < tileCount[1]; iy++) {
        const canvasPos = vec2.fromValues(
            ix * canvasDim[0] / tileCount[0],
            iy * canvasDim[1] / tileCount[1],
        );
        let ab = vec2.create(), screenCoord = vec2.create(), pScreen = vec3.create(), rayDir = vec3.create();
        vec2.sub(ab, vec2.scale(ab, vec2.div(ab, canvasPos, canvasDim), 2.0), vec2.fromValues(1.0, 1.0)); // ab = 2.0 * canvasPos / canvasDim - 1.0
        vec2.mul(screenCoord, ab, vec2.fromValues(ar * screenDimY, screenDimY)); // screenCoord = ab * [ar * screenDimY, screenDimY]
        vec3.scaleAndAdd(
            pScreen,
            camera,
            vec3.scaleAndAdd(
                pScreen,
                vec3.scaleAndAdd(pScreen, w, v, screenCoord[1]),
                u,
                screenCoord[0]
            ),
            focalDist
        ); // pScreen = camera + focalDist * (screenCoord.x * u + screenCoord.y * v + w)
        const eye = camera;
        vec3.normalize(rayDir, vec3.sub(rayDir, pScreen, eye)); // rayDir = normalize(pScreen - eye)
        const intensity = sampleScene(distanceToScene, eye, rayDir);
        const grey = Math.floor(intensity * 255);
        draw.rect(tileDim[0], tileDim[1]).move(canvasPos[0], canvasPos[1]).fill(`rgb(${grey}, ${grey}, ${grey})`);
    }
}
