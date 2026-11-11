import * as THREE from 'three';
import {
  ArmorDef,
  CoatSkinDef,
  MATERIALS_CATALOG,
  MaterialId,
  WeaponDef,
  YokaiDef,
} from './catalog';
import { BorzoiParts, InteractableKind, YokaiParts } from './components';

// Shared low-poly PBR material helper
export function makeLowPolyMat(
  color: number,
  roughness = 0.65,
  metalness = 0.15,
  emissive = 0x000000,
  emissiveIntensity = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
    emissive,
    emissiveIntensity,
  });
}

/**
 * Builds the 3D Weapon Group held inside the Borzoi's jaws
 */
export function buildWeaponMesh(weapon: WeaponDef): {
  group: THREE.Group;
  trailMesh?: THREE.Mesh;
  floatingOrbs: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const floatingOrbs: THREE.Object3D[] = [];

  const bladeMat = new THREE.MeshStandardMaterial({
    color: weapon.bladeColor,
    roughness: 0.2,
    metalness: 0.85,
    emissive: weapon.bladeColor,
    emissiveIntensity: 0.65,
    flatShading: true,
  });

  const darkSteelMat = makeLowPolyMat(0x1e293b, 0.35, 0.85);
  const hiltMat = makeLowPolyMat(weapon.hiltColor, 0.7, 0.2);
  const goldMat = makeLowPolyMat(0xfbbf24, 0.25, 0.9, 0xfbbf24, 0.2);

  if (weapon.style === 'katana') {
    // Hilt (Tsuka) + Tsuba guard + Curved low-poly blade
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.055, 0.09), hiltMat);
    hilt.position.x = -0.35;
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 6), goldMat);
    tsuba.rotation.z = Math.PI / 2;
    tsuba.position.x = -0.1;

    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.028, 0.075), bladeMat);
    blade.position.x = 0.85;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 4), bladeMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 1.88;

    group.add(hilt, tsuba, blade, tip);
  } else if (weapon.style === 'twin_kodachi') {
    // Two crossed short blades extending both left and right from the jaws!
    for (const dir of [-1, 1]) {
      const sub = new THREE.Group();
      sub.position.z = dir * 0.06;
      sub.rotation.y = dir * 0.14;

      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.08), hiltMat);
      hilt.position.x = -dir * 0.22;
      const tsuba = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.16), goldMat);
      tsuba.position.x = 0;

      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.026, 0.07), bladeMat);
      blade.position.x = dir * 0.68;

      sub.add(hilt, tsuba, blade);
      group.add(sub);
    }
  } else if (weapon.style === 'odachi') {
    // Extra-long crimson greatsword
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.065, 0.1), hiltMat);
    hilt.position.x = -0.48;
    const tsuba = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), goldMat);
    tsuba.position.x = -0.12;

    const spine = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.035, 0.06), darkSteelMat);
    spine.position.set(1.18, 0, -0.025);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.025, 0.08), bladeMat);
    edge.position.set(1.22, 0, 0.025);

    group.add(hilt, tsuba, spine, edge);
  } else if (weapon.style === 'cleaver') {
    // Brutal heavy saw-backed cyber cleaver
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.11), hiltMat);
    hilt.position.x = -0.35;

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 0.24), darkSteelMat);
    body.position.set(0.78, 0, 0);

    const plasmaEdge = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.08), bladeMat);
    plasmaEdge.position.set(0.8, 0, -0.12);

    // Saw teeth along the back
    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 3), bladeMat);
      tooth.rotation.x = Math.PI / 2;
      tooth.position.set(0.15 + i * 0.32, 0, 0.15);
      group.add(tooth);
    }

    group.add(hilt, body, plasmaEdge);
  } else if (weapon.style === 'naginata') {
    // Long shrine polearm with curved glaive blade at the end
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), hiltMat);
    pole.rotation.z = Math.PI / 2;
    pole.position.x = 0.2;

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 6), goldMat);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 1.15;

    const glaive = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.15, 4), bladeMat);
    glaive.rotation.z = -Math.PI / 2;
    glaive.scale.set(1, 1, 0.35);
    glaive.position.x = 1.72;

    group.add(pole, collar, glaive);
  } else {
    // void_tachi: Legendary Tachi with floating golden/violet spirit rings
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.095), goldMat);
    hilt.position.x = -0.38;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12), bladeMat);
    guard.rotation.y = Math.PI / 2;
    guard.position.x = -0.08;

    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.032, 0.09), bladeMat);
    blade.position.x = 1.05;

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 4, 8), goldMat);
      ring.position.set(0.45 + i * 0.55, 0.08, 0);
      group.add(ring);
      floatingOrbs.push(ring);
    }

    group.add(hilt, guard, blade);
  }

  return { group, floatingOrbs };
}

