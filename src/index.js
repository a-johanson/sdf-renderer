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

function sdBox(p, s) {
    let q = vec3.fromValues(
        Math.abs(p[0]) - s[0],
        Math.abs(p[1]) - s[1],
        Math.abs(p[2]) - s[2]
    ); // q = abs(p) - s
    return vec3.len(vec3.max(vec3.create(), q, vec3.fromValues(0.0, 0.0, 0.0))) + Math.min(Math.max(q[0], q[1], q[2]), 0.0); // = length(max(q, 0)) + min(max(q.x, q.y, q.z), 0);
}

function opElongateZ(p, h) {
    const qz = Math.max(Math.abs(p[2]) - h, 0.0);
    return vec3.fromValues(p[0], p[1], qz);
}

function opRepeatFinite(p, s, lim_a, lim_b) {
    let t = vec3.create();
    vec3.div(t, p, s);
    vec3.round(t, t);
    vec3.max(t, t, lim_a);
    vec3.min(t, t, lim_b);
    vec3.mul(t, t, s);
    vec3.sub(t, p, t);
    return t; // = p - s * clamp(round(p/s), lim_a, lim_b)
}

function opShift(p, d) {
    return vec3.sub(vec3.create(), p, d);
}

function opRotateY(p, phi) {
    const cosPhi = Math.cos(-phi);
    const sinPhi = Math.sin(-phi);
    return vec3.fromValues(
        cosPhi * p[0] + sinPhi * p[2],
        p[1],
        -sinPhi * p[0] + cosPhi * p[2]
    );
}

function opRotateZ(p, phi) {
    const cosPhi = Math.cos(-phi);
    const sinPhi = Math.sin(-phi);
    return vec3.fromValues(
        cosPhi * p[0] + sinPhi * p[1],
        -sinPhi * p[0] + cosPhi * p[1],
        p[2]
    );
}

function sdCylinderV(p, r, h) {
    const len_xz      = Math.sqrt(p[0]*p[0] + p[2]*p[2]);
    const d_xz        = len_xz  - r;
    const d_y         = Math.abs(p[1]) - h;
    const d_xz_clamp  = Math.max(d_xz, 0.0);
    const d_y_clamp   = Math.max(d_y, 0.0);
    const len_d_clamp = Math.sqrt(d_xz_clamp*d_xz_clamp + d_y_clamp * d_y_clamp);
    return Math.min(Math.max(d_xz, d_y), 0.0) + len_d_clamp;
}

function sdCylinderVRound(p, r, h, d) {
    return sdCylinderV(p, r - d, h - d) - d;
}

function sdStackedPillar(p) {
    const stretch = 1.13;
    const height = 0.55;
    const radius = 1.0;
    const p_elongated = opElongateZ(p, stretch);
    const p_repeated = opRepeatFinite(
        p,
        vec3.fromValues(1.0, 2.0 * (height + 0.025), 1.0),
        vec3.fromValues(0.0, -5.0, 0.0),
        vec3.fromValues(0.0, -1.0, 0.0)
    );
    const sd_roundedTop = sdCylinderVRound(p_elongated, radius, height, 0.15);
    const sd_sharpBottom = sdCylinderV(opShift(p_elongated, vec3.fromValues(0.0, -0.5 * height, 0.0)), radius, 0.5 * height);
    const sd_stack = sdCylinderV(opElongateZ(p_repeated, stretch), radius, height);
    return Math.min(sd_roundedTop, sd_sharpBottom, sd_stack);
}

function sdCromwellBalcony(p, windowLedgeHeight, balconyHalfLength) {
    const balconyHalfHeight = 0.5 * (windowLedgeHeight + 0.18);
    return Math.max(
        Math.min(
            sdBox(p, vec3.fromValues(1.0, 0.5 * windowLedgeHeight, balconyHalfLength)),
            sdBox(
                opRotateZ(opShift(p, vec3.fromValues(1.05, windowLedgeHeight - 0.1, 0.0)), 28.0 * Math.PI / 180.0),
                vec3.fromValues(0.5 * 0.6 * windowLedgeHeight, 0.5 * 2.1 * windowLedgeHeight, balconyHalfLength)
            )
        ),
        sdBox(opShift(p, vec3.fromValues(0.0, balconyHalfHeight - 0.5 * windowLedgeHeight, 0.0)), vec3.fromValues(1.25, balconyHalfHeight, balconyHalfLength)),
    );
}

