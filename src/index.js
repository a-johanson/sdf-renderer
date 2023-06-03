import { SVG } from '@svgdotjs/svg.js';
import { glMatrix, vec2, vec3 } from 'gl-matrix/esm/index.js';
import * as seedrandom from 'seedrandom/index.js';

import { ScenePoint, RayMarcher } from './ray_marching.js'
import {
    opShift,
    opRotateY,
    opRotateZ,
    opRepeatFinite,
    opElongateZ,
    sdBox,
    sdCylinder,
    sdCylinderRounded
} from './sdf_primitives.js'


// --- Setup

let rng = seedrandom('so many colorful shapes -- it is rrreally beautiful!');
glMatrix.setMatrixArrayType(Array);


// --- Scene

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
    const sd_roundedTop = sdCylinderRounded(p_elongated, radius, height, 0.15);
    const sd_sharpBottom = sdCylinder(opShift(p_elongated, vec3.fromValues(0.0, -0.5 * height, 0.0)), radius, 0.5 * height);
    const sd_stack = sdCylinder(opElongateZ(p_repeated, stretch), radius, height);
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


// --- Drawing hatch lines by walking on the SDF = 0 iso-surface

function drawPolyLine(svg, points, color) {
    if (points.length > 1) {
        const roundedPoints = points.map(ps => ps.map(v => v.toFixed(2)));
        svg.polyline(roundedPoints).fill('none').stroke({ width: 1, color: color, linecap: 'round', linejoin: 'round' });
    }
}

function randomLineColor(rng) {
    const palette = [
        '#050d1a',
        '#050d1a',
        '#15273f',
        '#15273f',
        '#15273f',
        '#456685',
        '#b3c4d4',
        '#d11f25'
    ];
    return palette[Math.floor(rng() * palette.length)];
}

function drawHatchLine(svg, canvasDim, rayMarcher, sdf, light, pScene, stepCount, stepScale, hatchAngle, rng) {
    const color = randomLineColor(rng);
    const canvasStart = rayMarcher.screenCoordinatesToCanvas(canvasDim, pScene.screenCoordinates);
    let polyLinePoints = [[canvasStart[0], canvasStart[1]]];
    const cosHatchAngle = Math.cos(hatchAngle);
    const sinHatchAngle = Math.sin(hatchAngle);
    let pPrev = pScene;
    for (let i = 0; i < stepCount; i++) {
        // Construct an orthonormal basis (u, v) of the plane defined by pPrev.normal
        let v = vec3.sub(vec3.create(), light, pPrev.p);
        vec3.normalize(v, v);
        const normalComponent = vec3.dot(pPrev.normal, v);
        vec3.scaleAndAdd(v, v, pPrev.normal, -normalComponent);
        const v_len = vec3.len(v);
        if (v_len < 1.0e-8) {
            console.log("v_len < 1.0e-8");
            break;
        }
        vec3.scale(v, v, 1.0 / v_len);
        let u = vec3.create();
        vec3.normalize(u, vec3.cross(u, pPrev.normal, v));

        let surfaceDir = vec3.create();
        vec3.scale(surfaceDir, u, cosHatchAngle);
        vec3.scaleAndAdd(surfaceDir, surfaceDir, v, sinHatchAngle);
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
            drawPolyLine(svg, polyLinePoints, color);
            polyLinePoints = [];
        }
        pPrev = pWalk;
    }
    drawPolyLine(svg, polyLinePoints, color);
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

// --- Set up the renderer and draw the scene

const canvasDim = vec2.fromValues(800, 1047);
let draw = SVG().addTo('body').size(canvasDim[0], canvasDim[1]);

const angleCamera = (90.0 - 43.0) / 180.0 * Math.PI;
const cameraDir   = vec3.fromValues(-Math.sin(angleCamera), 0.0, -Math.cos(angleCamera));
const camera      = vec3.scaleAndAdd(vec3.create(), vec3.fromValues(0.0, -3.5, 0.0), cameraDir,  -7.5);
const lookAt      = vec3.fromValues(0.0, 2.0, 1.13);
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
        const hatchAngle = (180.0 - 32.0) * Math.PI / 180.0;
        drawHatchLine(draw, canvasDim, rayMarcher, distanceToScene, light, pScene, walkingSteps, walkingDist, hatchAngle, rng);
        drawHatchLine(draw, canvasDim, rayMarcher, distanceToScene, light, pScene, walkingSteps, -walkingDist, hatchAngle, rng);
    }
});

// --- Download the output SVG image to a file (as described in https://stackoverflow.com/a/38019175)

var svgData = draw.svg();
var svgBlob = new Blob([svgData], { type:"image/svg+xml;charset=utf-8" });
var svgUrl = URL.createObjectURL(svgBlob);
var downloadLink = document.createElement("a");
downloadLink.href = svgUrl;
downloadLink.download = "cromwell.svg";
document.body.appendChild(downloadLink);
downloadLink.click();
document.body.removeChild(downloadLink);