/**
 * Builds the 3D Armor / Cloak Group worn on the Borzoi's torso
 */
export function buildArmorMesh(armor: ArmorDef): {
  group: THREE.Group;
  floatingOrnaments: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const floatingOrnaments: THREE.Object3D[] = [];

  const mainMat = makeLowPolyMat(armor.primaryColor, 0.5, 0.45);
  const accentMat = makeLowPolyMat(armor.accentColor, 0.25, 0.8, armor.accentColor, 0.55);

  if (armor.style === 'collar') {
    // Sleek neon street collar around neck base + chest strap
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.22), mainMat);
    collar.position.set(0, 1.08, -0.52);
    const neonTag = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), accentMat);
    neonTag.position.set(0, 0.92, -0.64);
    group.add(collar, neonTag);
  } else if (armor.style === 'vest') {
    // Tactical Cyber-Vest plates
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 1.08), mainMat);
    backPlate.position.set(0, 1.05, -0.05);
    const neonStripL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.95), accentMat);
    neonStripL.position.set(-0.28, 1.08, -0.05);
    const neonStripR = neonStripL.clone();
    neonStripR.position.x = 0.28;
    group.add(backPlate, neonStripL, neonStripR);
  } else if (armor.style === 'haori') {
    // Onmyoji Shrine Haori cloak + floating paper Ofuda talismans
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 1.15), mainMat);
    mantle.position.set(0, 1.04, 0);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 1.18), accentMat);
    trim.position.set(0, 0.88, 0);
    group.add(mantle, trim);

    // Floating paper talismans around the back
    for (let i = 0; i < 4; i++) {
      const ofuda = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.02), accentMat);
      const angle = (i / 4) * Math.PI * 2;
      ofuda.position.set(Math.cos(angle) * 0.48, 1.38, Math.sin(angle) * 0.45);
      group.add(ofuda);
      floatingOrnaments.push(ofuda);
    }
  } else if (armor.style === 'samurai') {
    // Ronin O-Yoroi layered plates + shoulder Sode + golden back crest
    const cuirass = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 1.12), mainMat);
    cuirass.position.set(0, 1.05, 0);

    const sodeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.48), mainMat);
    sodeL.position.set(-0.34, 1.02, -0.32);
    sodeL.rotation.z = 0.25;
    const sodeR = sodeL.clone();
    sodeR.position.x = 0.34;
    sodeR.rotation.z = -0.25;

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), accentMat);
    crest.position.set(0, 1.42, -0.25);
    crest.rotation.x = -0.35;

    group.add(cuirass, sodeL, sodeR, crest);
  } else {
    // akira_exo: Cyber Exo-Harness with glowing turbine vents
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 1.2), mainMat);
    chassis.position.set(0, 1.06, 0);

    const spineCore = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 1.25), accentMat);
    spineCore.position.set(0, 1.24, 0);

    for (const side of [-1, 1]) {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.55, 6), mainMat);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(side * 0.36, 1.18, 0.25);

      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), accentMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(side * 0.36, 1.18, 0.58);
      group.add(thruster, nozzle);
    }

    group.add(chassis, spineCore);
  }

  return { group, floatingOrnaments };
}

/**
 * Creates the full articulated 3D Low-Poly Borzoi Sighthound (10+ composite parts)
 */
