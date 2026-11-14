// Физическое ядро в стиле OpenRocket:
// Расширенный метод Барроумена (ЦД), покомпонентный расчёт массы и ЦМ,
// волновое/донное сопротивление и трение Cd(Mach), 1–2 ступени, парсер RASP (.eng) и 2D-симуляция полёта.

export const OR_MATERIALS = {
  carbon: { name: 'Углепластик (1.78 г/см³)', rho: 1780, wallScale: 0.75 },
  fiberglass: { name: 'Стеклопластик (1.85 г/см³)', rho: 1850, wallScale: 0.9 },
  pla: { name: 'ABS / PLA 3D-печать (1.15 г/см³)', rho: 1150, wallScale: 1.15 },
  cardboard: { name: 'Крафт-картон (0.68 г/см³)', rho: 680, wallScale: 1.35 },
  plywood: { name: 'Авиафанера берёзовая (0.63 г/см³)', rho: 630, wallScale: 1.25 },
  balsa: { name: 'Бальза лёгкая (0.17 г/см³)', rho: 170, wallScale: 1.6 }
};

export const OR_NOSE_SHAPES = {
  haack: { name: 'Ряд Хаака (Фон Карман)', cdForm: 0.038, cpFrac: 0.500, surfFrac: 0.68 },
  ogive: { name: 'Оживальный (Tangent Ogive)', cdForm: 0.052, cpFrac: 0.466, surfFrac: 0.69 },
  parabolic: { name: 'Параболический', cdForm: 0.064, cpFrac: 0.500, surfFrac: 0.67 },
  ellipsoid: { name: 'Эллиптический', cdForm: 0.095, cpFrac: 0.333, surfFrac: 0.76 },
  cone: { name: 'Конический', cdForm: 0.135, cpFrac: 0.666, surfFrac: 0.62 },
  blunt: { name: 'Притупленный / Сфера', cdForm: 0.440, cpFrac: 0.410, surfFrac: 0.82 }
};

export const OR_FIN_PROFILES = {
  airfoil: { name: 'Аэродинамический / Ромб', dragMult: 0.66 },
  rounded: { name: 'Скруглённые кромки', dragMult: 1.00 },
  square: { name: 'Прямоугольное сечение', dragMult: 1.45 }
};

export const OR_FINISHES = {
  polished: { name: 'Полированная (2 мкм)', cfMult: 0.84 },
  gloss: { name: 'Глянцевая краска (20 мкм)', cfMult: 1.00 },
  matte: { name: 'Матовая / 3D-печать (60 мкм)', cfMult: 1.18 },
  rough: { name: 'Необработанная (150 мкм)', cfMult: 1.36 }
};

export const OR_MOTORS = {
  c6: {
    id: 'c6',
    name: 'МРД C6 (Ø18×70 мм)',
    motorClass: 'C',
    diaMm: 18,
    lenMm: 70,
    propMassG: 11,
    caseMassG: 14,
    totalImp: 10,
    burnTime: 1.6,
    curve: [[0, 0], [0.18, 14.2], [0.35, 5.8], [1.45, 4.9], [1.6, 0]]
  },
  rd1_50: {
    id: 'rd1_50',
    name: 'РД1-50 (F40 · 55 Н·с)',
    motorClass: 'F',
    diaMm: 29,
    lenMm: 115,
    propMassG: 32,
    caseMassG: 35,
    totalImp: 55,
    burnTime: 1.4,
    curve: [[0, 0], [0.14, 56], [0.4, 43], [1.22, 36], [1.4, 0]]
  },
  rd1_100: {
    id: 'rd1_100',
    name: 'РД1-100 (G63 · 120 Н·с)',
    motorClass: 'G',
    diaMm: 29,
    lenMm: 160,
    propMassG: 65,
    caseMassG: 55,
    totalImp: 120,
    burnTime: 1.9,
    curve: [[0, 0], [0.18, 92], [0.55, 68], [1.65, 55], [1.9, 0]]
  },
  g80: {
    id: 'g80',
    name: 'AeroTech G80T (137 Н·с)',
    motorClass: 'G',
    diaMm: 29,
    lenMm: 124,
    propMassG: 62.5,
    caseMassG: 63,
    totalImp: 137,
    burnTime: 1.7,
    curve: [[0, 0], [0.08, 108], [0.5, 88], [1.45, 74], [1.7, 0]]
  },
  imp_250: {
    id: 'imp_250',
    name: 'Импульс-250 CanSat (H120 · 310 Н·с)',
    motorClass: 'H',
    diaMm: 38,
    lenMm: 230,
    propMassG: 165,
    caseMassG: 110,
    totalImp: 310,
    burnTime: 2.6,
    curve: [[0, 0], [0.22, 168], [0.8, 132], [2.25, 104], [2.6, 0]]
  },
  i285: {
    id: 'i285',
    name: 'Cesaroni I285R (495 Н·с)',
    motorClass: 'I',
    diaMm: 38,
    lenMm: 320,
    propMassG: 255,
    caseMassG: 185,
    totalImp: 495,
    burnTime: 1.75,
    curve: [[0, 0], [0.12, 355], [0.7, 305], [1.5, 250], [1.75, 0]]
  },
  strato_900: {
    id: 'strato_900',
    name: 'Страто-900 Высотный (J260 · 980 Н·с)',
    motorClass: 'J',
    diaMm: 54,
    lenMm: 390,
    propMassG: 460,
    caseMassG: 210,
    totalImp: 980,
    burnTime: 3.8,
    curve: [[0, 0], [0.28, 360], [1.2, 285], [3.25, 225], [3.8, 0]]
  },
  k550: {
    id: 'k550',
    name: 'РДТТ K550W Сверхзвук (1680 Н·с)',
    motorClass: 'K',
    diaMm: 54,
    lenMm: 490,
    propMassG: 820,
    caseMassG: 390,
    totalImp: 1680,
    burnTime: 3.05,
    curve: [[0, 0], [0.18, 740], [1.0, 610], [2.55, 480], [3.05, 0]]
  }
};