function sdCromwellTower(p) {
    const pillarHalfSide = 0.5 * 0.9;
    const pillarHalfHeight = 0.5 * 0.55 * 4 * 20.5;
    const pillarSpacing = 2.77;
    const p_repeatedPillars = opRepeatFinite(
        opShift(p, vec3.fromValues(0.0, pillarHalfHeight, 0.0)),
        vec3.fromValues(1.0, 1.0, pillarSpacing),
        vec3.fromValues(0.0, 0.0, -2.0),
        vec3.fromValues(0.0, 0.0, 2.0)
    );
    const pillars = sdBox(p_repeatedPillars, vec3.fromValues(pillarHalfSide, pillarHalfHeight, pillarHalfSide));

    const storyHeight = 0.895;
    const windowLedgeHeight = 0.23;
    const windows = sdBox(
        opShift(p, vec3.fromValues(-1.0 * pillarHalfSide, pillarHalfHeight, 0.0)),
        vec3.fromValues(pillarHalfSide, pillarHalfHeight - storyHeight, 0.5 * 4.0 * pillarSpacing)
    );

    const halfStoryCount = 21.0;
    const p_repeatedWindowLedges = opRepeatFinite(
        opShift(p, vec3.fromValues(-0.25 * pillarHalfSide, pillarHalfHeight, 0.0)),
        vec3.fromValues(1.0, storyHeight, 1.0),
        vec3.fromValues(0.0, -halfStoryCount, 0.0),
        vec3.fromValues(0.0, halfStoryCount, 0.0)
    );
    const windowLedges = sdBox(
        p_repeatedWindowLedges,
        vec3.fromValues(pillarHalfSide, 0.5 * windowLedgeHeight, 0.5 * 4.0 * pillarSpacing)
    );

    const smallLedgeHeight = 0.6 * windowLedgeHeight;
    const smallLedgeWidth = 3.44;
    const p_repeatedSmallLedges = opRepeatFinite(
        opShift(p, vec3.fromValues(-0.25 * pillarHalfSide, pillarHalfHeight - (windowLedgeHeight - smallLedgeHeight), 2.0 * pillarSpacing + 0.5 * smallLedgeWidth)),
        vec3.fromValues(1.0, storyHeight, 1.0),
        vec3.fromValues(0.0, -halfStoryCount, 0.0),
        vec3.fromValues(0.0, halfStoryCount + 1.0, 0.0)
    );
    const smallLedges = sdBox(
        p_repeatedSmallLedges,
        vec3.fromValues(pillarHalfSide, 0.5 * smallLedgeHeight, 0.5 * smallLedgeWidth)
    );

    const wallAngle = -38.0 * Math.PI / 180.0;
    const p_wallShifted = opShift(p, vec3.fromValues(0.0, pillarHalfHeight, 2.0 * pillarSpacing + smallLedgeWidth));
    const p_wallRotated = opRotateY(p_wallShifted, wallAngle);
    const balconyWall = Math.max(
        sdBox(p_wallRotated, vec3.fromValues(2.5, pillarHalfHeight + storyHeight, 0.25)),
        sdBox(p_wallShifted, vec3.fromValues(1.75, pillarHalfHeight + storyHeight, 2.0))
    );

    const balconyHalfLength = 0.5 * 1.95 * pillarSpacing;
    const p_shiftBalconies = opShift(p, vec3.fromValues(0.5 * 1.75 - 0.15, pillarHalfHeight, 2.0 * pillarSpacing + smallLedgeWidth + balconyHalfLength + 1.15));
    const p_repeatedBalconies = opRepeatFinite(
        p_shiftBalconies,
        vec3.fromValues(1.0, storyHeight, 1.0),
        vec3.fromValues(0.0, -halfStoryCount, 0.0),
        vec3.fromValues(0.0, halfStoryCount + 1.0, 0.0)
    );
    const balconies = Math.max(
        sdCromwellBalcony(p_repeatedBalconies, windowLedgeHeight, balconyHalfLength),
        sdBox(
            opRotateY(opShift(p_repeatedBalconies, vec3.fromValues(0.0, 0.0, -1.25)), wallAngle),
            vec3.fromValues(3.5, storyHeight, balconyHalfLength - 0.4)
        )
    );

    const p_shiftSideBalconies = opShift(p, vec3.fromValues(0.0, pillarHalfHeight, -2.0 * pillarSpacing));
    const p_repeatedSideBalconies = opRepeatFinite(
        p_shiftSideBalconies,
        vec3.fromValues(1.0, storyHeight, 1.0),
        vec3.fromValues(0.0, -halfStoryCount, 0.0),
        vec3.fromValues(0.0, halfStoryCount, 0.0)
    );
    const p_rotatedSideBalconies = opRotateY(p_repeatedSideBalconies, Math.PI * 0.5);
    const sideBalconies = sdCromwellBalcony(p_rotatedSideBalconies, windowLedgeHeight, pillarHalfSide);

    return Math.min(pillars, windows, windowLedges, smallLedges, balconyWall, balconies, sideBalconies);
}

