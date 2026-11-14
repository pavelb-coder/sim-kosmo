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
 * External function: current status of the user in the activity.
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
 * Returns the stored progress of the current user.
 */
class get_result extends external_api {

    /**
     * Describes the parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    /**
     * Returns the status.
     *
     * @param int $cmid course module id
     * @return array
     */
    public static function execute($cmid) {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), ['cmid' => $cmid]);

        [$course, $cm] = get_course_and_cm_from_cmid($params['cmid'], 'cosmolab');
        $context = \mod_cosmolab\helper::context_from_cm($cm);
        self::validate_context($context);
        require_capability('mod/cosmolab:view', $context);

        $cosmolab = $DB->get_record('cosmolab', ['id' => $cm->instance], '*', MUST_EXIST);
        $summary = \mod_cosmolab\helper::user_progress($cosmolab, $USER->id);

        return [
            'completed' => (bool)$summary->completed,
            'score' => (float)$summary->score,
            'grade' => (float)cosmolab_score_to_grade($cosmolab, $summary->score),
            'grademax' => (float)cosmolab_grade_max($cosmolab),
            'progress' => (string)$summary->progress,
            'attempts' => (int)$summary->attempts,
            'missionid' => (string)$cosmolab->missionid,
        ];
    }

    /**
     * Describes the return value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'completed' => new external_value(PARAM_BOOL, 'Mission is completed'),
            'score' => new external_value(PARAM_FLOAT, 'Percent score'),
            'grade' => new external_value(PARAM_FLOAT, 'Grade in activity units'),
            'grademax' => new external_value(PARAM_FLOAT, 'Maximum grade'),
            'progress' => new external_value(PARAM_TEXT, 'Last progress message'),
            'attempts' => new external_value(PARAM_INT, 'Total attempts'),
            'missionid' => new external_value(PARAM_ALPHANUMEXT, 'Configured mission id'),
        ]);
    }
}