export function classifyImpulse(impNs) {
  if (impNs <= 2.5) return 'A';
  if (impNs <= 5) return 'B';
  if (impNs <= 10) return 'C';
  if (impNs <= 20) return 'D';
  if (impNs <= 40) return 'E';
  if (impNs <= 80) return 'F';
  if (impNs <= 160) return 'G';
  if (impNs <= 320) return 'H';
  if (impNs <= 640) return 'I';
  if (impNs <= 1280) return 'J';
  if (impNs <= 2560) return 'K';
  return 'L';
}

export function sampleMotorThrust(motor, t) {
  if (!motor || t <= 0 || t >= motor.burnTime) return 0;
  const pts = motor.curve;
  if (!pts || pts.length < 2) {
    return motor.totalImp / motor.burnTime;
  }
  for (let i = 1; i < pts.length; i++) {
    const [t0, f0] = pts[i - 1];
    const [t1, f1] = pts[i];
    if (t <= t1) {
      const u = (t - t0) / Math.max(1e-5, t1 - t0);
      return f0 + u * (f1 - f0);
    }
  }
  return 0;
}

/**
 * Парсер стандартного файла двигателя RASP (.eng), совместимого с OpenRocket / ThrustCurve.org
 */
export function parseRaspEng(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith(';'));

  if (lines.length < 2) throw new Error('Файл .eng не содержит заголовка и точек тяги');

  const hdr = lines[0].split(/\s+/);
  if (hdr.length < 6) throw new Error('Некорректный заголовок RASP .eng');

  const code = hdr[0];
  const diaMm = Number(hdr[1]) || 29;
  const lenMm = Number(hdr[2]) || 150;
  const propKg = Number(hdr[4]) || 0.05;
  const totalKg = Number(hdr[5]) || 0.10;
  const mfg = hdr[6] || 'Custom';

  const curve = [[0, 0]];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length >= 2) {
      const t = Number(parts[0]);
      const f = Number(parts[1]);
      if (Number.isFinite(t) && Number.isFinite(f)) {
        curve.push([t, Math.max(0, f)]);
      }
    }
  }
  curve.sort((a, b) => a[0] - b[0]);
  const burnTime = curve[curve.length - 1][0];
  if (burnTime <= 0.05) throw new Error('Нулевое время работы двигателя в .eng');

  let imp = 0;
  for (let i = 1; i < curve.length; i++) {
    imp += 0.5 * (curve[i][1] + curve[i - 1][1]) * (curve[i][0] - curve[i - 1][0]);
  }

  const mClass = classifyImpulse(imp);
  const id = 'eng_' + code.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.round(imp);
  const motorObj = {
    id,
    name: `${mfg} ${code} (${imp.toFixed(0)} Н·с, .eng)`,
    motorClass: mClass,
    diaMm,
    lenMm,
    propMassG: Math.max(5, propKg * 1000),
    caseMassG: Math.max(10, (totalKg - propKg) * 1000),
    totalImp: imp,
    burnTime,
    curve
  };
  OR_MOTORS[id] = motorObj;
  return motorObj;
}

