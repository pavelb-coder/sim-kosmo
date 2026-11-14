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
 * External function: store the result reported by the laboratory.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cosmolab\external;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');
require_once($CFG->dirroot . '/mod/cosmolab/lib.php');

use external_api;
use external_function_parameters;
use external_single_structure;
use external_value;

/**
 * Stores progress or a completed mission and updates grade and completion.
 */
class submit_result extends external_api {

    /**
     * Describes the parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'missionid' => new external_value(PARAM_ALPHANUMEXT, 'Mission id', VALUE_DEFAULT, ''),
            'completed' => new external_value(PARAM_BOOL, 'Mission passed', VALUE_DEFAULT, false),
            'progress' => new external_value(PARAM_TEXT, 'Human readable progress', VALUE_DEFAULT, ''),
            'score' => new external_value(PARAM_FLOAT, 'Score in percent 0..100', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Stores the result.
     *
     * @param int $cmid course module id
     * @param string $missionid mission id
     * @param bool $completed mission passed
     * @param string $progress progress text
     * @param float $score score in percent
     * @return array
     */
    public static function execute($cmid, $missionid = '', $completed = false, $progress = '', $score = 0) {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
            'missionid' => $missionid,
            'completed' => $completed,
            'progress' => $progress,
            'score' => $score,
        ]);

        [$course, $cm] = get_course_and_cm_from_cmid($params['cmid'], 'cosmolab');
        $context = \mod_cosmolab\helper::context_from_cm($cm);
        self::validate_context($context);
        require_capability('mod/cosmolab:submit', $context);

        $cosmolab = $DB->get_record('cosmolab', ['id' => $cm->instance], '*', MUST_EXIST);

        $missionid = $params['missionid'];
        if ($cosmolab->missionid !== '' && $missionid !== '' && $missionid !== $cosmolab->missionid) {
            throw new \moodle_exception('missionmismatch', 'cosmolab');
        }
        if ($missionid === '') {
            $missionid = (string)$cosmolab->missionid;
        }

        $record = \mod_cosmolab\helper::record_result(
            $cosmolab,
            $cm,
            $USER->id,
            $missionid,
            (bool)$params['completed'],
            (string)$params['progress'],
            (float)$params['score']
        );

        return [
            'status' => true,
            'completed' => (bool)$record->completed,
            'score' => (float)$record->score,
            'grade' => (float)cosmolab_score_to_grade($cosmolab, $record->score),
            'grademax' => (float)cosmolab_grade_max($cosmolab),
            'message' => get_string('resultsaved', 'cosmolab'),
        ];
    }

    /**
     * Describes the return value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'status' => new external_value(PARAM_BOOL, 'Result stored'),
            'completed' => new external_value(PARAM_BOOL, 'Mission is completed'),
            'score' => new external_value(PARAM_FLOAT, 'Percent score 0..100'),
            'grade' => new external_value(PARAM_FLOAT, 'Grade in activity units'),
            'grademax' => new external_value(PARAM_FLOAT, 'Maximum grade of the activity'),
            'message' => new external_value(PARAM_TEXT, 'Localised status message'),
        ]);
    }
}
