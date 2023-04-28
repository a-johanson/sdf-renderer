import { SVG } from '@svgdotjs/svg.js';
import { glMatrix, vec2, vec3 } from 'gl-matrix/esm/index.js';

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
    isVisible;

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
        isVisible = undefined
    }) {
        this.p = p;
        this.p_uvw = this._getOrElse(p_uvw, () => rayMarcher.cameraSystemCoordinates(p));
        this.screenCoordinates = this._getOrElse(screenCoordinates, () => rayMarcher.screenCoordinates(this.p_uvw));
        this.pScreenDirection = this._getOrElse(pScreenDirection, () => rayMarcher.pScreenDirection(this.screenCoordinates));
        this.distFromCamera = this._getOrElse(distFromCamera, () => rayMarcher.distFromCamera(p));
        this.distFromScene = this._getOrElse(distFromScene, () => sdf(p));
        this.normal = this._getOrElse(normal, () => rayMarcher.sceneNormal(sdf, p));
        this.lightIntensity = this._getOrElse(lightIntensity, () => rayMarcher.lightIntensity(p, this.normal, light));
        this.isVisible = this._getOrElse(isVisible, () => rayMarcher.isVisible(sdf, p));
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
    u;
    v;
    w;

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
        vec3.normalize(pScreenDirection,
            vec3.scaleAndAdd(
                pScreenDirection,
                vec3.scaleAndAdd(pScreenDirection, this.w, this.v, p_v),
                this.u,
                p_u
            )
        ); // pScreenDirection = screenCoord.x * u + screenCoord.y * v + w
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
                    isVisible: true
                });
            }
            len += dist;
        }
        return undefined;
    }

    isVisible(sdf, p) {
        return true;
    }

    lightIntensity(p, n, light) {
        return Math.max(vec3.dot(light, n), 0.0); // = max(dot(light, n), 0.0)
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
        return vec2.fromValues(
            canvasDim[0] * 0.5 * (screenCoordinates[0] + 1.0),
            canvasDim[1] * 0.5 * (screenCoordinates[1] + 1.0)
        );
    }
}


const canvasDim = vec2.fromValues(800, 600);
let draw = SVG().addTo('body').size(canvasDim[0], canvasDim[1]);

const camera   = vec3.fromValues(0.0, 0.0, 5.0);
const lookAt   = vec3.fromValues(0.0, 0.0, 0.0);
const up       = vec3.fromValues(0.0, 1.0, 0.0);
let rayMarcher = new RayMarcher(camera, lookAt, up, 30, canvasDim[0] / canvasDim[1]);

let light = vec3.normalize(vec3.create(), vec3.fromValues(1.0, 1.0, 1.0));

function distanceToScene(p) {
    return vec3.len(p) - 1.0;
}

const tileCount = vec2.fromValues(20, 15);
for (let ix = 0; ix < tileCount[0]; ix++) {
    for (let iy = 0; iy < tileCount[1]; iy++) {
        const screenCoordinates = vec2.fromValues(
            2.0 * ix / tileCount[0] - 1.0,
            2.0 * iy / tileCount[1] - 1.0,
        );
        let pScene = rayMarcher.intersectionWithScene(distanceToScene, screenCoordinates, light);
        if (pScene !== undefined) {
            const walkingSteps = 15;
            const walkingDist = 0.04;
            let pPrev = pScene;
            let prevCanvasCoordinates = rayMarcher.screenCoordinatesToCanvas(canvasDim, screenCoordinates);
            for (let i = 0; i < walkingSteps; i++) {
                let surfaceDir = vec3.create();
                vec3.normalize(surfaceDir, vec3.cross(surfaceDir, pPrev.normal, light));
                const pWalk = new ScenePoint({
                    rayMarcher: rayMarcher,
                    sdf: distanceToScene,
                    light: light,
                    p: vec3.scaleAndAdd(vec3.create(), pPrev.p, surfaceDir, walkingDist)
                });
                const walkCanvasCoordinates = rayMarcher.screenCoordinatesToCanvas(canvasDim, pWalk.screenCoordinates);
                if (pWalk.isVisible) {
                    draw.line(prevCanvasCoordinates[0], prevCanvasCoordinates[1], walkCanvasCoordinates[0], walkCanvasCoordinates[1]).stroke('#f06');
                    // draw.circle(2).move(prevCanvasCoordinates[0], prevCanvasCoordinates[1]).fill('#f06');
                }
                pPrev = pWalk;
                prevCanvasCoordinates = walkCanvasCoordinates;
            }
        }
    }
}