export function createBorzoiMesh(
  skin: CoatSkinDef,
  weapon: WeaponDef,
  armor: ArmorDef
): { mesh: THREE.Group; parts: BorzoiParts } {
  const root = new THREE.Group();

  const coatMat = makeLowPolyMat(skin.coatColor, 0.7, 0.1);
  const muzzleMat = makeLowPolyMat(skin.muzzleColor, 0.6, 0.15);
  const noseMat = makeLowPolyMat(0x0f172a, 0.3, 0.4);
  const eyeMat = makeLowPolyMat(skin.eyeColor, 0.1, 0.9, skin.eyeColor, 0.8);

  // Soft ground shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.85, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // 1. Deep narrow Borzoi chest (front ribcage)
  const chestGeo = new THREE.BoxGeometry(0.46, 0.64, 0.78);
  const chest = new THREE.Mesh(chestGeo, coatMat);
  chest.position.set(0, 0.96, -0.26);
  chest.castShadow = true;
  bodyGroup.add(chest);

  // 2. Arched sighthound loin / tucked waist (rear torso)
  const loinGeo = new THREE.BoxGeometry(0.38, 0.46, 0.76);
  const loin = new THREE.Mesh(loinGeo, coatMat);
  loin.position.set(0, 1.04, 0.42);
  loin.rotation.x = -0.14;
  loin.castShadow = true;
  bodyGroup.add(loin);

  // 3. Armor Mount
  const armorMount = new THREE.Group();
  bodyGroup.add(armorMount);
  const builtArmor = buildArmorMesh(armor);
  armorMount.add(builtArmor.group);

  // 4. Long aristocratic neck + head group
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 1.15, -0.58);
  bodyGroup.add(neckGroup);

  const neckGeo = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 5);
  const neckMesh = new THREE.Mesh(neckGeo, coatMat);
  neckMesh.position.set(0, 0.18, -0.1);
  neckMesh.rotation.x = 0.48;
  neckGroup.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.36, -0.22);
  neckGroup.add(headGroup);

  // Cranium
  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.34), coatMat);
  cranium.position.set(0, 0.04, 0.02);
  headGroup.add(cranium);

  // Iconic ultra-long Roman-nosed Borzoi snout!
  const snoutGeo = new THREE.ConeGeometry(0.15, 0.92, 4);
  snoutGeo.rotateX(-Math.PI / 2);
  snoutGeo.rotateZ(Math.PI / 4);
  const snout = new THREE.Mesh(snoutGeo, muzzleMat);
  snout.position.set(0, 0.0, -0.52);
  headGroup.add(snout);

  // Black nose tip
  const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.09), noseMat);
  noseTip.position.set(0, 0.02, -0.96);
  headGroup.add(noseTip);

  // Glowing sighthound eyes
  const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.08);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.14, 0.09, -0.08);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.14;
  headGroup.add(eyeL, eyeR);

  // Swept-back silky rose ears
  const earGeo = new THREE.BoxGeometry(0.08, 0.12, 0.42);
  earGeo.translate(0, 0, 0.18);
  const earL = new THREE.Mesh(earGeo, muzzleMat);
  earL.position.set(-0.14, 0.12, 0.08);
  earL.rotation.set(-0.28, -0.18, 0);
  const earR = earL.clone();
  earR.position.x = 0.14;
  earR.rotation.y = 0.18;
  headGroup.add(earL, earR);

  // 5. Jaw Weapon Mount (at the middle-front of the long snout)
  const jawWeaponMount = new THREE.Group();
  jawWeaponMount.position.set(0, -0.03, -0.66);
  headGroup.add(jawWeaponMount);

  const builtWeapon = buildWeaponMesh(weapon);
  jawWeaponMount.add(builtWeapon.group);

  // 6. Four long slender sighthound legs (pivoted at shoulder/hip)
  const legs: THREE.Object3D[] = [];
  const legPositions: [number, number, number][] = [
    [-0.19, 0.82, -0.48], // Front Left
    [0.19, 0.82, -0.48],  // Front Right
    [-0.18, 0.86, 0.56],  // Back Left
    [0.18, 0.86, 0.56],   // Back Right
  ];

  legPositions.forEach(([lx, ly, lz], idx) => {
    const legRoot = new THREE.Group();
    legRoot.position.set(lx, ly, lz);

    const upperGeo = new THREE.BoxGeometry(0.12, 0.48, 0.14);
    upperGeo.translate(0, -0.24, 0);
    const upper = new THREE.Mesh(upperGeo, coatMat);

    const lowerGeo = new THREE.BoxGeometry(0.09, 0.44, 0.1);
    lowerGeo.translate(0, -0.64, 0);
    const lower = new THREE.Mesh(lowerGeo, muzzleMat);

    const pawGeo = new THREE.BoxGeometry(0.11, 0.08, 0.16);
    pawGeo.translate(0, -0.82, -0.03);
    const paw = new THREE.Mesh(pawGeo, coatMat);

    legRoot.add(upper, lower, paw);
    if (idx >= 2) {
      upper.rotation.x = 0.08;
    }
    bodyGroup.add(legRoot);
    legs.push(legRoot);
  });

  // 7. Long sickle-shaped Borzoi tail with feathered underside
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 1.02, 0.78);
  const tailMainGeo = new THREE.BoxGeometry(0.09, 0.12, 0.88);
  tailMainGeo.translate(0, -0.04, 0.44);
  const tailMain = new THREE.Mesh(tailMainGeo, coatMat);
  const tailPlumeGeo = new THREE.BoxGeometry(0.05, 0.18, 0.65);
  tailPlumeGeo.translate(0, -0.14, 0.48);
  const tailPlume = new THREE.Mesh(tailPlumeGeo, muzzleMat);
  tailGroup.add(tailMain, tailPlume);
  tailGroup.rotation.x = -0.58;
  bodyGroup.add(tailGroup);

  return {
    mesh: root,
    parts: {
      bodyGroup,
      neckGroup,
      headGroup,
      jawWeaponMount,
      armorMount,
      legs,
      tail: tailGroup,
      ears: [earL, earR],
      floatingOrnaments: [...builtArmor.floatingOrnaments, ...builtWeapon.floatingOrbs],
    },
  };
}

