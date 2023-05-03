import { SVG } from '@svgdotjs/svg.js';
import { glMatrix, vec2, vec3 } from 'gl-matrix/esm/index.js';
import * as seedrandom from 'seedrandom/index.js';

let rng = seedrandom('so many colorful shapes -- it is rrreally beautiful!');
glMatrix.setMatrixArrayType(Array);

class ScenePoint {
    p;
    pScreenDirection;
    distFromCamera;
    distFromScene;
    p_uvw;
    screenCoordinates;
    normal;
    lightIntensity;
    visibilityFactor;

    constructor({
        rayMarcher = undefined,
        sdf = undefined,
        light = undefined,
        p = undefined,
        pScreenDirection = undefined,
        distFromCamera = undefined,
        distFromScene = undefined,
        p_uvw = undefined,
        screenCoordinates = undefined,
        normal = undefined,
        lightIntensity = undefined,
        visibilityFactor = undefined
    }) {
        this.p = p;
        this.p_uvw = this._getOrElse(p_uvw, () => rayMarcher.cameraSystemCoordinates(p));
        this.screenCoordinates = this._getOrElse(screenCoordinates, () => rayMarcher.screenCoordinates(this.p_uvw));
        this.pScreenDirection = this._getOrElse(pScreenDirection, () => rayMarcher.pScreenDirection(this.screenCoordinates));
        this.distFromCamera = this._getOrElse(distFromCamera, () => rayMarcher.distFromCamera(p));
        this.distFromScene = this._getOrElse(distFromScene, () => sdf(p));
        this.normal = this._getOrElse(normal, () => rayMarcher.sceneNormal(sdf, p));
        this.lightIntensity = this._getOrElse(lightIntensity, () => rayMarcher.lightIntensity(sdf, p, this.normal, light));
        this.visibilityFactor = this._getOrElse(visibilityFactor, () => rayMarcher.visibilityFactor(sdf, rayMarcher.camera, p, this.normal));
    }

    _getOrElse(v, f) {
        if (v !== undefined) {
            return v;
        }
        return f();
    }
}

class RayMarcher {
    // Camera system
    camera;
    lookAt;
    up;
    fovY;
    aspectRatio;
    halfScreenLengthY;

    // Orthonormal basis of the camera system
    u; // pointing to the right
    v; // pointing up
    w; // pointing towards the scene

    constructor(camera, lookAt, up, fovYDegrees, aspectRatio) {
        this.camera = camera;
        this.lookAt = lookAt;
        this.up = up;
        this.fovY = fovYDegrees / 180.0 * Math.PI;
        this.aspectRatio = aspectRatio;
        this.halfScreenLengthY = Math.tan(0.5 * this.fovY);

        this.u = vec3.create();
        this.v = vec3.create();
        this.w = vec3.create();
        vec3.normalize(this.w, vec3.subtract(this.w, this.lookAt, this.camera)); // w = normalize(lookAt - camera)
        vec3.normalize(this.v, vec3.scaleAndAdd(this.v, this.up, this.w, -vec3.dot(this.up, this.w))); // v = normalize(up - dot(up, w) * w)
        vec3.cross(this.u, this.w, this.v); // u = cross(w, v)
    }

