<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Helper class for mod_cosmolab: labs, missions, URLs, results.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cosmolab;

defined('MOODLE_INTERNAL') || die();

/**
 * Shared logic of the КосмоЛаб activity module.
 */
class helper {

    /** @var string Платформа по умолчанию (GitHub Pages). */
    const DEFAULT_BASE_URL = 'https://pavelb-coder.github.io/sim-kosmo/';

    /** @var string Component name. */
    const COMPONENT = 'mod_cosmolab';

    /**
     * Список виртуальных лабораторий платформы.
     *
     * @return array lab key => title
     */
    public static function labs(): array {
        return [
            'cubesat' => get_string('lab_cubesat', 'cosmolab'),
            'orbit' => get_string('lab_orbit', 'cosmolab'),
            'rocket' => get_string('lab_rocket', 'cosmolab'),
            'sdr' => get_string('lab_sdr', 'cosmolab'),
            'lss' => get_string('lab_lss', 'cosmolab'),
        ];
    }

    /**
     * Каталог практикумов (синхронизирован с js/data/missions.js платформы).
     *
     * @return array mission id => ['lab' => string, 'title' => string]
     */
    public static function missions(): array {
        return [
            'bdot_detumble' => ['lab' => 'cubesat', 'title' => '1. Гашение закрутки после отделения от РН'],
            'target_imaging' => ['lab' => 'cubesat', 'title' => '2. Точное наведение на цель и космоснимок'],
            'broken_polarity' => ['lab' => 'cubesat', 'title' => '3. Авария: инверсия солнечных датчиков'],
            'iss_rendezvous' => ['lab' => 'orbit', 'title' => '4. Гомановский переход на орбиту МКС (420 км)'],
            'geo_transfer' => ['lab' => 'orbit', 'title' => '5. Выведение спутника связи на ГСО (35 786 км)'],
            'safe_deorbit' => ['lab' => 'orbit', 'title' => '6. Увод отработавшего спутника с орбиты'],
            'fix_tumble' => ['lab' => 'rocket', 'title' => '7. Авария: кувырок ракеты (ЦД впереди ЦМ)'],
            'cansat_apogee' => ['lab' => 'rocket', 'title' => '8. Выброс и мягкая посадка CanSat с высоты > 850 м'],
            'strato_sounder' => ['lab' => 'rocket', 'title' => '9. Сверхзвуковой стратосферный зонд: апогей 3 000 м и Мах > 1.2'],
            'two_stage_ascent' => ['lab' => 'rocket', 'title' => '10. Тандем: разделение ступеней и апогей > 1 500 м'],
            'eng_motor' => ['lab' => 'rocket', 'title' => '11. Импорт двигателя из RASP-файла .eng и сертификационный пуск'],
            'meteor_pass' => ['lab' => 'sdr', 'title' => '12. Сеанс приёма снимка КА «Метеор-М» (Доплер)'],
            'siberia_fire' => ['lab' => 'sdr', 'title' => '13. Обнаружение лесных пожаров в тайге Приенисейской Сибири'],
            'flood_mapping' => ['lab' => 'sdr', 'title' => '14. Мониторинг весеннего паводка в канале NIR'],
            'apollo_co2' => ['lab' => 'lss', 'title' => '15. Нештатная ситуация: отказ «Воздуха» и рост CO₂'],
            'sabatier_loop' => ['lab' => 'lss', 'title' => '16. Замкнутый контур для экспедиции из 6 космонавтов'],
            'eclipse_thermal' => ['lab' => 'lss', 'title' => '17. Перегрев станции на солнечной стороне орбиты'],
        ];
    }

    /**
     * Нормализует ключ лаборатории.
     *
     * @param string $lab raw value
     * @return string valid lab key
     */
    public static function normalise_lab($lab): string {
        $lab = clean_param((string)$lab, PARAM_ALPHANUMEXT);
        return array_key_exists($lab, self::labs()) ? $lab : 'cubesat';
    }

    /**
     * Проверяет и нормализует базовый URL платформы.
     *
     * @param string $url raw value
     * @return string url
     */
    public static function normalise_base_url($url): string {
        $url = trim((string)$url);
        if ($url === '' || !preg_match('~^https?://[^\s<>"]+$~i', $url)) {
            return self::DEFAULT_BASE_URL;
        }
        if (substr($url, -1) !== '/' && strpos($url, '?') === false) {
            $url .= '/';
        }
        return $url;
    }

    /**
     * Returns the module context, compatible with Moodle 3.9+ and 4.2+ namespaced contexts.
     *
     * @param \stdClass $cm course module record
     * @return \context_module|\core\context\module
     */
    public static function context_from_cm($cm) {
        if (class_exists('\core\context\module')) {
            return \core\context\module::instance($cm->id);
        }
        return \context_module::instance($cm->id);
    }

