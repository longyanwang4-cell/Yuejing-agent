import * as THREE from 'three';
import { ROOM, HUB, GUIDE } from '../config.js';
import { makeMaterials, box } from '../core/materials.js';
import { rugTexture } from '../core/tex-surfaces.js';
import { buildRoom } from './room.js';
import { buildLights } from './lights.js';
import { shelveWall } from './bookcase.js';
import { wallFrame } from './wall-frame.js';
import { roundTable, armillary, chandelier, floorLamp, armchair, sofa, spiralStair } from './props.js';
import { signBoard, noteSheet, realWorldGate, growthBoard } from './decor.js';
import { buildDisplayCase, animateBooks } from './books.js';
import { createGuide } from '../assistant/guide.js';
import { createSpirit } from '../assistant/spirit.js';

function wainscot(mats, wf, x0 = -3.45, x1 = 3.45) {
  const w = x1 - x0, mx = (x0 + x1) / 2;
  wf.add(box(w, 1.05, 0.07, mats.woodDark, mx, 0.62, 0.035));
  wf.add(box(w + 0.04, 0.07, 0.11, mats.brass, mx, 1.17, 0.055, false));
  for (let k = 0; k < Math.floor(w / 0.9); k++) {
    const px = x0 + 0.45 + k * 0.9 + (w % 0.9) / 2;
    wf.add(box(0.7, 0.72, 0.03, mats.wood, px, 0.64, 0.08, false));
  }
}

// 搭整个书房，返回需要每帧驱动/交互的对象
export function buildStudy(engine) {
  const { scene, renderer } = engine;
  const mats = makeMaterials();
  const study = new THREE.Group();
  scene.add(study);

  const room = buildRoom(mats);
  study.add(room);
  const lights = buildLights(scene, renderer, mats);

  const walls = [];
  for (let i = 0; i < 8; i++) {
    const wf = wallFrame(i);
    walls.push(wf);
    study.add(wf);
  }

  // —— 墙面 ——
  shelveWall(mats, walls[0], 0, { lower: [[-3.3, -2.15], [2.15, 3.3]], upper: [[-3.3, -2.15], [2.15, 3.3]] });
  shelveWall(mats, walls[1], 1, { lower: [], upper: [[-3.05, 3.05]] });
  wainscot(mats, walls[1]);
  shelveWall(mats, walls[2], 2, { lower: [[-3.05, -1.0], [1.0, 3.05]] });
  [3, 4, 5, 6].forEach((i) => shelveWall(mats, walls[i], i));
  shelveWall(mats, walls[7], 7, { lower: [[-3.4, -2.62], [2.62, 3.4]], upper: [[-3.05, 3.05]] });

  // 左后墙：我的书架（陈列柜）+ 招牌
  const dcase = buildDisplayCase(mats);
  dcase.position.set(0, 0.0, 0.05);
  walls[7].add(dcase);
  const sign = signBoard(mats);
  sign.scale.setScalar(0.78);
  sign.position.set(0, 3.6, 0.07);
  walls[7].add(sign);

  // 右后墙：成长看板 + 通往真实世界的门
  const board = growthBoard(mats);
  board.position.set(-1.8, 2.45, 0.06);
  walls[1].add(board);
  const gate = realWorldGate(mats);
  gate.position.set(1.55, 0, 0.04);
  walls[1].add(gate);

  const note = noteSheet(mats);
  note.position.set(0, 2.7, 0.04);
  note.scale.setScalar(0.9);
  walls[2].add(note);

  // —— 地面中心 ——
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshStandardMaterial({ map: rugTexture(), transparent: true, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(HUB.x, 0.012, HUB.z);
  rug.receiveShadow = true;
  study.add(rug);

  const table = roundTable(mats);
  table.position.set(HUB.x, 0, HUB.z);
  study.add(table);

  const arm = armillary(mats);
  arm.position.set(HUB.x, 3.0, HUB.z);
  study.add(arm);

  const chand = chandelier(mats, 3.0);
  chand.position.set(HUB.x, 8.6, HUB.z);
  study.add(chand);

  // —— 家具 ——
  const sofaM = sofa(mats);
  sofaM.position.set(7.2, 0, -0.6);
  sofaM.rotation.y = -Math.PI / 2;
  study.add(sofaM);
  const chair = armchair(mats, 0x6a3322);
  chair.position.set(5.0, 0, 1.3);
  chair.rotation.y = -2.1;
  study.add(chair);
  const lampR = floorLamp(mats, true);
  lampR.position.set(7.5, 0, 1.9);
  study.add(lampR);
  const lampL = floorLamp(mats, true);
  lampL.position.set(-4.6, 0, 3.4);
  study.add(lampL);
  const lampS = floorLamp(mats, false);
  lampS.position.set(7.4, 0, -2.9);
  study.add(lampS);

  // 旋梯：顶端接二层回廊（-x 方向）
  const STAIR = { x: -4.8, z: 0 };
  const steps = 20, turns = 0.95;
  const stair = spiralStair(mats, ROOM.deckY - 0.035, steps, turns, 1.2);
  stair.position.set(STAIR.x, 0, STAIR.z);
  stair.rotation.y = turns * Math.PI * 2 - Math.PI;
  study.add(stair);
  const plankLen = 7.3 - Math.abs(STAIR.x) + 0.55;
  const plank = box(plankLen, 0.09, 1.15, mats.woodWarm, -(7.3 + Math.abs(STAIR.x) - 0.55) / 2, ROOM.deckY - 0.055, STAIR.z);
  study.add(plank);
  [-1, 1].forEach((s) => {
    const rail = box(plankLen, 0.05, 0.05, mats.brass, plank.position.x, ROOM.deckY + 0.95, STAIR.z + s * 0.56, false);
    study.add(rail);
    for (let k = 0; k <= 4; k++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), mats.brassDull);
      p.position.set(plank.position.x - plankLen / 2 + (k * plankLen) / 4, ROOM.deckY + 0.47, STAIR.z + s * 0.56);
      study.add(p);
    }
  });

  // —— 智能体 + 光灵 ——
  const guide = createGuide();
  guide.root.position.set(GUIDE.x, 0, GUIDE.z);
  guide.root.rotation.y = GUIDE.yaw;
  guide.root.scale.setScalar(1.12);
  study.add(guide.root);
  // 专给她打的面光，避免脸被环境暖光压平
  const key = new THREE.PointLight(0xfff1e0, 7, 7, 2);
  key.position.set(GUIDE.x + 1.6, 2.4, GUIDE.z + 2.2);
  study.add(key);

  const spirit = createSpirit();
  spirit.root.position.set(HUB.x - 0.1, 0, HUB.z + 0.25);
  study.add(spirit.root);

  const books = dcase.userData.books;
  engine.onTick((dt, t) => {
    arm.userData.rings.forEach((r, i) => {
      r.rotation.y += dt * (0.25 + i * 0.12);
      r.rotation.x += dt * 0.05 * (i % 2 ? 1 : -1);
    });
    chand.rotation.y += dt * 0.05;
    chand.rotation.z = Math.sin(t * 0.4) * 0.01;
    spirit.update(t);
    animateBooks(books, dt);
  });

  return { mats, study, room, lights, walls, arm, chand, table, guide, spirit, dcase, books, board, gate, sign, note };
}
