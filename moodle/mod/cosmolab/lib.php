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
 * Library of functions and callbacks for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/** Максимальная высота iframe, которую разрешено указать преподавателю. */
define('COSMOLAB_MAX_FRAME_HEIGHT', 2000);
/** Минимальная высота iframe. */
define('COSMOLAB_MIN_FRAME_HEIGHT', 480);

/**
 * Returns the list of features supported by the module.
 *
 * @param string $feature FEATURE_xx constant
 * @return mixed True if supported, null if unknown
 */
function cosmolab_supports($feature) {
    if (defined('FEATURE_MOD_PURPOSE') && $feature === FEATURE_MOD_PURPOSE) {
        return defined('MOD_PURPOSE_ASSESSMENT') ? MOD_PURPOSE_ASSESSMENT : null;
    }

    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return true;
        case FEATURE_GRADE_OUTCOMES:
            return false;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS:
            return true;
        case FEATURE_COMPLETION_HAS_RULES:
            return true;
        default:
            return null;
    }
}

/**
 * Adds a new instance of the activity.
 *
 * @param stdClass $data form data
 * @param mod_cosmolab_mod_form|null $mform the form
 * @return int new instance id
 */
function cosmolab_add_instance($data, $mform = null) {
    global $DB;

    $data = cosmolab_normalise_instance($data);
    $data->timecreated = time();
    $data->timemodified = time();

    $data->id = $DB->insert_record('cosmolab', $data);

    cosmolab_grade_item_update($data);

    return $data->id;
}

/**
 * Updates an existing instance.
 *
 * @param stdClass $data form data (contains ->instance)
 * @param mod_cosmolab_mod_form|null $mform the form
 * @return bool success
 */
function cosmolab_update_instance($data, $mform = null) {
    global $DB;

    $data = cosmolab_normalise_instance($data);
    $data->id = $data->instance;
    $data->timemodified = time();
    if (!isset($data->timecreated) || !$data->timecreated) {
        $data->timecreated = time();
    }

    $result = $DB->update_record('cosmolab', $data);
    cosmolab_grade_item_update($data);

    return $result;
}

/**
 * Fills in defaults and sanitises the values that come from the form or from a restore.
 *
 * @param stdClass $data raw data
 * @return stdClass normalised data
 */
function cosmolab_normalise_instance($data) {
    $defaults = [
        'lab' => 'cubesat',
        'missionid' => '',
        'baseurl' => \mod_cosmolab\helper::DEFAULT_BASE_URL,
        'embedmode' => 1,
        'frameheight' => 820,
        'gradeenabled' => 0,
        'grade' => 100,
        'completionmission' => 0,
        'introformat' => FORMAT_HTML,
    ];

    foreach ($defaults as $key => $value) {
        if (!isset($data->$key)) {
            $data->$key = $value;
        }
    }

    $data->lab = \mod_cosmolab\helper::normalise_lab($data->lab);
    $data->missionid = trim((string)$data->missionid);
    $data->baseurl = \mod_cosmolab\helper::normalise_base_url($data->baseurl);
    $data->embedmode = empty($data->embedmode) ? 0 : 1;
    $data->frameheight = max(COSMOLAB_MIN_FRAME_HEIGHT, min(COSMOLAB_MAX_FRAME_HEIGHT, (int)$data->frameheight));
    $data->gradeenabled = empty($data->gradeenabled) ? 0 : 1;
    $data->completionmission = empty($data->completionmission) ? 0 : 1;
    $data->grade = (float)$data->grade;
    if ($data->grade <= 0) {
        $data->grade = 100;
    }

    return $data;
}

/**
 * Deletes an instance.
 *
 * @param int $id instance id
 * @return bool success
 */