export const ROCKET_PRESETS = {
  cansat_vish: {
    label: 'Носитель ВИШ «CanSat» (Ø70 мм, Dual-Deploy)',
    design: {
      caliberMm: 70,
      noseShape: 'ogive',
      noseLenMm: 165,
      noseMassG: 30,
      bodyMaterial: 'fiberglass',
      surfaceFinish: 'gloss',
      bodyLenMm: 640,
      wallMm: 1.8,
      hasCanSat: true,
      payloadMassG: 310,
      payloadPosFrac: 0.28,
      finCount: 4,
      finRootMm: 120,
      finTipMm: 52,
      finSpanMm: 82,
      finSweepMm: 55,
      finProfile: 'rounded',
      finMaterial: 'fiberglass',
      boatTailEnabled: false,
      boatTailLenMm: 45,
      boatTailAftDiaMm: 52,
      motorId: 'imp_250',
      deployMode: 'dual', // 'baro' | 'dual' | 'timer'
      drogueDiamCm: 28,
      chuteDiamCm: 80,
      mainDeployAltM: 250,
      timerSec: 6.5,
      twoStage: false,
      boosterLenMm: 290,
      boosterFinSpanMm: 105,
      boosterMotorId: 'i285',
      stageDelaySec: 0.6
    }
  },
  junior_c6: {
    label: 'Учебная модель начального уровня (Ø40 мм, РД1-50)',
    design: {
      caliberMm: 40,
      noseShape: 'ogive',
      noseLenMm: 100,
      noseMassG: 10,
      bodyMaterial: 'cardboard',
      surfaceFinish: 'matte',
      bodyLenMm: 360,
      wallMm: 1.2,
      hasCanSat: false,
      payloadMassG: 35,
      payloadPosFrac: 0.3,
      finCount: 3,
      finRootMm: 70,
      finTipMm: 30,
      finSpanMm: 52,
      finSweepMm: 32,
      finProfile: 'rounded',
      finMaterial: 'balsa',
      boatTailEnabled: false,
      boatTailLenMm: 30,
      boatTailAftDiaMm: 30,
      motorId: 'rd1_50',
      deployMode: 'baro',
      drogueDiamCm: 20,
      chuteDiamCm: 45,
      mainDeployAltM: 180,
      timerSec: 5.5,
      twoStage: false,
      boosterLenMm: 220,
      boosterFinSpanMm: 65,
      boosterMotorId: 'rd1_50',
      stageDelaySec: 0.4
    }
  },
  tandem_2stage: {
    label: 'Двухступенчатая «Тандем-Страто» (Бустер I285 + Марш G80)',
    design: {
      caliberMm: 66,
      noseShape: 'haack',
      noseLenMm: 185,
      noseMassG: 35,
      bodyMaterial: 'carbon',
      surfaceFinish: 'polished',
      bodyLenMm: 520,
      wallMm: 1.5,
      hasCanSat: false,
      payloadMassG: 140,
      payloadPosFrac: 0.26,
      finCount: 4,
      finRootMm: 95,
      finTipMm: 42,
      finSpanMm: 68,
      finSweepMm: 48,
      finProfile: 'airfoil',
      finMaterial: 'carbon',
      boatTailEnabled: false,
      boatTailLenMm: 40,
      boatTailAftDiaMm: 48,
      motorId: 'g80',
      deployMode: 'dual',
      drogueDiamCm: 25,
      chuteDiamCm: 70,
      mainDeployAltM: 280,
      timerSec: 9.0,
      twoStage: true,
      boosterLenMm: 340,
      boosterFinSpanMm: 96,
      boosterMotorId: 'i285',
      stageDelaySec: 0.8
    }
  },
  mach_probe: {
    label: 'Сверхзвуковой зонд Мах 1.4+ (Хаак + Boat-Tail + K550)',
    design: {
      caliberMm: 60,
      noseShape: 'haack',
      noseLenMm: 240,
      noseMassG: 45,
      bodyMaterial: 'carbon',
      surfaceFinish: 'polished',
      bodyLenMm: 620,
      wallMm: 1.6,
      hasCanSat: false,
      payloadMassG: 60,
      payloadPosFrac: 0.25,
      finCount: 3,
      finRootMm: 140,
      finTipMm: 45,
      finSpanMm: 95,
      finSweepMm: 78,
      finProfile: 'airfoil',
      finMaterial: 'carbon',
      boatTailEnabled: true,
      boatTailLenMm: 55,
      boatTailAftDiaMm: 46,
      motorId: 'k550',
      deployMode: 'dual',
      drogueDiamCm: 24,
      chuteDiamCm: 75,
      mainDeployAltM: 300,
      timerSec: 12.0,
      twoStage: false,
      boosterLenMm: 320,
      boosterFinSpanMm: 88,
      boosterMotorId: 'i285',
      stageDelaySec: 0.5
    }
  }
};

/**
 * Расчёт геометрии, массы, ЦМ, ЦД (расширенный метод Барроумена) и составляющих Cd(Mach)
 * @param {object} d - конфигурация ракеты
 * @param {object} opts - { includeBooster: boolean, propFracStage2: 0..1, propFracStage1: 0..1, mach: number, thrustActive: boolean }
 */