/**
 * Creates a J-Horror / Urban Mystic Yokai enemy mesh (composite 6-10 parts)
 */
export function createYokaiMesh(def: YokaiDef, floor: number): {
  mesh: THREE.Group;
  parts: YokaiParts;
} {
  const group = new THREE.Group();
  const extraParts: THREE.Object3D[] = [];

  const bodyMat = makeLowPolyMat(def.bodyColor, 0.62, 0.25);
  const darkMat = makeLowPolyMat(0x0b0f17, 0.75, 0.2);
  const woodMat = makeLowPolyMat(0x451a03, 0.85, 0.08);
  const rustMat = makeLowPolyMat(0x7c2d12, 0.55, 0.65);
  const boneMat = makeLowPolyMat(0xe2e8f0, 0.42, 0.15);
  const furMat = makeLowPolyMat(0x271c15, 0.9, 0.05);
  const silkMat = makeLowPolyMat(0xf1f5f9, 0.5, 0.1);
  const crimsonMat = makeLowPolyMat(0x991b1b, 0.45, 0.3);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: def.glowColor,
    emissive: def.glowColor,
    emissiveIntensity: 0.95,
    roughness: 0.2,
    flatShading: true,
  });

  // Contact shadow disc
  const shadowRadius = def.isBoss ? 1.85 : 1.05;
  const shadowGeo = new THREE.CircleGeometry(shadowRadius, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowDisc = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })
  );
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  let torso: THREE.Object3D;
  const head = new THREE.Group();
  let armL: THREE.Object3D;
  let armR: THREE.Object3D;
  let eye: THREE.Mesh;

  if (def.archetype === 'kele') {
    // 1. CHUKCHI KELE: Spider-like Bone Crawler with oversized Walrus-Skull carapace & 4 bone legs
    const carapace = new THREE.Group();
    carapace.position.y = 0.95;
    const dome = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 0), boneMat);
    dome.scale.set(1.15, 0.75, 1.35);
    carapace.add(dome);

    // Shaman drum on back
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 8), woodMat);
    drum.position.set(0, 0.55, -0.2);
    drum.rotation.x = 0.5;
    carapace.add(drum);

    // 4 Spider-like whalebone legs on sides
    for (const side of [-1, 1]) {
      for (const zOff of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.35, 4), boneMat);
        leg.position.set(side * 0.95, -0.25, zOff);
        leg.rotation.z = side * 0.55;
        carapace.add(leg);
        extraParts.push(leg);
      }
    }
    torso = carapace;
    group.add(torso);

    // Low forward walrus skull head with long tusks
    head.position.set(0, 1.15, 0.85);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.52, 0.65), boneMat);
    eye = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.35), eyeMat);
    eye.position.set(0, 0.06, 0.24);
    head.add(skull, eye);
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.78, 4), boneMat);
      tusk.position.set(side * 0.24, -0.42, 0.25);
      tusk.rotation.x = Math.PI * 0.92;
      head.add(tusk);
    }
    group.add(head);

    // Forelimbs with bone harpoon
    const clawGeo = new THREE.BoxGeometry(0.22, 1.45, 0.22);
    clawGeo.translate(0, -0.65, 0);
    armL = new THREE.Mesh(clawGeo, darkMat);
    armL.position.set(-0.78, 1.25, 0.4);
    armR = new THREE.Mesh(clawGeo, darkMat);
    armR.position.set(0.78, 1.25, 0.4);
    const harpoon = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.9, 4), eyeMat);
    harpoon.position.set(0, -1.3, 0.35);
    harpoon.rotation.x = Math.PI / 2.4;
    armR.add(harpoon);
    group.add(armL, armR);
  } else if (def.archetype === 'poludnitsa') {
    // 2. POLUDNITSA-KUCHISAKE: Tall Levitating Wraith in White/Crimson Kimono-Sarafan, Kokoshnik & Twin Sickles
    const robeGroup = new THREE.Group();
    robeGroup.position.y = 1.45;
    const kimono = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.35, 6), silkMat);
    const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.45, 6), crimsonMat);
    obi.position.y = 0.25;
    robeGroup.add(kimono, obi);
    torso = robeGroup;
    group.add(torso);

    head.position.set(0, 2.75, 0.15);
    const faceMask = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), silkMat);
    // Slit mouth & glowing eyes
    eye = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.38), eyeMat);
    eye.position.set(0, -0.06, 0.22);
    // Tall Slavic Solar Kokoshnik crest
    const kokoshnik = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.75, 3), crimsonMat);
    kokoshnik.scale.set(1.2, 1, 0.25);
    kokoshnik.position.set(0, 0.42, -0.05);
    const haloRim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 4, 8, Math.PI), eyeMat);
    haloRim.position.set(0, 0.22, 0.02);
    head.add(faceMask, eye, kokoshnik, haloRim);
    group.add(head);

    // Long flowing sleeves with giant crossed sickles
    const sleeveGeo = new THREE.BoxGeometry(0.24, 1.65, 0.36);
    sleeveGeo.translate(0, -0.75, 0);
    armL = new THREE.Mesh(sleeveGeo, crimsonMat);
    armL.position.set(-0.68, 2.25, 0);
    armR = new THREE.Mesh(sleeveGeo, crimsonMat);
    armR.position.set(0.68, 2.25, 0);

    for (const arm of [armL, armR]) {
      const sickle = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 8, Math.PI * 0.75), eyeMat);
      sickle.position.set(0, -1.55, 0.35);
      sickle.rotation.y = Math.PI / 2;
      arm.add(sickle);
    }
    group.add(armL, armR);
  } else if (def.archetype === 'shatun') {
    // 3. TAIGA SHATUN-WENDIGO: Massive Hulking Bear-Stag Beast with Antlers & Glowing Furnace Ribcage
    const beastTorso = new THREE.Group();
    beastTorso.position.y = 1.35;
    const hunch = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), furMat);
    hunch.scale.set(1.15, 1.1, 0.95);
    const furnaceCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), eyeMat);
    furnaceCore.position.set(0, -0.1, 0.62);
    beastTorso.add(hunch, furnaceCore);
    // Exposed bone ribs over chest furnace
    for (let r = -1; r <= 1; r++) {
      const ribBar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 0.12), boneMat);
      ribBar.position.set(0, r * 0.22 - 0.1, 0.88);
      beastTorso.add(ribBar);
    }
    torso = beastTorso;
    group.add(torso);

    // Elongated Beast Skull + Huge Branching Stag Antlers
    head.position.set(0, 2.35, 0.55);
    const bearSkull = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.05, 5), boneMat);
    bearSkull.rotation.x = Math.PI / 2.2;
    eye = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.42), eyeMat);
    eye.position.set(0, 0.12, 0.15);
    head.add(bearSkull, eye);

    for (const side of [-1, 1]) {
      const mainBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.25, 5), boneMat);
      mainBeam.position.set(side * 0.45, 0.55, -0.1);
      mainBeam.rotation.z = -side * 0.55;
      for (let t = 0; t < 2; t++) {
        const tine = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.55, 4), boneMat);
        tine.position.set(side * 0.18, 0.15 + t * 0.28, 0.15);
        tine.rotation.x = 0.6;
        mainBeam.add(tine);
      }
      head.add(mainBeam);
    }
    group.add(head);

    // Massive Hulking Clawed Forearms
    const hulkArmGeo = new THREE.BoxGeometry(0.38, 1.95, 0.38);
    hulkArmGeo.translate(0, -0.9, 0);
    armL = new THREE.Mesh(hulkArmGeo, furMat);
    armL.position.set(-1.05, 2.05, 0.2);
    armR = new THREE.Mesh(hulkArmGeo, furMat);
    armR.position.set(1.05, 2.05, 0.2);
    for (const arm of [armL, armR]) {
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 4), boneMat);
        claw.rotation.x = Math.PI * 0.85;
        claw.position.set(c * 0.11, -1.9, 0.18);
        arm.add(claw);
      }
    }
    group.add(armL, armR);
  } else if (def.archetype === 'likho') {
    // 4. ONE-EYED LIKHO (ROKUROKUBI): Rusted Diving-Bell Base + Sinuous 6-Segment Snake Neck + Searchlight Cyclops Head
    const bellGroup = new THREE.Group();
    bellGroup.position.y = 0.9;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.7, 7), rustMat);
    const ironBand = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 5, 8), darkMat);
    ironBand.rotation.x = Math.PI / 2;
    bellGroup.add(bell, ironBand);
    torso = bellGroup;
    group.add(torso);

    // S-curved serpentine neck vertebrae
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.2 - i * 0.012, 6, 6), boneMat);
      seg.position.set(
        Math.sin(i * 0.8) * 0.28,
        1.75 + i * 0.26,
        Math.cos(i * 0.7) * 0.22
      );
      group.add(seg);
      extraParts.push(seg);
    }

    // Giant Searchlight Cyclops Head high above
    head.position.set(0, 3.25, 0.35);
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.65, 8), darkMat);
    casing.rotation.x = Math.PI / 2;
    eye = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 10), eyeMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, 0, 0.32);
    head.add(casing, eye);
    group.add(head);

    // Whip-like chain tentacles for arms
    const chainGeo = new THREE.CylinderGeometry(0.08, 0.14, 2.0, 5);
    chainGeo.translate(0, -0.9, 0);
    armL = new THREE.Mesh(chainGeo, darkMat);
    armL.position.set(-0.75, 1.65, 0);
    armR = new THREE.Mesh(chainGeo, darkMat);
    armR.position.set(0.75, 1.65, 0);
    group.add(armL, armR);
  } else if (def.archetype === 'vodyanoy') {
    // 5. OKHOTSK VODYANOY-KAPPA: Wide Spiked Crab-Turtle Shell + Glowing Water Bowl Crown + Heavy Ship Anchor
    const shellGroup = new THREE.Group();
    shellGroup.position.y = 1.1;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85, 7, 6), bodyMat);
    belly.scale.set(1.2, 0.95, 0.9);
    const carapace = new THREE.Mesh(new THREE.IcosahedronGeometry(1.02, 0), rustMat);
    carapace.position.set(0, 0.15, -0.32);
    shellGroup.add(belly, carapace);
    // Barnacle spikes on shell
    for (let s = -1; s <= 1; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 4), boneMat);
      spike.position.set(s * 0.45, 0.85, -0.45);
      spike.rotation.x = -0.5;
      shellGroup.add(spike);
    }
    torso = shellGroup;
    group.add(torso);

    // Wide Amphibian Head + Glowing Kappa Water Bowl on top
    head.position.set(0, 1.95, 0.45);
    const frogSkull = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.68), bodyMat);
    const kappaDish = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.14, 8), eyeMat);
    kappaDish.position.set(0, 0.26, 0);
    eye = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.35), eyeMat);
    eye.position.set(0, 0.02, 0.28);
    head.add(frogSkull, kappaDish, eye);
    group.add(head);

    // Pincer Arms + Giant Ship Anchor in Right Hand
    const pincerGeo = new THREE.BoxGeometry(0.32, 1.65, 0.32);
    pincerGeo.translate(0, -0.75, 0);
    armL = new THREE.Mesh(pincerGeo, rustMat);
    armL.position.set(-0.98, 1.65, 0.2);
    armR = new THREE.Mesh(pincerGeo, rustMat);
    armR.position.set(0.98, 1.65, 0.2);

    const anchorShaft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.14), darkMat);
    anchorShaft.position.set(0, -1.5, 0.3);
    anchorShaft.rotation.x = 0.5;
    const anchorFluke = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.1, 4, 8, Math.PI), eyeMat);
    anchorFluke.rotation.z = Math.PI;
    anchorFluke.position.set(0, -0.65, 0);
    anchorShaft.add(anchorFluke);
    armR.add(anchorShaft);
    group.add(armL, armR);
  } else if (def.archetype === 'akamanto') {
    // 6. AKA-MANTO / KOSCHEI SENTINEL: Armored Samurai-Warlock with Billowing Crimson Cape & Halo of Floating Swords
    const armorTorso = new THREE.Group();
    armorTorso.position.y = 1.35;
    const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.68, 2.1, 6), crimsonMat);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.15, 0.12), crimsonMat);
    cape.position.set(0, -0.05, -0.42);
    cape.rotation.x = 0.15;
    armorTorso.add(cuirass, cape);

    // Ring of 5 Floating Golden Swords behind its back!
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI - Math.PI / 2;
      const floatSword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.35, 0.04), eyeMat);
      floatSword.position.set(Math.sin(angle) * 1.15, 0.65 + Math.cos(angle) * 0.65, -0.55);
      floatSword.rotation.z = -angle;
      armorTorso.add(floatSword);
      extraParts.push(floatSword);
    }
    torso = armorTorso;
    group.add(torso);

    head.position.set(0, 2.55, 0.15);
    const kabuto = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), darkMat);
    eye = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.42), eyeMat);
    eye.position.set(0, -0.02, 0.22);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.65, 4), eyeMat);
      horn.position.set(side * 0.28, 0.42, 0.08);
      horn.rotation.z = -side * 0.4;
      head.add(horn);
    }
    head.add(kabuto, eye);
    group.add(head);

    const sodeArmGeo = new THREE.BoxGeometry(0.26, 1.75, 0.26);
    sodeArmGeo.translate(0, -0.8, 0);
    armL = new THREE.Mesh(sodeArmGeo, darkMat);
    armL.position.set(-0.78, 2.1, 0);
    armR = new THREE.Mesh(sodeArmGeo, darkMat);
    armR.position.set(0.78, 2.1, 0);
    group.add(armL, armR);
  } else {
    // 7. BOSS: KOSCHEI-GASHADOKURO — Four-Armed Whalebone Skeletal Colossus with Frozen Heart Crystal
    const bossTorso = new THREE.Group();
    bossTorso.position.y = 1.4;
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6), boneMat);
    const heartCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), eyeMat);
    heartCrystal.position.set(0, 0.25, 0.25);
    bossTorso.add(spine, heartCrystal);

    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.82 - i * 0.08, 0.09, 5, 8), boneMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = -0.35 + i * 0.34;
      bossTorso.add(rib);
      extraParts.push(rib);
    }
    torso = bossTorso;
    group.add(torso);

    head.position.set(0, 2.85, 0.25);
    const giantSkull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 0), boneMat);
    eye = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.52), eyeMat);
    eye.position.set(0, -0.04, 0.28);
    const iceCrown = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.85, 5), eyeMat);
    iceCrown.position.y = 0.62;
    head.add(giantSkull, eye, iceCrown);
    group.add(head);

    const bossArmGeo = new THREE.BoxGeometry(0.24, 2.1, 0.24);
    bossArmGeo.translate(0, -0.95, 0);
    armL = new THREE.Group();
    armL.position.set(-0.95, 2.35, 0);
    const upperL = new THREE.Mesh(bossArmGeo, boneMat);
    const lowerL = new THREE.Mesh(bossArmGeo, darkMat);
    lowerL.position.set(-0.35, -0.35, 0.2);
    lowerL.rotation.z = 0.35;
    armL.add(upperL, lowerL);

    armR = new THREE.Group();
    armR.position.set(0.95, 2.35, 0);
    const upperR = new THREE.Mesh(bossArmGeo, boneMat);
    const lowerR = new THREE.Mesh(bossArmGeo, darkMat);
    lowerR.position.set(0.35, -0.35, 0.2);
    lowerR.rotation.z = -0.35;
    const bossBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.85, 0.28), eyeMat);
    bossBlade.position.set(0, -1.9, 0.35);
    bossBlade.rotation.x = 0.4;
    upperR.add(bossBlade);
    armR.add(upperR, lowerR);

    group.add(armL, armR);
    group.scale.setScalar(1.32);
  }

  const floorScale = 1 + Math.min(0.22, floor * 0.015);
  if (!def.isBoss) {
    group.scale.setScalar(floorScale);
  }

  return {
    mesh: group,
    parts: { torso, head, armL, armR, eye, extraParts },
  };
}