function cosmolab_delete_instance($id) {
    global $DB;

    if (!$cosmolab = $DB->get_record('cosmolab', ['id' => $id])) {
        return false;
    }

    cosmolab_grade_item_delete($cosmolab);

    $DB->delete_records('cosmolab_progress', ['cosmolabid' => $cosmolab->id]);
    $DB->delete_records('cosmolab', ['id' => $cosmolab->id]);

    return true;
}

/**
 * Converts the stored score (percent, 0..100) into gradebook units of the activity.
 *
 * @param stdClass $cosmolab instance record
 * @param float $score percent score
 * @return float grade in 0..grademax range
 */
function cosmolab_score_to_grade($cosmolab, $score) {
    $score = max(0, min(100, (float)$score));
    $grademax = !empty($cosmolab->grade) ? (float)$cosmolab->grade : 100;
    return round($grademax * $score / 100, 2);
}

/**
 * Creates or updates the grade item of the activity.
 *
 * @param stdClass $cosmolab instance
 * @param array|string|null $grades grades to push, 'reset' to delete all grades
 * @return int grade_update() result
 */
function cosmolab_grade_item_update($cosmolab, $grades = null) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    $params = [
        'itemname' => $cosmolab->name,
        'idnumber' => isset($cosmolab->cmidnumber) ? $cosmolab->cmidnumber : null,
    ];

    if (empty($cosmolab->gradeenabled)) {
        $params['gradetype'] = GRADE_TYPE_NONE;
    } else {
        $params['gradetype'] = GRADE_TYPE_VALUE;
        $params['grademax'] = (float)$cosmolab->grade;
        $params['grademin'] = 0;
    }

    if ($grades === 'reset') {
        $params['reset'] = true;
        $grades = null;
    }

    return grade_update('mod/cosmolab', $cosmolab->course, 'mod', 'cosmolab', $cosmolab->id, 0, $grades, $params);
}

/**
 * Deletes the grade item of the activity.
 *
 * @param stdClass $cosmolab instance
 * @return int grade_update() result
 */
function cosmolab_grade_item_delete($cosmolab) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    return grade_update('mod/cosmolab', $cosmolab->course, 'mod', 'cosmolab', $cosmolab->id, 0, null, ['deleted' => 1]);
}

/**
 * Pushes the stored results of the students to the gradebook.
 *
 * @param stdClass $cosmolab instance
 * @param int $userid 0 means all users
 * @param bool $nullifnone set to null the grade of users without results
 * @return void
 */
function cosmolab_update_grades($cosmolab, $userid = 0, $nullifnone = true) {
    global $DB;

    if (empty($cosmolab->gradeenabled)) {
        cosmolab_grade_item_update($cosmolab);
        return;
    }

    if ($userid) {
        $row = $DB->get_record_select(
            'cosmolab_progress',
            'cosmolabid = ? AND userid = ? AND completed = 1',
            [$cosmolab->id, $userid],
            'MAX(score) AS score, MAX(timemodified) AS timemodified',
            IGNORE_MULTIPLE
        );

        if ($row && $row->score !== null) {
            $grade = [
                'userid' => $userid,
                'rawgrade' => cosmolab_score_to_grade($cosmolab, $row->score),
                'datesubmitted' => (int)$row->timemodified,
                'dategraded' => (int)$row->timemodified,
            ];
        } else if ($nullifnone) {
            $grade = ['userid' => $userid, 'rawgrade' => null];
        } else {
            return;
        }

        cosmolab_grade_item_update($cosmolab, [$grade]);
        return;
    }

    $sql = "SELECT userid, MAX(score) AS score, MAX(timemodified) AS timemodified
              FROM {cosmolab_progress}
             WHERE cosmolabid = ? AND completed = 1
          GROUP BY userid";
    $rows = $DB->get_records_sql($sql, [$cosmolab->id]);

    $grades = [];
    foreach ($rows as $row) {
        $grades[$row->userid] = [
            'userid' => $row->userid,
            'rawgrade' => cosmolab_score_to_grade($cosmolab, $row->score),
            'datesubmitted' => (int)$row->timemodified,
            'dategraded' => (int)$row->timemodified,
        ];
    }

    cosmolab_grade_item_update($cosmolab, $grades);
}