export function analyzeRocketOpenRocket(d, opts = {}) {
  const includeBooster = opts.includeBooster !== undefined ? opts.includeBooster : !!d.twoStage;
  const propFrac2 = opts.propFracStage2 !== undefined ? opts.propFracStage2 : 1.0;
  const propFrac1 = opts.propFracStage1 !== undefined ? opts.propFracStage1 : 1.0;
  const mach = opts.mach !== undefined ? opts.mach : 0.3;
  const thrustActive = !!opts.thrustActive;

  const D = (d.caliberMm || 70) / 1000; // m
  const R = D / 2;
  const refArea = Math.PI * R * R;

  const noseMeta = OR_NOSE_SHAPES[d.noseShape] || OR_NOSE_SHAPES.ogive;
  const bodyMat = OR_MATERIALS[d.bodyMaterial] || OR_MATERIALS.fiberglass;
  const finMat = OR_MATERIALS[d.finMaterial || d.bodyMaterial] || bodyMat;
  const finProf = OR_FIN_PROFILES[d.finProfile] || OR_FIN_PROFILES.rounded;
  const finish = OR_FINISHES[d.surfaceFinish] || OR_FINISHES.gloss;

  const wallM = ((d.wallMm || 1.8) * bodyMat.wallScale) / 1000;
  const Lnose = (d.noseLenMm || 165) / 1000;
  const Lbody = (d.bodyLenMm || 640) / 1000;
  const hasTail = !!d.boatTailEnabled && !includeBooster;
  const Ltail = hasTail ? (d.boatTailLenMm || 45) / 1000 : 0;
  const Daft = hasTail ? Math.min(D * 0.98, Math.max(D * 0.55, (d.boatTailAftDiaMm || D * 750) / 1000)) : D;

  const Lboost = includeBooster ? (d.boosterLenMm || 300) / 1000 : 0;
  const totalLenM = Lnose + Lbody + Ltail + Lboost;

  const components = [];
  let sumMassKg = 0;
  let sumMomentKgM = 0;
  const addComp = (id, name, xStartM, lenM, massKg) => {
    const cgM = xStartM + lenM * 0.5;
    components.push({
      id,
      name,
      xMm: xStartM * 1000,
      lenMm: lenM * 1000,
      massG: massKg * 1000
    });
    sumMassKg += massKg;
    sumMomentKgM += massKg * cgM;
  };

  // 1. Nose shell + Nose ballast
  const noseArea = Math.PI * D * Lnose * noseMeta.surfFrac;
  const mNoseShell = noseArea * wallM * bodyMat.rho;
  addComp('nose', 'Головной обтекатель', 0, Lnose, mNoseShell);

  const mBallast = Math.max(0, (d.noseMassG || 0) / 1000);
  if (mBallast > 0) {
    sumMassKg += mBallast;
    sumMomentKgM += mBallast * (Lnose * 0.42);
    components.push({ id: 'ballast', name: 'Носовой балласт', xMm: Lnose * 250, lenMm: Lnose * 300, massG: mBallast * 1000 });
  }

  // 2. Sustainer Body Tube
  const mBody = Math.PI * D * Lbody * wallM * bodyMat.rho;
  addComp('body', 'Корпусная труба', Lnose, Lbody, mBody);

  // 3. Recovery system (Parachutes)
  const rMain = (d.chuteDiamCm || 75) / 200;
  const rDrogue = d.deployMode === 'dual' ? (d.drogueDiamCm || 25) / 200 : 0;
  const mChutes = 0.018 + Math.PI * rMain * rMain * 0.065 + Math.PI * rDrogue * rDrogue * 0.075;
  addComp('recovery', 'Система спасения (парашют)', Lnose + Lbody * 0.08, Lbody * 0.16, mChutes);

  // 4. Payload / CanSat
  const payloadMassKg = d.hasCanSat ? Math.max(0.31, (d.payloadMassG || 310) / 1000) : (d.payloadMassG || 0) / 1000;
  if (payloadMassKg > 0.001) {
    const pFrac = d.payloadPosFrac || 0.28;
    addComp(
      'payload',
      d.hasCanSat ? 'Отсек CanSat (0.33 л)' : 'Бортовая электроника',
      Lnose + Lbody * pFrac,
      0.115,
      payloadMassKg
    );
  }

  // 5. Sustainer Fins
  const nFins = d.finCount || 4;
  const Cr = (d.finRootMm || 115) / 1000;
  const Ct = (d.finTipMm || 50) / 1000;
  const sSpan = (d.finSpanMm || 80) / 1000;
  const sweep = (d.finSweepMm || 50) / 1000;
  const finThick = 0.0032;
  const singleFinArea = 0.5 * (Cr + Ct) * sSpan;
  const mFins = nFins * singleFinArea * finThick * finMat.rho;
  const xFinStart = Lnose + Lbody - Cr - 0.008;
  addComp('fins', `Стабилизаторы (${nFins} шт.)`, xFinStart, Cr, mFins);

  // 6. Boat-Tail (if active)
  if (hasTail) {
    const mTail = Math.PI * 0.5 * (D + Daft) * Ltail * wallM * bodyMat.rho;
    addComp('boattail', 'Хвостовое сужение (Boat-Tail)', Lnose + Lbody, Ltail, mTail);
  }

  // 7. Sustainer Motor
  const motor2 = OR_MOTORS[d.motorId] || OR_MOTORS.imp_250;
  const mMot2 = (motor2.caseMassG + motor2.propMassG * propFrac2) / 1000;
  const lenMot2 = Math.min(Lbody * 0.75, (motor2.lenMm || 180) / 1000);
  addComp('motor', `МРД: ${motor2.name}`, Lnose + Lbody + Ltail - lenMot2, lenMot2, mMot2);

  // 8. Optional Stage 1 Booster
  let motor1 = null;
  if (includeBooster) {
    const xBoost = Lnose + Lbody;
    const mBoostTube = Math.PI * D * Lboost * wallM * bodyMat.rho * 1.12; // includes coupler
    addComp('booster', 'Корпус 1-й ступени (Бустер)', xBoost, Lboost, mBoostTube);

    const sBoost = (d.boosterFinSpanMm || 100) / 1000;
    const CrB = Cr * 1.12;
    const CtB = Ct * 1.1;
    const mBoostFins = nFins * 0.5 * (CrB + CtB) * sBoost * 0.0036 * finMat.rho;
    addComp('booster_fins', 'Стабилизаторы бустера', xBoost + Lboost - CrB - 0.006, CrB, mBoostFins);

    motor1 = OR_MOTORS[d.boosterMotorId || 'i285'] || OR_MOTORS.i285;
    const mMot1 = (motor1.caseMassG + motor1.propMassG * propFrac1) / 1000;
    const lenMot1 = Math.min(Lboost * 0.9, (motor1.lenMm || 260) / 1000);
    addComp('booster_motor', `Бустер МРД: ${motor1.name}`, xBoost + Lboost - lenMot1, lenMot1, mMot1);
  }

  const cgM = sumMomentKgM / Math.max(0.01, sumMassKg);

  // === EXTENDED BARROWMAN CP ===
  let cnSum = 0;
  let cnMoment = 0;

  // Nose Cone
  const cnNose = 2.0;
  const xCpNose = Lnose * noseMeta.cpFrac;
  cnSum += cnNose;
  cnMoment += cnNose * xCpNose;

  // Sustainer Fins
  const calcFinBarrowman = (root, tip, span, swp, xLead, count) => {
    const midChord = Math.hypot(span, swp + 0.5 * (tip - root));
    const kFb = 1 + R / (span + R);
    const cn =
      kFb *
      ((4 * count * ((span / D) ** 2)) /
        (1 + Math.sqrt(1 + ((2 * midChord) / (root + tip)) ** 2)));
    const xCpLocal =
      (swp * (root + 2 * tip)) / (3 * (root + tip)) +
      (root + tip - (root * tip) / (root + tip)) / 6;
    return { cn, xCp: xLead + xCpLocal };
  };

  const f2 = calcFinBarrowman(Cr, Ct, sSpan, sweep, xFinStart, nFins);
  cnSum += f2.cn;
  cnMoment += f2.cn * f2.xCp;

  // Boat-tail transition (destabilizing negative CNalpha in Barrowman!)
  if (hasTail && Ltail > 0.005) {
    const ratio = Daft / D;
    const cnTail = 2 * (ratio * ratio - 1);
    const xCpTail = Lnose + Lbody + (Ltail / 3) * ((1 + (1 - ratio) / (1 - ratio * ratio)));
    cnSum += cnTail;
    cnMoment += cnTail * xCpTail;
  }

  // Booster Fins (when stage 1 attached)
  if (includeBooster) {
    const sBoost = (d.boosterFinSpanMm || 100) / 1000;
    const CrB = Cr * 1.12;
    const CtB = Ct * 1.1;
    const xLeadB = Lnose + Lbody + Lboost - CrB - 0.006;
    const f1 = calcFinBarrowman(CrB, CtB, sBoost, sweep * 1.05, xLeadB, nFins);
    cnSum += f1.cn;
    cnMoment += f1.cn * f1.xCp;
  }

  const cpM = cnMoment / Math.max(0.2, cnSum);
  const stabilityCal = (cpM - cgM) / D;
  const stabilityPct = ((cpM - cgM) / totalLenM) * 100;

  // === OPENROCKET DRAG BREAKDOWN Cd(Mach) ===
  const wettedBody = Math.PI * D * (Lbody + Lboost + Ltail) + noseArea;
  const wettedFins = 2 * nFins * singleFinArea * (includeBooster ? 2.15 : 1.0);
  const cfBase = 0.0038 * finish.cfMult;
  const cdFriction = cfBase * ((wettedBody + wettedFins) / refArea);

  const finFrontalRatio = (nFins * sSpan * finThick) / refArea;
  const cdPressureSub = noseMeta.cdForm + finFrontalRatio * finProf.dragMult * (includeBooster ? 1.85 : 1.0);

  const aftRatio = Daft / D;
  const cdBaseSub = (thrustActive ? 0.04 : 0.13) * (aftRatio ** 3);

  // Compressibility & transonic wave drag multiplier
  let waveMult = 1.0;
  if (mach > 0.72 && mach <= 1.05) {
    const u = (mach - 0.72) / 0.33;
    waveMult = 1.0 + u * u * (0.95 + noseMeta.cdForm * 2.5);
  } else if (mach > 1.05) {
    const peak = 1.95 + noseMeta.cdForm * 2.5;
    waveMult = 1.12 + (peak - 1.12) / Math.sqrt(1 + 2.2 * ((mach - 1.05) ** 1.4));
  }

  const cdPressure = cdPressureSub * waveMult;
  const cdBase = cdBaseSub * (mach > 1.0 ? 0.75 : 1.0);
  const cdTotal = cdFriction + cdPressure + cdBase;

  const activeMotor = includeBooster ? motor1 : motor2;
  const avgThrust = activeMotor.totalImp / activeMotor.burnTime;
  const twRatio = avgThrust / (sumMassKg * 9.80665);

  return {
    caliberMm: D * 1000,
    totalLenMm: totalLenM * 1000,
    noseLenMm: Lnose * 1000,
    bodyLenMm: Lbody * 1000,
    tailLenMm: Ltail * 1000,
    aftDiaMm: Daft * 1000,
    boosterLenMm: Lboost * 1000,
    totalMassKg: sumMassKg,
    cgMm: cgM * 1000,
    cpMm: cpM * 1000,
    calCm: D * 100,
    totalLenCm: totalLenM * 100,
    noseLenCm: Lnose * 100,
    cgCm: cgM * 100,
    cpCm: cpM * 100,
    stabilityCal,
    stabilityPct,
    cdFriction,
    cdPressure,
    cdBase,
    cdTotal,
    cx: cdTotal,
    twRatio,
    refArea,
    components,
    motor1,
    motor2,
    includeBooster
  };
}

