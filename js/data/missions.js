export const MISSIONS = [
  // === LAB 1: CUBESAT ===
  {
    id: 'bdot_detumble',
    lab: 'cubesat',
    track: 'Базовый · 12–15 лет',
    badge: 'Ориентация КА',
    title: '1. Гашение закрутки после отделения от РН',
    desc: 'После выхода из пускового контейнера спутник вращается со скоростью 28 °/с. Включите режим демпфирования (B-dot / ДУС) и погасите угловую скорость до |ω| < 1.0 °/с.',
    hint: 'Выберите пресет кода «2. Гашение закрутки (демпфер)» или подайте момент, противоположный знаку sensors.gyro, и нажмите ▶ Старт.',
    preset: {
      theta: 42,
      omega: 28,
      sunAngle: 0,
      targetAngle: 90,
      eclipse: false,
      presetCode: 'detumble',
      faultSensorInvert: false,
      faultGyroDead: false
    },
    check(state) {
      if (state.simTime > 3 && Math.abs(state.omega) < 1.0) {
        return { ok: true, msg: `Закрутка погашена! Остаточная скорость ${state.omega.toFixed(2)} °/с.` };
      }
      return { ok: false, progress: `Текущая |ω| = ${Math.abs(state.omega).toFixed(1)} °/с (цель < 1.0 °/с)` };
    }
  },
  {
    id: 'target_imaging',
    lab: 'cubesat',
    track: 'Проектный / НТО · 14–18 лет',
    badge: 'ПД-регулятор',
    title: '2. Точное наведение на цель и космоснимок',
    desc: 'Наведите камеру наноспутника на наземный объект (угол цели 115°) с точностью ±2.5° при угловой скорости |ω| < 1.5 °/с и выполните съёмку.',
    hint: 'Используйте ПД-регулятор маховика на угол 115° (пресет «3. ПД-наведение на цель и съёмка») и убедитесь, что модуль «Камера ДЗЗ» включён.',
    preset: {
      theta: -25,
      omega: 6,
      sunAngle: 30,
      targetAngle: 115,
      eclipse: false,
      presetCode: 'pd_target',
      faultSensorInvert: false,
      faultGyroDead: false
    },
    check(state) {
      if (state.photosTaken > 0 && state.lastPhotoError !== null && state.lastPhotoError <= 2.5) {
        return { ok: true, msg: `Чёткий снимок цели получен! Ошибка наведения ${state.lastPhotoError.toFixed(2)}°.` };
      }
      return {
        ok: false,
        progress: `Ошибка наведения на цель: ${Math.abs(state.targetError).toFixed(1)}° · Снимков в допуске: 0`
      };
    }
  },
  {
    id: 'broken_polarity',
    lab: 'cubesat',
    track: 'НТО «Спутниковые системы»',
    badge: 'Нештатная ситуация',
    title: '3. Авария: инверсия солнечных датчиков',
    desc: 'При попытке навестись на Солнце маховик раскручивает спутник в разнос! Найдите причину (перепутана полярность солнечных датчиков на шине) и стабилизируйте КА на Солнце (±3°).',
    hint: 'Откройте вкладку «Компоновка и шина» на центральном столе и отключите неисправность «Инверсия солнечных датчиков» (либо поменяйте знак Kp в коде БКУ), затем сбросьте обороты.',
    preset: {
      theta: 35,
      omega: 0,
      sunAngle: 0,
      targetAngle: 0,
      eclipse: false,
      presetCode: 'pd_sun',
      faultSensorInvert: true,
      faultGyroDead: false
    },
    check(state) {
      if (state.simTime > 4 && Math.abs(state.sunError) < 3.0 && Math.abs(state.omega) < 1.5 && !state.eclipse) {
        return { ok: true, msg: 'Неисправность устранена! Спутник стабильно ориентирован на Солнце.' };
      }
      return {
        ok: false,
        progress: `Отклонение от Солнца: ${Math.abs(state.sunError).toFixed(1)}° · |ω| = ${Math.abs(state.omega).toFixed(1)} °/с`
      };
    }
  },

  // === LAB 2: ORBIT ===
  {
    id: 'iss_rendezvous',
    lab: 'orbit',
    track: 'Базовый · 12–16 лет',
    badge: 'Баллистика',
    title: '4. Гомановский переход на орбиту МКС (420 км)',
    desc: 'Корабль «Союз-МС» выведен на низкую опорную орбиту 200 км. Двумя импульсами переведите его на круговую орбиту МКС (перигей и апогей 405–435 км).',
    hint: '1-й разгонный импульс (~63 м/с) поднимает апогей до 420 км. Дождитесь подлёта к апогею и выдайте 2-й импульс (~63 м/с) для скругления орбиты (кнопка «Скруглить — подсказка»).',
    preset: {
      altKm: 200,
      spacecraft: 'soyuz',
      targetAltKm: 420
    },
    check(state) {
      if (!state.crashed && state.hp >= 405 && state.hp <= 435 && state.ha >= 405 && state.ha <= 435) {
        return { ok: true, msg: `Выход на орбиту МКС выполнен: ${state.hp.toFixed(0)} × ${state.ha.toFixed(0)} км!` };
      }
      return {
        ok: false,
        progress: `Текущая орбита: ${state.hp.toFixed(0)} × ${state.ha.toFixed(0)} км (цель: 405–435 × 405–435 км)`
      };
    }
  },
  {
    id: 'geo_transfer',
    lab: 'orbit',
    track: 'Проектный · 14–18 лет',
    badge: 'Дальние орбиты',
    title: '5. Выведение спутника связи на ГСО (35 786 км)',
    desc: 'С опорной орбиты 250 км с помощью кислородно-водородного разгонного блока КВТК переведите спутник на геостационарную орбиту (35 000–36 500 км, e < 0.03).',
    hint: 'Импульс на ГПО с высоты 250 км составляет ~2440 м/с, а доразгон в апогее ГСО — ещё ~1472 м/с. Включите ускорение времени ×200 или ×1000 на перелёте!',
    preset: {
      altKm: 250,
      spacecraft: 'kvtk',
      targetAltKm: 35786
    },
    check(state) {
      if (!state.crashed && state.hp >= 35000 && state.ha <= 36600 && state.ecc < 0.03) {
        return { ok: true, msg: `Спутник на геостационарной орбите! Период обращения ${(state.periodMin / 60).toFixed(2)} ч.` };
      }
      return {
        ok: false,
        progress: `Орбита: ${state.hp.toFixed(0)} × ${state.ha.toFixed(0)} км · e = ${state.ecc.toFixed(3)}`
      };
    }
  },
  {
    id: 'safe_deorbit',
    lab: 'orbit',
    track: 'Вводный · 11–14 лет',
    badge: 'Экология космоса',
    title: '6. Увод отработавшего спутника с орбиты',
    desc: 'У спутника ДЗЗ на высоте 650 км осталось всего 18 кг топлива. Выдайте тормозной импульс (Δv < 0) так, чтобы перигей опустился ниже 95 км и аппарат сгорел в атмосфере.',
    hint: 'Установите отрицательный продольный импульс Δvτ около -165 м/с, выдайте его и дождитесь входа КА в плотные слои атмосферы.',
    preset: {
      altKm: 650,
      spacecraft: 'deorbit_sat',
      targetAltKm: 80
    },
    check(state) {
      if (state.crashed && state.crashReason === 'burnup') {
        return { ok: true, msg: 'Отработавший КА успешно сведён с орбиты и сгорел в плотных слоях атмосферы!' };
      }
      return {
        ok: false,
        progress: `Перигей: ${state.hp.toFixed(0)} км (нужно опустить ниже 95 км и войти в атмосферу)`
      };
    }
  },

  // === LAB 3: ROCKET & CANSAT ===
  {
    id: 'fix_tumble',
    lab: 'rocket',
    track: 'Вводный · 10–13 лет',
    badge: 'Аэродинамика',
    title: '7. Авария: кувырок ракеты (ЦД впереди ЦМ)',
    desc: 'Учебная ракета с куцыми стабилизаторами неустойчива и уходит в кувырок сразу после схода с направляющей. Добейтесь запаса устойчивости 1.3–2.8 калибра и мягкой посадки.',
    hint: 'В «Аэродинамической трубе» увеличьте размах стабилизаторов и добавьте носовой балласт (30–60 г), чтобы красный маркер ЦД ушёл к хвосту позади синего маркера ЦМ.',
    preset: {
      noseShape: 'blunt',
      bodyLenCm: 48,
      finSpanCm: 3.2,
      finCount: 3,
      noseMassG: 0,
      hasCanSat: true,
      motorId: 'rd1_100',
      chuteDiamCm: 65,
      deployMode: 'baro'
    },
    check(state) {
      if (state.landedOk && state.stabilityCal >= 1.2 && state.maxAltM > 180) {
        return {
          ok: true,
          msg: `Стабильный полёт! Апогей ${state.maxAltM.toFixed(0)} м, запас устойчивости ${state.stabilityCal.toFixed(2)} кал.`
        };
      }
      return {
        ok: false,
        progress: `Запас устойчивости: ${state.stabilityCal.toFixed(2)} кал. · Статус посадки: ${state.flightStatusText}`
      };
    }
  },
  {
    id: 'cansat_apogee',
    lab: 'rocket',
    track: 'ВИШ «CanSat в России» · 13–17 лет',
    badge: 'Система спасения',
    title: '8. Выброс и мягкая посадка CanSat с высоты > 1000 м',
    desc: 'Таймер вышибного заряда настроен неверно (срабатывает на разгоне и рвёт стропы!). Настройте раскрытие по барометру в апогее, наберите > 1000 м и посадите аппарат со скоростью < 6.5 м/с.',
    hint: 'Переключите систему спасения на «Бортовой барометр CanSat (апогей)», выберите двигатель «Импульс-250» и купол парашюта 75–90 см.',
    preset: {
      noseShape: 'ogive',
      bodyLenCm: 65,
      finSpanCm: 8.5,
      finCount: 4,
      noseMassG: 35,
      hasCanSat: true,
      motorId: 'imp_250',
      chuteDiamCm: 45,
      deployMode: 'timer',
      timerSec: 2.0
    },
    check(state) {
      if (state.landedOk && state.maxAltM >= 1000 && state.touchdownSpeed <= 6.5) {
        return {
          ok: true,
          msg: `Миссия CanSat выполнена! Апогей ${state.maxAltM.toFixed(0)} м, скорость касания ${state.touchdownSpeed.toFixed(1)} м/с.`
        };
      }
      return {
        ok: false,
        progress: `Макс. высота: ${state.maxAltM.toFixed(0)} м (цель > 1000 м) · Посадка: ${state.flightStatusText}`
      };
    }
  },
  {
    id: 'strato_sounder',
    lab: 'rocket',
    track: 'Проектный · 14–18 лет',
    badge: 'Оптимизация РН',
    title: '9. Высотный метеозонд: апогей свыше 3 000 м',
    desc: 'Спроектируйте лёгкую углепластиковую ракету минимального сопротивления с двигателем «Страто-900», достигните высоты > 3 000 м и спасите полезную нагрузку.',
    hint: 'Выберите оживальный или параболический обтекатель, углепластиковый корпус, умеренный размах стреловидных стабилизаторов (устойчивость ~1.5 кал.) и двигатель «Страто-900».',
    preset: {
      noseShape: 'cone',
      bodyMaterial: 'cardboard',
      bodyLenCm: 75,
      finSpanCm: 9.5,
      finCount: 4,
      noseMassG: 45,
      hasCanSat: true,
      motorId: 'imp_250',
      chuteDiamCm: 80,
      deployMode: 'baro'
    },
    check(state) {
      if (state.landedOk && state.maxAltM >= 3000) {
        return { ok: true, msg: `Рекорд взят! Апогей ${state.maxAltM.toFixed(0)} м с успешным возвращением зонда.` };
      }
      return {
        ok: false,
        progress: `Достигнутый апогей: ${state.maxAltM.toFixed(0)} м (цель ≥ 3000 м + мягкая посадка)`
      };
    }
  },

  // === LAB 4: SDR & REMOTE SENSING ===
  {
    id: 'meteor_pass',
    lab: 'sdr',
    track: 'Базовый · 12–16 лет',
    badge: 'УКВ и Web-SDR',
    title: '10. Сеанс приёма снимка КА «Метеор-М» (Доплер)',
    desc: 'Примите пролёт российского метеоспутника «Метеор-М №2-4» (137.900 МГц). Наведите антенну и компенсируйте сдвиг Доплера так, чтобы декодировать ≥ 80% чистых строк.',
    hint: 'Включите «Автосопровождение антенны» или ведите ротор вручную за меткой КА, а ручкой расстройки SDR удерживайте сигнал по центру полосы приёма (или включите «Авто-Доплер»).',
    preset: {
      mode: 'radio',
      satId: 'meteor',
      autoTrack: false,
      autoDoppler: false
    },
    check(state) {
      if (state.decodedLines >= 70 && state.cleanRatio >= 0.8) {
        return {
          ok: true,
          msg: `Снимок «Метеор-М» принят! Чистых строк: ${(state.cleanRatio * 100).toFixed(0)}%.`
        };
      }
      return {
        ok: false,
        progress: `Принято строк: ${state.decodedLines}/80 · Чёткость: ${(state.cleanRatio * 100).toFixed(0)}% (нужно ≥ 80%)`
      };
    }
  },
  {
    id: 'siberia_fire',
    lab: 'sdr',
    track: 'НТО «Анализ космоснимков»',
    badge: 'ДЗЗ · ИК + NDVI',
    title: '11. Обнаружение лесных пожаров в тайге Приенисейской Сибири',
    desc: 'В видимом канале дымовой шлейф скрывает точные очаги горения. Используйте тепловой канал TIR (10.8 мкм) и индекс NDVI, чтобы отметить на карте все 3 очага лесного пожара.',
    hint: 'Переключитесь на «Анализ снимков ДЗЗ», выберите сцену «Сибирская тайга (пожары)», включите канал «Тепловой ИК (TIR)» и кликните мышью по 3 ярко-жёлтым температурным аномалиям.',
    preset: {
      mode: 'eo',
      sceneId: 'siberia_fires',
      bandMode: 'rgb'
    },
    check(state) {
      if (state.sceneId === 'siberia_fires' && state.foundTargets >= 3) {
        return { ok: true, msg: 'Все 3 очага лесного пожара локализованы и переданы лесоохране!' };
      }
      return {
        ok: false,
        progress: `Найдено очагов пожара: ${state.foundTargets} из 3 (кликните по аномалиям на снимке)`
      };
    }
  },
  {
    id: 'flood_mapping',
    lab: 'sdr',
    track: 'Проектный · 13–17 лет',
    badge: 'Гидрология ДЗЗ',
    title: '12. Мониторинг весеннего паводка в канале NIR',
    desc: 'Мутная паводковая вода в RGB почти неотличима от влажной почвы. Переключите снимок в ИК-синтез или NDVI и отметьте 3 участка опасного разлива реки.',
    hint: 'Вода сильно поглощает ближний инфракрасный свет (NIR < 0.08, NDVI < 0). Выберите сцену «Весенний паводок», включите «ИК-синтез (NIR)» или «Индекс NDVI» и отметьте 3 тёмные/синие зоны разлива.',
    preset: {
      mode: 'eo',
      sceneId: 'river_flood',
      bandMode: 'rgb'
    },
    check(state) {
      if (state.sceneId === 'river_flood' && state.foundTargets >= 3) {
        return { ok: true, msg: 'Все 3 зоны подтопления обнаружены по поглощению в ближнем ИК-канале!' };
      }
      return {
        ok: false,
        progress: `Отмечено зон подтопления: ${state.foundTargets} из 3`
      };
    }
  },

  // === LAB 5: LIFE SUPPORT (LSS) ===
  {
    id: 'apollo_co2',
    lab: 'lss',
    track: 'Стык с химией · 12–17 лет',
    badge: 'Авария СЖО',
    title: '13. Нештатная ситуация: отказ «Воздуха» и рост CO₂',
    desc: 'На станции 4 космонавта, парциальное давление CO₂ достигло опасных 7.8 мм рт. ст.! Включите поглотители LiOH / цеолитовый блок и стабилизируйте p(CO₂) < 3.0 мм рт. ст. при норме O₂.',
    hint: 'Увеличьте мощность адсорбера «Воздух» или активируйте аварийные патроны гидроксида лития (2LiOH + CO₂ → Li₂CO₃ + H₂O) и проверьте подачу электролиза «Электрон-ВМ».',
    preset: {
      crew: 4,
      activity: 'work',
      pO2: 152,
      pCO2: 7.8,
      elektronRate: 45,
      vozdukhRate: 0,
      liohCartridges: false,
      sabatierRate: 20,
      radiatorPct: 55
    },
    check(state) {
      if (state.pCO2 < 3.0 && state.pO2 >= 145 && state.pO2 <= 175 && state.crewAlive) {
        return {
          ok: true,
          msg: `Атмосфера станции в норме! p(CO₂) = ${state.pCO2.toFixed(2)} мм рт. ст., p(O₂) = ${state.pO2.toFixed(0)} мм рт. ст.`
        };
      }
      return {
        ok: false,
        progress: `p(CO₂) = ${state.pCO2.toFixed(2)} мм рт. ст. (нужно < 3.0) · p(O₂) = ${state.pO2.toFixed(0)} мм рт. ст.`
      };
    }
  },
  {
    id: 'sabatier_loop',
    lab: 'lss',
    track: 'Проектный · 14–18 лет',
    badge: 'Реактор Сабатье',
    title: '14. Замкнутый контур для экспедиции из 6 космонавтов',
    desc: 'Электролиз воды выделяет взрывоопасный водород H₂. Сбалансируйте «Электрон-ВМ», «Воздух» и реактор Сабатье (CO₂ + 4H₂ → CH₄ + 2H₂O) на протяжении 60 мин полёта без аварий.',
    hint: 'Для 6 космонавтов поставьте «Электрон-ВМ» ~75%, «Воздух» ~80% и включите реактор Сабатье ~75%, чтобы связывать водород с углекислым газом обратно в воду.',
    preset: {
      crew: 6,
      activity: 'normal',
      pO2: 158,
      pCO2: 2.4,
      h2Pct: 1.1,
      elektronRate: 80,
      vozdukhRate: 80,
      liohCartridges: false,
      sabatierRate: 0,
      radiatorPct: 68
    },
    check(state) {
      if (
        state.simMinutes >= 60 &&
        state.crewAlive &&
        state.h2Pct < 0.4 &&
        state.pCO2 < 3.5 &&
        state.pO2 >= 145 &&
        state.pO2 <= 175
      ) {
        return {
          ok: true,
          msg: 'Полный замкнутый цикл регенерации работает стабильно! Уровень H₂ безопасен, вода возвращается в контур.'
        };
      }
      return {
        ok: false,
        progress: `Время: ${state.simMinutes.toFixed(0)}/60 мин · H₂ = ${state.h2Pct.toFixed(2)}% (<0.4%) · CO₂ = ${state.pCO2.toFixed(1)} мм`
      };
    }
  },
  {
    id: 'eclipse_thermal',
    lab: 'lss',
    track: 'Базовый · 12–15 лет',
    badge: 'Теплообмен СТР',
    title: '15. Перегрев станции на солнечной стороне орбиты',
    desc: 'Радиаторы системы терморегулирования (СТР) раскрыты лишь на 15%, температура в модуле выросла до +32 °C! Приведите температуру каюты в диапазон 20–24 °C и удержите 20 мин.',
    hint: 'Увеличьте площадь отвода тепла наружных аммиачных радиаторов СТР до 60–75% и следите за переходом в тень Земли на витке.',
    preset: {
      crew: 3,
      activity: 'normal',
      pO2: 160,
      pCO2: 2.0,
      cabinTempC: 32.2,
      elektronRate: 50,
      vozdukhRate: 55,
      sabatierRate: 50,
      radiatorPct: 15
    },
    check(state) {
      if (state.thermalStableMinutes >= 20 && state.cabinTempC >= 20 && state.cabinTempC <= 24) {
        return { ok: true, msg: `Тепловой баланс СТР выровнен: +${state.cabinTempC.toFixed(1)} °C на протяжении 20 минут!` };
      }
      return {
        ok: false,
        progress: `Температура отсека: +${state.cabinTempC.toFixed(1)} °C · Стабильно в 20–24 °C: ${state.thermalStableMinutes.toFixed(0)}/20 мин`
      };
    }
  }
];