    /**
     * Builds the URL of the КосмоЛаб platform to embed into the iframe.
     *
     * @param \stdClass $cosmolab instance record
     * @return string
     */
    public static function iframe_url($cosmolab): string {
        $base = self::normalise_base_url($cosmolab->baseurl);
        $params = [];

        if (!empty($cosmolab->missionid)) {
            $params['task'] = $cosmolab->missionid;
        } else {
            $params['lab'] = $cosmolab->lab;
        }

        if (!empty($cosmolab->embedmode)) {
            $params['embed'] = 1;
        }

        $separator = (strpos($base, '?') === false) ? '?' : '&';
        return $base . $separator . http_build_query($params);
    }

    /**
     * Returns the title of a mission or an empty string.
     *
     * @param string $missionid mission id
     * @return string
     */
    public static function mission_title($missionid): string {
        $missions = self::missions();
        return isset($missions[$missionid]) ? $missions[$missionid]['title'] : '';
    }

    /**
     * Stores the result reported by the laboratory and updates grade and completion.
     *
     * @param \stdClass $cosmolab instance record
     * @param \stdClass $cm course module record
     * @param int $userid user id
     * @param string $missionid mission id ('' for sandbox mode)
     * @param bool $completed mission passed
     * @param string $progress human readable progress
     * @param float $score score in percent (0..100)
     * @return \stdClass stored progress record
     */
    public static function record_result($cosmolab, $cm, $userid, $missionid, $completed, $progress, $score) {
        global $DB, $CFG;

        require_once($CFG->libdir . '/completionlib.php');

        $now = time();
        $missionid = clean_param((string)$missionid, PARAM_ALPHANUMEXT);
        $progress = shorten_text(clean_param((string)$progress, PARAM_TEXT), 300, false, '…');
        $score = max(0, min(100, (float)$score));

        $existing = $DB->get_record('cosmolab_progress', [
            'cosmolabid' => $cosmolab->id,
            'userid' => $userid,
            'missionid' => $missionid,
        ]);

        $record = (object)[
            'cosmolabid' => $cosmolab->id,
            'userid' => $userid,
            'missionid' => $missionid,
            'lab' => $cosmolab->lab,
            'progress' => $progress,
            'completed' => $completed ? 1 : 0,
            'score' => $score,
            'timemodified' => $now,
        ];

        if ($existing) {
            // Успех «залипает»: если задание уже было зачтено, оно остаётся зачтённым.
            if (!empty($existing->completed)) {
                $record->completed = 1;
                $record->score = max($score, (float)$existing->score);
            }
            $record->id = $existing->id;
            $record->attempts = (int)$existing->attempts + 1;
            $record->timecreated = (int)$existing->timecreated;
            $DB->update_record('cosmolab_progress', $record);
        } else {
            $record->attempts = 1;
            $record->timecreated = $now;
            $record->id = $DB->insert_record('cosmolab_progress', $record);
        }

        if (!empty($cosmolab->grade) && !empty($record->completed)) {
            \cosmolab_update_grades($cosmolab, $userid);
        }

        if (!empty($record->completed)) {
            $course = get_course($cosmolab->course);
            $completion = new \completion_info($course);
            if ($completion->is_enabled($cm)) {
                $completion->update_state($cm, COMPLETION_UNKNOWN, $userid);
            }
        }

        return $record;
    }

    /**
     * Summary of the user's results inside the activity.
     *
     * @param \stdClass $cosmolab instance record
     * @param int $userid user id
     * @return \stdClass
     */
    public static function user_progress($cosmolab, $userid) {
        global $DB;

        $summary = (object)[
            'completed' => false,
            'score' => 0,
            'progress' => '',
            'attempts' => 0,
            'missionid' => (string)$cosmolab->missionid,
            'completedcount' => 0,
            'timemodified' => 0,
        ];

        $records = $DB->get_records('cosmolab_progress', [
            'cosmolabid' => $cosmolab->id,
            'userid' => $userid,
        ], 'timemodified DESC');

        $first = true;
        foreach ($records as $record) {
            $summary->attempts += (int)$record->attempts;

            // Последнее сообщение о прогрессе — из самой свежей записи.
            if ($first) {
                $summary->progress = (string)$record->progress;
                $summary->timemodified = (int)$record->timemodified;
                $first = false;
            }

            if (!empty($record->completed)) {
                $summary->completedcount++;
                $summary->completed = true;
                // Балл — лучший из зачтённых, как и в журнале оценок.
                $summary->score = max($summary->score, (float)$record->score);
            }
        }

        return $summary;
    }
}