/**
 * Creates a 3D Loot Drop item on the dungeon floor with a vertical beacon & ground ring
 */
export function createLootDropMesh(
  materialId: MaterialId | undefined,
  colorHex: number,
  isHealOrb: boolean
): THREE.Group {
  const group = new THREE.Group();

  const itemMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.8,
    flatShading: true,
  });

  const ringGeo = new THREE.RingGeometry(0.32, 0.44, 16);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.03;
  group.add(ring);

  const beamGeo = new THREE.CylinderGeometry(0.04, 0.16, 1.8, 8, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 0.9;
  group.add(beam);

  let coreMesh: THREE.Mesh;
  if (isHealOrb) {
    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), itemMat);
  } else {
    const shape = materialId ? MATERIALS_CATALOG[materialId].shape : 'crystal';
    if (shape === 'ingot') {
      coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.22), itemMat);
    } else if (shape === 'spool') {
      coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 8), itemMat);
    } else if (shape === 'talisman') {
      coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.05), itemMat);
    } else {
      coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), itemMat);
    }
  }
  coreMesh.position.y = 0.55;
  coreMesh.name = 'lootCore';
  group.add(coreMesh);

  return group;
}

/**
 * Creates 3D Interactable Stations (Torii Portals, Bonfire Shrine, Swordsmith Anvil, Shaman Totem)
 */