    sceneNormal(sdf, p) {
        const h = 0.005;
        const dX = vec3.fromValues(h, 0.0, 0.0);
        const dY = vec3.fromValues(0.0, h, 0.0);
        const dZ = vec3.fromValues(0.0, 0.0, h);

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

    pScreenDirection(screenCoordinates) {
        const p_u = screenCoordinates[0] * this.aspectRatio * this.halfScreenLengthY;
        const p_v = screenCoordinates[1] * this.halfScreenLengthY;
        let pScreenDirection = vec3.create();
        vec3.normalize(
            pScreenDirection,
            vec3.scaleAndAdd(
                pScreenDirection,
                vec3.scaleAndAdd(pScreenDirection, this.w, this.v, p_v),
                this.u,
                p_u
            )
        ); // pScreenDirection = normalize(screenCoord.x * u + screenCoord.y * v + w)
        return pScreenDirection;
    }

    intersectionWithScene(sdf, screenCoordinates, light) { // screenCoordinates \in [-1, 1]^2
        const dir = this.pScreenDirection(screenCoordinates);
        const maxIter = 75;
        const minDist = 0.005;
        let len = 0.0;
        let p = vec3.create();
        for (let i = 0; i < maxIter; i++) {
            vec3.scaleAndAdd(p, this.camera, dir, len); // p = camera + len * dir
            const dist = sdf(p);
            if (dist < minDist) {
                return new ScenePoint({
                    rayMarcher: this,
                    sdf: sdf,
                    light: light,
                    p: p,
                    pScreenDirection: dir,
                    distFromCamera: len,
                    distFromScene: dist,
                    screenCoordinates: screenCoordinates,
                    visibilityFactor: 1.0
                });
            }
            len += dist;
        }
        return undefined;
    }

    visibilityFactor(sdf, eye, p, n = undefined) {
        let dir = vec3.sub(vec3.create(), eye, p);
        if (n !== undefined && vec3.dot(dir, n) < 0.0) { // is the normal pointing away from the eye point?
            return 0.0;
        }

        // if we walk from p towards eye, do we reach eye or hit the scene before?
        const distToEye = vec3.len(dir);
        vec3.normalize(dir, dir);
        const maxIter = 75;
        const minDist = 0.005;
        const penumbra = 48.0;
        let len = 10.0 * minDist;
        let q = vec3.create();
        let closestMissRatio = 1.0;
        for (let i = 0; i < maxIter; i++) {
            if (len >= distToEye) {
                return closestMissRatio;
            }
            vec3.scaleAndAdd(q, p, dir, len); // q = p + len * dir
            const distToScene = sdf(q);
            if (distToScene < minDist) {
                return 0.0;
            }
            closestMissRatio = Math.min(closestMissRatio, penumbra * distToScene / len);
            len += distToScene;
        }
        return 0.0;
    }

    lightIntensity(sdf, p, n, light) {
        const globalIntensity = 0.1;
        let intensity = globalIntensity;
        const visibilityFactor = this.visibilityFactor(sdf, light, p);
        if (visibilityFactor > 0.0) {
            let temp = vec3.create();
            const directIntensity = Math.max(vec3.dot(vec3.normalize(temp, vec3.sub(temp, light, p)), n), 0.0) // = max(dot(normalize(light - p), n), 0.0)
            intensity += (1.0 - intensity) * visibilityFactor * directIntensity;
        }
        return intensity;
    }

    positionRelativeToCamera(p) {
        return vec3.sub(vec3.create(), p, this.camera);
    }

    distFromCamera(p) {
        return vec3.len(this.positionRelativeToCamera(p));
    }

    cameraSystemCoordinates(p) {
        let pRelative = this.positionRelativeToCamera(p);
        return vec3.fromValues(
            vec3.dot(pRelative, this.u),
            vec3.dot(pRelative, this.v),
            vec3.dot(pRelative, this.w)
        );
    }

    screenCoordinates(cameraSystemCoordinates) {
        return vec2.fromValues(
            (cameraSystemCoordinates[0] / cameraSystemCoordinates[2]) / (this.aspectRatio * this.halfScreenLengthY),
            (cameraSystemCoordinates[1] / cameraSystemCoordinates[2]) / this.halfScreenLengthY
        );
    }

    screenCoordinatesToCanvas(canvasDim, screenCoordinates) {
        return vec2.fromValues( // invert the sign of the y coordinate because the origin in svg is at the top left
            canvasDim[0] * 0.5 * (screenCoordinates[0] + 1.0),
            canvasDim[1] * 0.5 * (-screenCoordinates[1] + 1.0)
        );
    }
}


function sdSphere(p, c, r) {
    return vec3.len(vec3.sub(vec3.create(), p, c)) - r;
}

function sdTorus(p, c, r) {
    let q = vec2.fromValues(p[1], vec2.len(vec2.fromValues(p[0], p[2]))); // q = vec2(p.y, length(p.xz))
    return vec2.len(vec2.sub(q, q, c)) - r; // = length(q - c) - r
}

function sdPlane(p, y) {
    return Math.abs(p[1] - y);
}

function distanceToScene(p) {
    return Math.min(
        sdTorus(p, vec2.fromValues(0.0, 1.0), 0.5),
        sdSphere(p, vec3.fromValues(1.0, -1.5, 0.0), 0.5),
        sdSphere(p, vec3.fromValues(-1.0, 1.5, 0.0), 0.25),
        sdPlane(p, -2.0)
    );
}

function drawPolyLine(svg, points) {
    if (points.length > 1) {
        const roundedPoints = points.map(ps => ps.map(v => v.toFixed(2)));
        svg.polyline(roundedPoints).fill('none').stroke({ width: 1, color: '#f06', linecap: 'round', linejoin: 'round' });
    }
}

function drawHatchLine(svg, canvasDim, rayMarcher, sdf, light, pScene, stepCount, stepScale, rng) {
    const canvasStart = rayMarcher.screenCoordinatesToCanvas(canvasDim, pScene.screenCoordinates)
    let polyLinePoints = [[canvasStart[0], canvasStart[1]]];
    let pPrev = pScene;
    for (let i = 0; i < stepCount; i++) {
        let toLight = vec3.sub(vec3.create(), light, pPrev.p);
        const normalComponent = vec3.dot(pPrev.normal, toLight);
        vec3.scaleAndAdd(toLight, toLight, pPrev.normal, -normalComponent);

        let surfaceDir = vec3.create();
        vec3.normalize(surfaceDir, vec3.cross(surfaceDir, pPrev.normal, toLight));
        const pWalk = new ScenePoint({
            rayMarcher: rayMarcher,
            sdf: sdf,
            light: light,
            p: vec3.scaleAndAdd(vec3.create(), pPrev.p, surfaceDir, stepScale)
        });
        if (Math.pow(pWalk.lightIntensity, 3.0) * i / stepCount > rng()) {
            break;
        }
        if (pWalk.visibilityFactor > 0.0) {
            const canvasWalk = rayMarcher.screenCoordinatesToCanvas(canvasDim, pWalk.screenCoordinates);
            polyLinePoints.push([canvasWalk[0], canvasWalk[1]]);
        }
        else {
            drawPolyLine(svg, polyLinePoints);
            polyLinePoints = [];
        }
        pPrev = pWalk;
    }
    drawPolyLine(svg, polyLinePoints);
}

function onJitteredGrid(canvasDim, cellSize, rng, f) {
    const xCount = canvasDim[0] / cellSize;
    const yCount = canvasDim[1] / cellSize;

    for (let ix = 0; ix < xCount; ix++) {
        for (let iy = 0; iy < yCount; iy++) {
            const xJittered = (ix + rng()) * cellSize;
            const yJittered = (iy + rng()) * cellSize;
            f(xJittered, yJittered);
        }
    }

}

const canvasDim = vec2.fromValues(800, 600);
let draw = SVG().addTo('body').size(canvasDim[0], canvasDim[1]);

const camera   = vec3.fromValues(0.0, 2.0, 5.0);
const lookAt   = vec3.fromValues(0.0, 0.0, 0.0);
const up       = vec3.fromValues(0.0, 1.0, 0.0);
let rayMarcher = new RayMarcher(camera, lookAt, up, 50, canvasDim[0] / canvasDim[1]);

let light = vec3.fromValues(3.5, 20.0, 5.0);

onJitteredGrid(canvasDim, 4.0, rng, (x, y) => {
    const screenCoordinates = vec2.fromValues(
        2.0 * x / canvasDim[0] - 1.0,
        2.0 * y / canvasDim[1] - 1.0
    );
    let pScene = rayMarcher.intersectionWithScene(distanceToScene, screenCoordinates, light);
    if (pScene !== undefined && pScene.lightIntensity < rng()) {
        const walkingSteps = 5 + pScene.lightIntensity * 80;
        const walkingDist = 0.01;
        drawHatchLine(draw, canvasDim, rayMarcher, distanceToScene, light, pScene, walkingSteps, walkingDist, rng);
        drawHatchLine(draw, canvasDim, rayMarcher, distanceToScene, light, pScene, walkingSteps, -walkingDist, rng);
    }
});