/**
 * Полное 2D-моделирование полёта ракеты (OpenRocket Flight Simulator)
 */
export function simulateOpenRocket(design, env = {}) {
  const railLenM = env.railLenM ?? 1.5;
  const rodAngleDeg = env.rodAngleDeg ?? 3;
  const windSpeedMs = env.windSpeedMs ?? 3.5;
  const siteAltM = env.siteAltM ?? 150;
  const groundTempC = env.groundTempC ?? 18;

  const dt = 0.02;
  let t = 0;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let pitchRad = (rodAngleDeg * Math.PI) / 180; // 0 = vertical up, + = tilted downwind (+X)

  const stage1ActiveInit = !!design.twoStage;
  let hasBooster = stage1ActiveInit;
  let stage2Ignited = !stage1ActiveInit;
  let stage2StartT = stage1ActiveInit ? Infinity : 0;

  const motor1 = stage1ActiveInit ? (OR_MOTORS[design.boosterMotorId] || OR_MOTORS.i285) : null;
  const motor2 = OR_MOTORS[design.motorId] || OR_MOTORS.imp_250;

  let railCleared = false;
  let railExitSpeedMs = 0;
  let burnout1Logged = false;
  let burnout2Logged = false;
  let apogeeReached = false;
  let drogueOpen = false;
  let mainOpen = false;
  let chuteRipped = false;
  let tumbling = false;

  let maxAltM = 0;
  let maxSpeedMs = 0;
  let maxMach = 0;
  let maxAccelG = 0;
  let deploySpeedMs = 0;

  const events = [];
  const series = [];

  // Initial check
  const initAero = analyzeRocketOpenRocket(design, { includeBooster: hasBooster, propFracStage1: 1, propFracStage2: 1, mach: 0 });
  if (initAero.twRatio < 1.25) {
    return {
      ok: false,
      aborted: true,
      statusText: 'Тяга меньше веса ракеты (T/W < 1.25)!',
      maxAltM: 0,
      maxSpeedMs: 0,
      maxMach: 0,
      maxAccelG: 1,
      railExitSpeedMs: 0,
      deploySpeedMs: 0,
      touchdownSpeedMs: 0,
      driftM: 0,
      flightTimeSec: 0,
      landedOk: false,
      chuteRipped: false,
      tumbling: false,
      events: [{ t: 0, label: 'Отказ схода со стола', type: 'err', y: 0 }],
      series: []
    };
  }

  const maxSimTime = 420;
  let stepIdx = 0;

  while (t < maxSimTime) {
    // Stage progression
    let thrustN = 0;
    let pFrac1 = 0;
    let pFrac2 = 1;

    if (hasBooster && motor1) {
      pFrac1 = Math.max(0, 1 - t / motor1.burnTime);
      if (t <= motor1.burnTime) {
        thrustN = sampleMotorThrust(motor1, t);
      } else {
        if (!burnout1Logged) {
          burnout1Logged = true;
          events.push({ t, label: 'Выгорание 1-й ст.', type: 'info', x, y });
          stage2StartT = t + (design.stageDelaySec ?? 0.6);
        }
        if (t >= stage2StartT - 0.15) {
          hasBooster = false;
          events.push({ t, label: 'Разделение ступеней', type: 'ok', x, y });
        }
      }
    }

    if (!hasBooster) {
      if (!stage2Ignited && t >= stage2StartT) {
        stage2Ignited = true;
        events.push({ t, label: 'Запуск 2-й ступени', type: 'ok', x, y });
      }
      if (stage2Ignited) {
        const t2 = t - stage2StartT;
        pFrac2 = Math.max(0, 1 - t2 / motor2.burnTime);
        if (t2 <= motor2.burnTime) {
          thrustN = sampleMotorThrust(motor2, t2);
        } else if (!burnout2Logged) {
          burnout2Logged = true;
          events.push({ t, label: 'Выгорание МРД', type: 'info', x, y });
        }
      }
    }

    // Atmosphere at altitude (siteAltM + y)
    const absAlt = siteAltM + Math.max(0, y);
    const tempK = Math.max(216.65, (groundTempC + 273.15) - 0.0065 * Math.max(0, y));
    const pressurePa = 101325 * Math.pow(Math.max(0.05, 1 - (0.0065 * absAlt) / 288.15), 5.2558);
    const rho = pressurePa / (287.05 * tempK);
    const speedOfSound = Math.sqrt(1.4 * 287.05 * tempK);

    // Wind shear profile
    const windAtAlt = railCleared ? windSpeedMs * Math.pow(Math.max(10, y) / 10, 0.16) : 0;
    const vRelX = vx - windAtAlt;
    const vRelY = vy;
    const vRel = Math.hypot(vRelX, vRelY) || 1e-5;
    const speed = Math.hypot(vx, vy);
    const mach = vRel / speedOfSound;

    const aero = analyzeRocketOpenRocket(design, {
      includeBooster: hasBooster,
      propFracStage1: pFrac1,
      propFracStage2: pFrac2,
      mach,
      thrustActive: thrustN > 1
    });

    // Check rail clearance
    const distFromPad = Math.hypot(x, y);
    if (!railCleared && distFromPad >= railLenM) {
      railCleared = true;
      railExitSpeedMs = speed;
      events.push({
        t,
        label: `Сход с рельса (${railExitSpeedMs.toFixed(1)} м/с)`,
        type: railExitSpeedMs >= 14 ? 'ok' : 'warn',
        x,
        y
      });
    }

    // Stability check once off the rail
    if (railCleared && !tumbling && !drogueOpen && !mainOpen && aero.stabilityCal < 0.30 && vRel > 12) {
      tumbling = true;
      events.push({ t, label: 'Потеря устойчивости (кувырок!)', type: 'err', x, y });
    }

    // Pitch dynamics (weathercocking on wind before parachute opens)
    if (!railCleared) {
      pitchRad = (rodAngleDeg * Math.PI) / 180;
    } else if (tumbling) {
      pitchRad += 10.5 * dt;
    } else if (!drogueOpen && !mainOpen && vRel > 4) {
      const flowAngle = Math.atan2(vRelX, vRelY);
      const relax = Math.min(1, dt * (1.8 + Math.max(0, aero.stabilityCal) * 0.9));
      pitchRad += (flowAngle - pitchRad) * relax;
    }

    // Effective Drag Area
    let cdArea = aero.cdTotal * aero.refArea;
    if (tumbling) cdArea *= 4.6;
    if (drogueOpen && !mainOpen && !chuteRipped) {
      const rD = (design.drogueDiamCm || 26) / 200;
      cdArea += 1.25 * Math.PI * rD * rD;
    }
    if (mainOpen && !chuteRipped) {
      const rM = (design.chuteDiamCm || 75) / 200;
      cdArea += 1.42 * Math.PI * rM * rM;
    }

    const dragMag = 0.5 * rho * vRel * vRel * cdArea;
    const dragX = -dragMag * (vRelX / vRel);
    const dragY = -dragMag * (vRelY / vRel);

    const thrustX = thrustN * Math.sin(pitchRad);
    const thrustY = thrustN * Math.cos(pitchRad);

    let ax = (thrustX + dragX) / aero.totalMassKg;
    let ay = (thrustY + dragY) / aero.totalMassKg - 9.80665;

    if (!railCleared && thrustN > 0) {
      // Constrain along launch rail vector
      const sProj = ax * Math.sin(pitchRad) + ay * Math.cos(pitchRad);
      if (sProj < 0) {
        ax = 0;
        ay = 0;
      } else {
        ax = sProj * Math.sin(pitchRad);
        ay = sProj * Math.cos(pitchRad);
      }
    }

    const prevVy = vy;
    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;

    const accelG = Math.hypot(ax, ay + 9.80665) / 9.80665;
    if (y > maxAltM) maxAltM = y;
    if (speed > maxSpeedMs) maxSpeedMs = speed;
    if (mach > maxMach) maxMach = mach;
    if (accelG > maxAccelG) maxAccelG = accelG;

    // Apogee event
    if (!apogeeReached && y > 8 && prevVy > 0 && vy <= 0) {
      apogeeReached = true;
      events.push({ t, label: `Апогей ${y.toFixed(0)} м`, type: 'ok', x, y });
    }

    // Recovery deployment logic
    if (!tumbling && t > 0.6) {
      if (design.deployMode === 'timer') {
        if (!mainOpen && t >= (design.timerSec || 6.5)) {
          mainOpen = true;
          deploySpeedMs = vRel;
          if (vRel > 35) {
            chuteRipped = true;
            events.push({ t, label: `Обрыв строп (${vRel.toFixed(0)} м/с)!`, type: 'err', x, y });
          } else {
            events.push({ t, label: 'Раскрытие парашюта (таймер)', type: 'ok', x, y });
          }
        }
      } else if (design.deployMode === 'dual') {
        if (apogeeReached && !drogueOpen) {
          drogueOpen = true;
          deploySpeedMs = vRel;
          events.push({ t, label: 'Вытяжной купол (Drogue)', type: 'ok', x, y });
        }
        if (drogueOpen && !mainOpen && vy < 0 && y <= (design.mainDeployAltM || 250)) {
          mainOpen = true;
          if (vRel > 42) {
            chuteRipped = true;
            events.push({ t, label: 'Обрыв основного купола!', type: 'err', x, y });
          } else {
            events.push({ t, label: `Основной парашют (${y.toFixed(0)} м)`, type: 'ok', x, y });
          }
        }
      } else {
        // 'baro' single apogee deploy
        if (apogeeReached && !mainOpen) {
          mainOpen = true;
          deploySpeedMs = vRel;
          if (vRel > 35) {
            chuteRipped = true;
            events.push({ t, label: `Обрыв строп (${vRel.toFixed(0)} м/с)!`, type: 'err', x, y });
          } else {
            events.push({ t, label: 'Парашют раскрыт (апогей)', type: 'ok', x, y });
          }
        }
      }
    }

    if (stepIdx % 5 === 0) {
      series.push({
        t,
        x,
        y: Math.max(0, y),
        vy,
        v: speed,
        mach,
        accelG,
        thrustN,
        dragN: dragMag,
        cd: aero.cdTotal,
        stab: aero.stabilityCal,
        pressureHpa: pressurePa / 100,
        pitchRad,
        chute: (mainOpen || drogueOpen) && !chuteRipped,
        mainOpen: mainOpen && !chuteRipped
      });
    }
    stepIdx++;

    if (y <= 0 && t > 0.5 && vy <= 0) {
      y = 0;
      const touchdownSpeedMs = Math.hypot(vx, vy);
      const landedOk = !tumbling && !chuteRipped && mainOpen && touchdownSpeedMs <= 8.2;
      events.push({
        t,
        label: landedOk
          ? `Посадка (${touchdownSpeedMs.toFixed(1)} м/с)`
          : `Жёсткий удар (${touchdownSpeedMs.toFixed(1)} м/с)`,
        type: landedOk ? 'ok' : 'err',
        x,
        y: 0
      });

      return {
        ok: true,
        aborted: false,
        landedOk,
        chuteRipped,
        tumbling,
        statusText: landedOk
          ? `Мягкая посадка (${touchdownSpeedMs.toFixed(1)} м/с)`
          : tumbling
            ? 'Авария: кувырок из-за неустойчивости'
            : chuteRipped
              ? 'Авария: обрыв строп парашюта'
              : `Жёсткая посадка (${touchdownSpeedMs.toFixed(1)} м/с)`,
        maxAltM,
        maxSpeedMs,
        maxMach,
        maxAccelG,
        railExitSpeedMs,
        deploySpeedMs,
        touchdownSpeedMs,
        driftM: x,
        flightTimeSec: t,
        events,
        series
      };
    }
  }

  return {
    ok: true,
    aborted: false,
    landedOk: true,
    chuteRipped: false,
    tumbling: false,
    statusText: 'Спуск завершён',
    maxAltM,
    maxSpeedMs,
    maxMach,
    maxAccelG,
    railExitSpeedMs,
    deploySpeedMs,
    touchdownSpeedMs: 5.0,
    driftM: x,
    flightTimeSec: t,
    events,
    series
  };
}