function distanceToScene(p) {
    const p_repeated = opRepeatFinite(
        p,
        vec3.fromValues(3.9, 1.0, 1.0),
        vec3.fromValues(-2.0, 0.0, 0.0),
        vec3.fromValues(1.0, 0.0, 0.0)
    );
    const sd_pillars = sdStackedPillar(p_repeated);
    const shiftScale = 1.15;
    const p_shifted = opShift(p, vec3.fromValues(-16.0 * shiftScale, 0.0, -16.5 * shiftScale));
    const sd_tower = sdCromwellTower(p_shifted);
    return Math.min(sd_pillars, sd_tower);
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

const canvasDim = vec2.fromValues(800, 1047);
let draw = SVG().addTo('body').size(canvasDim[0], canvasDim[1]);

const angleCamera = (90.0 - 43.0) / 180.0 * Math.PI;
const cameraDir   = vec3.fromValues(-Math.sin(angleCamera), 0.0, -Math.cos(angleCamera));
const camera      = vec3.scaleAndAdd(vec3.create(), vec3.fromValues(0.0, -3.5, 0.0), cameraDir,  -7.5);
const lookAt      = vec3.fromValues(0.0, 2.0, 1.13);
// const camera      = vec3.fromValues(-5.0, 40.0, -21.5);
// const lookAt      = vec3.fromValues(-16.0, 10.0, -21.5);
// const camera      = vec3.fromValues(1.0, 0.0, 5.0);
// const lookAt      = vec3.fromValues(1.0, 0.0, 0.0);
const up          = vec3.fromValues(0.0, 1.0, 0.0);
let rayMarcher    = new RayMarcher(camera, lookAt, up, 1.5 * 38.0, canvasDim[0] / canvasDim[1]);

let light = vec3.fromValues(5.0e2, 3.3e2, -5.0);

onJitteredGrid(canvasDim, 4.0, rng, (x, y) => {
    const screenCoordinates = vec2.fromValues(
        2.0 * x / canvasDim[0] - 1.0,
        2.0 * y / canvasDim[1] - 1.0
    );
    let pScene = rayMarcher.intersectionWithScene(distanceToScene, screenCoordinates, light);
    if (pScene !== undefined && pScene.lightIntensity < rng()) {
        const distanceScalingFactor = Math.min(Math.max(Math.pow(pScene.distFromCamera, 2.0) / 64.0, 0.8), 3.0);
        const walkingSteps = (5 + pScene.lightIntensity * 80) * distanceScalingFactor;
        const walkingDist = 0.01;
        drawHatchLine(draw, canvasDim, rayMarcher, distanceToScene, light, pScene, walkingSteps, walkingDist, rng);
        drawHatchLine(draw, canvasDim, rayMarcher, distanceToScene, light, pScene, walkingSteps, -walkingDist, rng);
    }
});