export function createInteractableMesh(kind: InteractableKind): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'portal_next_floor' || kind === 'portal_enter_abyss' || kind === 'portal_hub') {
    const isHubPortal = kind === 'portal_hub';
    const mainColor = isHubPortal ? 0x00ffcc : 0xff0055;
    const pillarMat = makeLowPolyMat(0xb91c1c, 0.5, 0.3);
    const blackMat = makeLowPolyMat(0x0f172a, 0.6, 0.4);
    const portalMat = new THREE.MeshBasicMaterial({
      color: mainColor,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });

    for (const side of [-1, 1]) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 8), blackMat);
      base.position.set(side * 1.5, 0.25, 0);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 8), pillarMat);
      col.position.set(side * 1.5, 1.8, 0);
      group.add(base, col);
    }

    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.26, 0.42), pillarMat);
    kasagi.position.set(0, 3.65, 0);
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.14, 0.52), blackMat);
    roofCap.position.set(0, 3.82, 0);
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 0.24), pillarMat);
    nuki.position.set(0, 3.05, 0);

    const vortex = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.95), portalMat);
    vortex.position.set(0, 1.5, 0);
    vortex.name = 'vortexPlane';

    group.add(kasagi, roofCap, nuki, vortex);
  } else if (kind === 'shrine_bonfire') {
    const stoneMat = makeLowPolyMat(0x334155, 0.85, 0.1);
    const fireMat = makeLowPolyMat(0x00ffcc, 0.2, 0.5, 0x00ffcc, 0.9);

    const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.35, 8), stoneMat);
    altar.position.y = 0.175;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 5), fireMat);
    flame.position.y = 0.85;
    flame.name = 'bonfireFlame';

    const katanaShrine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.04), stoneMat);
    katanaShrine.position.set(0, 0.9, 0);
    katanaShrine.rotation.z = 0.18;

    group.add(altar, flame, katanaShrine);
  } else if (kind === 'forge_anvil') {
    const ironMat = makeLowPolyMat(0x1e293b, 0.4, 0.85);
    const emberMat = makeLowPolyMat(0xf59e0b, 0.3, 0.6, 0xf59e0b, 0.8);

    const stump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 0.55, 8),
      makeLowPolyMat(0x451a03, 0.9, 0.05)
    );
    stump.position.y = 0.275;
    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.38, 0.45), ironMat);
    anvilBase.position.y = 0.72;
    const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), ironMat);
    anvilHorn.rotation.z = -Math.PI / 2;
    anvilHorn.position.set(0.62, 0.76, 0);

    const hotIngot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.14), emberMat);
    hotIngot.position.set(0, 0.94, 0);

    group.add(stump, anvilBase, anvilHorn, hotIngot);
  } else if (kind === 'vending_machine') {
    // Far Eastern Shaman Idol & Contraband Chest
    const woodMat = makeLowPolyMat(0x451a03, 0.85, 0.1);
    const glowMat = makeLowPolyMat(0x38bdf8, 0.2, 0.5, 0x38bdf8, 0.8);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 2.5, 6), woodMat);
    pillar.position.y = 1.25;
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.35), glowMat);
    eyes.position.set(0, 1.85, 0.25);
    const horns = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 5, 8, Math.PI), glowMat);
    horns.position.set(0, 2.25, 0);
    group.add(pillar, eyes, horns);
  }

  return group;
}
