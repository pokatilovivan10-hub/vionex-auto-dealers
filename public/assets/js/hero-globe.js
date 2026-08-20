const canvas = document.querySelector('[data-premium-globe]');
const stage = document.querySelector('[data-hero-visual]');

if (canvas && stage) {
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroRoot = canvas.closest('.hero-premium');
  const animationEnabled = heroRoot?.dataset.globeAnimation !== 'false';
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const TAU = Math.PI * 2;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const deg = (value) => value * Math.PI / 180;

  function mulberry32(seed) {
    return function random() {
      let value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  const random = mulberry32(20260801);
  const stars = [];
  const dust = [];
  const landPoints = [];
  const networkNodes = [];
  const networkEdges = [];

  const routes = [
    [[-74, 40], [-0.1, 51.5]],
    [[-0.1, 51.5], [37.6, 55.7]],
    [[37.6, 55.7], [77.2, 28.6]],
    [[77.2, 28.6], [103.8, 1.3]],
    [[103.8, 1.3], [151.2, -33.8]],
    [[-46.6, -23.5], [18.4, -33.9]],
    [[2.35, 48.85], [55.3, 25.2]],
  ].map(([from, to], index) => ({ from, to, speed: .045 + index * .006, offset: index / 7 }));

  function wrapLon(value) {
    let result = value;
    while (result > 180) result -= 360;
    while (result < -180) result += 360;
    return result;
  }

  function ellipse(lon, lat, cx, cy, rx, ry, rotation = 0) {
    const x = wrapLon(lon - cx);
    const y = lat - cy;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    return (xr * xr) / (rx * rx) + (yr * yr) / (ry * ry) <= 1;
  }

  function isLand(lon, lat) {
    const continents =
      ellipse(lon, lat, -105, 49, 35, 25, -.12) ||
      ellipse(lon, lat, -84, 24, 22, 13, .2) ||
      ellipse(lon, lat, -58, -18, 19, 34, -.2) ||
      ellipse(lon, lat, -71, -47, 10, 16, -.28) ||
      ellipse(lon, lat, 10, 50, 22, 13, .05) ||
      ellipse(lon, lat, 22, 7, 24, 35, -.05) ||
      ellipse(lon, lat, 72, 45, 57, 25, -.08) ||
      ellipse(lon, lat, 111, 19, 32, 21, .12) ||
      ellipse(lon, lat, 135, -25, 20, 14, -.12) ||
      ellipse(lon, lat, -42, 72, 13, 11, 0);

    if (!continents) return false;

    const holes =
      ellipse(lon, lat, -94, 43, 10, 6, 0) ||
      ellipse(lon, lat, 26, 24, 7, 12, 0) ||
      ellipse(lon, lat, 81, 48, 13, 7, 0) ||
      ellipse(lon, lat, 100, 8, 8, 11, .3) ||
      ellipse(lon, lat, -66, -5, 6, 8, 0);

    const coastNoise = Math.sin(deg(lon * 4.8 + lat * 1.7)) * .5 + Math.cos(deg(lat * 6.2 - lon * 1.4)) * .5;
    return !holes && coastNoise > -.74;
  }

  function spherical(lon, lat) {
    const lambda = deg(lon);
    const phi = deg(lat);
    const cosPhi = Math.cos(phi);
    return {
      x: cosPhi * Math.cos(lambda),
      y: Math.sin(phi),
      z: cosPhi * Math.sin(lambda),
      lon,
      lat,
    };
  }

  for (let lat = -72; lat <= 76; lat += 3.45) {
    for (let lon = -180; lon < 180; lon += 3.45) {
      const jitterLon = lon + (random() - .5) * 2.15;
      const jitterLat = lat + (random() - .5) * 1.95;
      if (!isLand(jitterLon, jitterLat)) continue;
      if (random() < .16) continue;
      landPoints.push({ ...spherical(jitterLon, jitterLat), size: .58 + random() * 1.35, phase: random() * TAU });
    }
  }

  const majorCities = [
    [-74, 40.7], [-118.2, 34], [-46.6, -23.5], [-0.1, 51.5], [2.35, 48.85],
    [13.4, 52.5], [37.6, 55.7], [28.9, 41], [31.2, 30], [55.3, 25.2],
    [77.2, 28.6], [72.9, 19.1], [103.8, 1.3], [116.4, 39.9], [139.7, 35.7],
    [126.9, 37.5], [151.2, -33.8], [18.4, -33.9], [3.4, 6.5], [36.8, -1.3],
  ];

  majorCities.forEach(([lon, lat], index) => {
    networkNodes.push({ ...spherical(lon, lat), pulse: random() * TAU, major: index < 8 || index % 3 === 0 });
  });

  for (let i = 0; i < networkNodes.length; i += 1) {
    const distances = [];
    for (let j = i + 1; j < networkNodes.length; j += 1) {
      const a = networkNodes[i];
      const b = networkNodes[j];
      const dot = clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
      const angle = Math.acos(dot);
      if (angle < 1.35) distances.push({ j, angle });
    }
    distances.sort((a, b) => a.angle - b.angle).slice(0, 2).forEach(({ j }) => networkEdges.push([i, j]));
  }

  let width = 1;
  let height = 1;
  let dpr = 1;
  let centerX = 0;
  let centerY = 0;
  let radius = 1;
  let yaw = -.4;
  let pitch = -.13;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let running = true;
  let visible = true;
  let animationFrame = 0;
  let lastTime = performance.now();
  let elapsed = 0;

  function populateParticles() {
    stars.length = 0;
    dust.length = 0;
    const starCount = coarsePointer ? 75 : 150;
    const dustCount = coarsePointer ? 24 : 48;
    for (let index = 0; index < starCount; index += 1) {
      stars.push({
        x: random(), y: random(), size: .35 + random() * 1.25,
        alpha: .12 + random() * .62, phase: random() * TAU, speed: .2 + random() * .55,
      });
    }
    for (let index = 0; index < dustCount; index += 1) {
      dust.push({
        x: random(), y: random(), size: .2 + random() * .55,
        alpha: .08 + random() * .22, drift: (random() - .5) * .00005,
      });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.45 : 1.8);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centerX = width * (width < 520 ? .51 : .53);
    centerY = height * .49;
    radius = Math.min(width * .39, height * .42);
    populateParticles();
    drawFrame(performance.now(), true);
  }

  function palette() {
    const light = document.documentElement.dataset.theme === 'light';
    return light ? {
      light: true,
      star: [66, 82, 153],
      sphereDeep: 'rgba(114,151,242,.20)',
      sphereMid: 'rgba(122,171,255,.14)',
      sphereLight: 'rgba(255,255,255,.86)',
      grid: [82, 89, 202],
      gridFront: [78, 97, 233],
      land: [61, 105, 226],
      landHot: [116, 82, 242],
      edge: [91, 117, 255],
      cyan: [38, 168, 210],
      route: [112, 79, 236],
      shadow: 'rgba(67,87,166,.14)',
    } : {
      light: false,
      star: [187, 196, 255],
      sphereDeep: 'rgba(6,11,35,.88)',
      sphereMid: 'rgba(25,53,144,.26)',
      sphereLight: 'rgba(72,127,255,.22)',
      grid: [134, 142, 255],
      gridFront: [117, 169, 255],
      land: [127, 153, 255],
      landHot: [182, 109, 255],
      edge: [104, 151, 255],
      cyan: [83, 225, 242],
      route: [159, 100, 255],
      shadow: 'rgba(0,0,0,.54)',
    };
  }

  function rotatePoint(point, localYaw = yaw, localPitch = pitch) {
    const cosY = Math.cos(localYaw);
    const sinY = Math.sin(localYaw);
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const cosP = Math.cos(localPitch);
    const sinP = Math.sin(localPitch);
    const y2 = point.y * cosP - z1 * sinP;
    const z2 = point.y * sinP + z1 * cosP;
    return { x: x1, y: y2, z: z2 };
  }

  function project(point, localYaw = yaw, localPitch = pitch, scale = 1) {
    const rotated = rotatePoint(point, localYaw, localPitch);
    return {
      x: centerX + rotated.x * radius * scale + pointerX * 13,
      y: centerY - rotated.y * radius * scale + pointerY * 9,
      z: rotated.z,
      visible: rotated.z > -.055,
    };
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function drawStars(colors, time) {
    ctx.save();
    for (const star of stars) {
      const twinkle = .55 + Math.sin(time * .001 * star.speed + star.phase) * .36;
      const x = star.x * width + pointerX * (10 + star.size * 4);
      const y = star.y * height + pointerY * (7 + star.size * 3);
      const edgeFeatherX = clamp(Math.min(x, width - x) / Math.max(1, width * .14), 0, 1);
      const edgeFeatherY = clamp(Math.min(y, height - y) / Math.max(1, height * .12), 0, 1);
      const edgeFeather = colors.light ? edgeFeatherX * edgeFeatherY : 1;
      ctx.globalAlpha = star.alpha * twinkle * edgeFeather;
      ctx.fillStyle = rgba(colors.star, 1);
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, TAU);
      ctx.fill();
      if (star.size > 1.15 && twinkle > .72) {
        ctx.globalAlpha = star.alpha * .25;
        ctx.fillRect(x - star.size * 3, y - .25, star.size * 6, .5);
        ctx.fillRect(x - .25, y - star.size * 3, .5, star.size * 6);
      }
    }
    ctx.globalAlpha = 1;
    for (const particle of dust) {
      particle.x += particle.drift;
      if (particle.x > 1.05) particle.x = -.05;
      if (particle.x < -.05) particle.x = 1.05;
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = rgba(colors.star, 1);
      ctx.fillRect(particle.x * width, particle.y * height, particle.size, particle.size);
    }
    ctx.restore();
  }

  function drawAmbient(colors) {
    // In the light theme the ambient glow must fade before the transparent
    // canvas boundary; otherwise the canvas rectangle becomes visible.
    const ambientRadius = radius * (colors.light ? 1.34 : 1.75);
    const outer = ctx.createRadialGradient(centerX, centerY, radius * .25, centerX, centerY, ambientRadius);
    outer.addColorStop(0, colors.light ? 'rgba(101,141,255,.13)' : 'rgba(39,80,219,.19)');
    outer.addColorStop(.45, colors.light ? 'rgba(127,98,255,.055)' : 'rgba(97,65,244,.08)');
    if (colors.light) outer.addColorStop(.78, 'rgba(118,116,236,.012)');
    outer.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ambientRadius, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY + radius * .78);
    ctx.scale(1, .18);
    const ground = ctx.createRadialGradient(0, 0, radius * .12, 0, 0, radius * 1.05);
    ground.addColorStop(0, colors.light ? 'rgba(90,112,235,.19)' : 'rgba(77,75,255,.24)');
    ground.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.06, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawSphereBase(colors) {
    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = colors.light ? 34 : 54;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    const sphere = ctx.createRadialGradient(
      centerX - radius * .34,
      centerY - radius * .36,
      radius * .05,
      centerX + radius * .12,
      centerY + radius * .08,
      radius * 1.08,
    );
    sphere.addColorStop(0, colors.sphereLight);
    sphere.addColorStop(.22, colors.sphereMid);
    sphere.addColorStop(.68, colors.sphereDeep);
    sphere.addColorStop(1, colors.light ? 'rgba(187,207,255,.18)' : 'rgba(2,5,19,.98)');
    ctx.fillStyle = sphere;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.clip();
    const night = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
    night.addColorStop(0, colors.light ? 'rgba(255,255,255,.1)' : 'rgba(71,124,255,.12)');
    night.addColorStop(.42, 'rgba(0,0,0,0)');
    night.addColorStop(1, colors.light ? 'rgba(85,105,195,.12)' : 'rgba(0,0,13,.58)');
    ctx.fillStyle = night;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function drawCurve(points, color, lineWidth = 1, shadow = 0) {
    if (points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (shadow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = shadow;
    }
    ctx.beginPath();
    let started = false;
    for (const point of points) {
      if (!point.visible) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGraticule(colors) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - .5, 0, TAU);
    ctx.clip();

    for (let lat = -60; lat <= 60; lat += 15) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 4) points.push(project(spherical(lon, lat)));
      drawCurve(points, rgba(colors.grid, colors.light ? .17 : .16), .72);
    }

    for (let lon = -165; lon < 180; lon += 15) {
      const points = [];
      for (let lat = -88; lat <= 88; lat += 3) points.push(project(spherical(lon, lat)));
      drawCurve(points, rgba(colors.grid, colors.light ? .16 : .145), .72);
    }
    ctx.restore();
  }

  function drawLand(colors, time) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1, 0, TAU);
    ctx.clip();

    for (const point of landPoints) {
      const projected = project(point);
      if (!projected.visible) continue;
      const depth = clamp((projected.z + .06) / 1.06, 0, 1);
      const sparkle = .82 + Math.sin(time * .0011 + point.phase) * .18;
      const alpha = (.16 + depth * .52) * sparkle;
      const hot = point.lat > 15 && point.lon > -20 && point.lon < 130 && Math.sin(point.lon * .3) > .2;
      ctx.fillStyle = rgba(hot ? colors.landHot : colors.land, alpha);
      const size = point.size * (.65 + depth * .86);
      ctx.fillRect(projected.x - size / 2, projected.y - size / 2, size, size);
    }
    ctx.restore();
  }

  function drawNetwork(colors, time) {
    const projected = networkNodes.map((point) => project(point));
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1, 0, TAU);
    ctx.clip();

    for (const [fromIndex, toIndex] of networkEdges) {
      const from = projected[fromIndex];
      const to = projected[toIndex];
      if (!from.visible || !to.visible) continue;
      const alpha = .05 + Math.min(from.z, to.z) * .17;
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, rgba(colors.route, alpha));
      gradient.addColorStop(.5, rgba(colors.cyan, alpha * 1.25));
      gradient.addColorStop(1, rgba(colors.route, alpha));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = .75;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2 - Math.hypot(to.x - from.x, to.y - from.y) * .08;
      ctx.quadraticCurveTo(mx, my, to.x, to.y);
      ctx.stroke();
    }

    projected.forEach((point, index) => {
      if (!point.visible) return;
      const node = networkNodes[index];
      const pulse = .72 + Math.sin(time * .0018 + node.pulse) * .28;
      const alpha = .38 + Math.max(0, point.z) * .58;
      if (node.major) {
        ctx.strokeStyle = rgba(colors.cyan, alpha * .34 * pulse);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4.2 + pulse * 2.2, 0, TAU);
        ctx.stroke();
      }
      ctx.shadowColor = rgba(node.major ? colors.cyan : colors.landHot, .8);
      ctx.shadowBlur = node.major ? 12 : 7;
      ctx.fillStyle = rgba(node.major ? colors.cyan : colors.landHot, alpha);
      ctx.beginPath();
      ctx.arc(point.x, point.y, node.major ? 1.7 : 1.15, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  function slerpPoint(from, to, t) {
    const a = spherical(from[0], from[1]);
    const b = spherical(to[0], to[1]);
    const dot = clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
    const omega = Math.acos(dot);
    if (omega < .0001) return a;
    const sinOmega = Math.sin(omega);
    const scaleA = Math.sin((1 - t) * omega) / sinOmega;
    const scaleB = Math.sin(t * omega) / sinOmega;
    const x = a.x * scaleA + b.x * scaleB;
    const y = a.y * scaleA + b.y * scaleB;
    const z = a.z * scaleA + b.z * scaleB;
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
  }

  function drawRoutes(colors, time) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 3, 0, TAU);
    ctx.clip();

    routes.forEach((route) => {
      const curve = [];
      for (let step = 0; step <= 42; step += 1) {
        const point = slerpPoint(route.from, route.to, step / 42);
        const lifted = { x: point.x * 1.018, y: point.y * 1.018, z: point.z * 1.018 };
        curve.push(project(lifted));
      }
      drawCurve(curve, rgba(colors.route, colors.light ? .23 : .27), 1, 3);

      const progress = (time * .001 * route.speed + route.offset) % 1;
      const pulse = project(slerpPoint(route.from, route.to, progress), yaw, pitch, 1.02);
      if (!pulse.visible) return;
      ctx.shadowColor = rgba(colors.cyan, .95);
      ctx.shadowBlur = 17;
      ctx.fillStyle = rgba(colors.cyan, .95);
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 2.1, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  function drawAtmosphere(colors) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = rgba(colors.edge, .85);
    ctx.shadowBlur = colors.light ? 16 : 25;
    ctx.strokeStyle = rgba(colors.edge, colors.light ? .36 : .58);
    ctx.lineWidth = colors.light ? 2.2 : 2.4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 1.4, deg(198), deg(344));
    ctx.stroke();

    ctx.shadowColor = rgba(colors.cyan, .75);
    ctx.shadowBlur = colors.light ? 12 : 22;
    ctx.strokeStyle = rgba(colors.cyan, colors.light ? .23 : .38);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 4.5, deg(205), deg(316));
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(colors.grid, colors.light ? .16 : .22);
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 1, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawExternalOrbits(colors, time) {
    ctx.save();
    ctx.translate(centerX + pointerX * 11, centerY + pointerY * 7);
    const orbitConfigs = [
      { rx: radius * 1.34, ry: radius * .37, rotation: -.28, alpha: .22, phase: .1 },
      { rx: radius * 1.21, ry: radius * .27, rotation: .28, alpha: .16, phase: .62 },
      { rx: radius * 1.46, ry: radius * .47, rotation: -.62, alpha: .1, phase: .36 },
    ];

    orbitConfigs.forEach((orbit, index) => {
      ctx.save();
      ctx.rotate(orbit.rotation);
      ctx.strokeStyle = rgba(index === 1 ? colors.cyan : colors.route, orbit.alpha);
      ctx.lineWidth = index === 0 ? 1.05 : .75;
      ctx.setLineDash(index === 2 ? [3, 7] : []);
      ctx.beginPath();
      ctx.ellipse(0, 0, orbit.rx, orbit.ry, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      const p = (time * .000025 * (index + 1) + orbit.phase) % 1;
      const angle = p * TAU;
      const x = Math.cos(angle) * orbit.rx;
      const y = Math.sin(angle) * orbit.ry;
      ctx.shadowColor = rgba(colors.cyan, .85);
      ctx.shadowBlur = 10;
      ctx.fillStyle = rgba(colors.cyan, .8);
      ctx.beginPath();
      ctx.arc(x, y, index === 0 ? 2 : 1.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  function drawFrame(now, force = false) {
    if (!ctx || (!visible && !force)) return;
    const delta = Math.min(48, now - lastTime);
    lastTime = now;
    if (!reduceMotion && animationEnabled) elapsed += delta;

    pointerX = lerp(pointerX, targetPointerX, .045);
    pointerY = lerp(pointerY, targetPointerY, .045);
    if (!reduceMotion && animationEnabled) yaw += delta * .000035;
    pitch = -.13 + pointerY * .08;

    const colors = palette();
    ctx.clearRect(0, 0, width, height);
    drawStars(colors, elapsed);
    drawAmbient(colors);
    drawExternalOrbits(colors, elapsed);
    drawSphereBase(colors);
    drawGraticule(colors);
    drawLand(colors, elapsed);
    drawNetwork(colors, elapsed);
    drawRoutes(colors, elapsed);
    drawAtmosphere(colors);

    if (running && visible && !reduceMotion && animationEnabled) animationFrame = requestAnimationFrame(drawFrame);
  }

  function start() {
    if (!animationEnabled || reduceMotion) {
      running = false;
      drawFrame(performance.now(), true);
      return;
    }
    if (running && animationFrame) return;
    running = true;
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(drawFrame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function handlePointer(event) {
    if (coarsePointer || reduceMotion || !animationEnabled) return;
    const rect = stage.getBoundingClientRect();
    targetPointerX = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
    targetPointerY = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
  }

  stage.addEventListener('pointermove', handlePointer, { passive: true });
  stage.addEventListener('pointerleave', () => {
    targetPointerX = 0;
    targetPointerY = 0;
  }, { passive: true });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const intersectionObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible && animationEnabled) start();
    else stop();
  }, { rootMargin: '160px' });
  intersectionObserver.observe(stage);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible && animationEnabled) start();
  });

  window.addEventListener('vionex-theme-change', () => drawFrame(performance.now(), true));
  resize();
  if (reduceMotion || !animationEnabled) drawFrame(performance.now(), true);
  else start();
}