/**
 * Cached course module info (name, intro, custom completion rules).
 *
 * @param stdClass $coursemodule course module record
 * @return cached_cm_info|false
 */
function cosmolab_get_coursemodule_info($coursemodule) {
    global $DB;

    if (!$cosmolab = $DB->get_record('cosmolab', ['id' => $coursemodule->instance],
            'id, name, intro, introformat, lab, missionid, gradeenabled, grade')) {
        return false;
    }

    $info = new cached_cm_info();
    $info->name = $cosmolab->name;

    if ($coursemodule->showdescription) {
        // Convert intro to html, do not filter the cached version - filters run at display time.
        $info->content = format_module_intro('cosmolab', $cosmolab, $coursemodule->id, false);
    }

    if ($coursemodule->completion == COMPLETION_TRACKING_AUTOMATIC) {
        $info->customdata['customcompletionrules']['completionmission'] = 1;
    }

    $info->customdata['lab'] = $cosmolab->lab;
    $info->customdata['missionid'] = $cosmolab->missionid;

    return $info;
}

/**
 * Custom completion rule: the student has completed (зачтено) the mission of the activity.
 *
 * @param stdClass $course course
 * @param stdClass $cm course module
 * @param int $userid user id
 * @param bool $type completion type
 * @return bool|null completion state or null when unknown
 */
function cosmolab_get_completion_state($course, $cm, $userid, $type) {
    global $DB;

    $ruleenabled = !empty($cm->customdata['customcompletionrules']['completionmission']);
    if (!$ruleenabled) {
        // Правило не включено — не влияем на состояние завершения.
        return $type;
    }

    $completed = $DB->record_exists('cosmolab_progress', [
        'cosmolabid' => $cm->instance,
        'userid' => $userid,
        'completed' => 1,
    ]);

    return $completed ? COMPLETION_COMPLETE : COMPLETION_INCOMPLETE;
}

/**
 * Resets the activity data for one course.
 *
 * @param stdClass $data reset form data
 * @return array status messages
 */
function cosmolab_reset_userdata($data) {
    global $DB;

    $componentstr = get_string('modulenameplural', 'cosmolab');
    $status = [];

    $sql = "SELECT id FROM {cosmolab} WHERE course = ?";

    if (!empty($data->reset_cosmolab_results)) {
        $instances = $DB->get_records_sql($sql, [$data->courseid]);
        foreach ($instances as $instance) {
            $DB->delete_records('cosmolab_progress', ['cosmolabid' => $instance->id]);
            if ($cosmolab = $DB->get_record('cosmolab', ['id' => $instance->id])) {
                cosmolab_grade_item_update($cosmolab, 'reset');
            }
        }
        $status[] = [
            'component' => $componentstr,
            'item' => get_string('resetresults', 'cosmolab'),
            'error' => false,
        ];
    }

    return $status;
}

/**
 * Adds the teacher report link to the activity settings menu.
 *
 * @param settings_navigation $settingsnav settings navigation
 * @param navigation_node $cosmolabnode node of the activity
 * @return void
 */
function cosmolab_extend_settings_navigation(settings_navigation $settingsnav, navigation_node $cosmolabnode) {
    global $PAGE;

    if (!$PAGE->cm) {
        return;
    }

    $context = \mod_cosmolab\helper::context_from_cm($PAGE->cm);
    if (!has_capability('mod/cosmolab:viewreports', $context)) {
        return;
    }

    $url = new moodle_url('/mod/cosmolab/report.php', ['id' => $PAGE->cm->id]);
    $cosmolabnode->add(
        get_string('report', 'cosmolab'),
        $url,
        navigation_node::TYPE_SETTING,
        null,
        'cosmolabreport',
        new pix_icon('i/report', '')
    );
}
