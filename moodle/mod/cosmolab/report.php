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
 * Teacher report: results of the students in the activity.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require('../../config.php');
require_once($CFG->dirroot . '/mod/cosmolab/lib.php');

$id = required_param('id', PARAM_INT); // Course module id.
$download = optional_param('download', '', PARAM_ALPHA);

$cm = get_coursemodule_from_id('cosmolab', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$cosmolab = $DB->get_record('cosmolab', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, false, $cm);

$context = \mod_cosmolab\helper::context_from_cm($cm);
require_capability('mod/cosmolab:viewreports', $context);

$PAGE->set_url('/mod/cosmolab/report.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($cosmolab->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->requires->css('/mod/cosmolab/styles.css');

$sql = "SELECT p.id, p.userid, p.missionid, p.progress, p.completed, p.score, p.attempts, p.timemodified,
               u.firstname, u.lastname, u.firstnamephonetic, u.lastnamephonetic, u.middlename, u.alternatename
          FROM {cosmolab_progress} p
          JOIN {user} u ON u.id = p.userid
         WHERE p.cosmolabid = :cosmolabid
      ORDER BY u.lastname, u.firstname, p.timemodified DESC";

$records = $DB->get_records_sql($sql, ['cosmolabid' => $cosmolab->id]);

if ($download === 'csv') {
    $rows = [[
        get_string('student', 'cosmolab'),
        get_string('mission', 'cosmolab'),
        get_string('status'),
        get_string('score', 'cosmolab'),
        get_string('attempts', 'cosmolab'),
        get_string('progress', 'cosmolab'),
        get_string('lastmodified'),
    ]];

    foreach ($records as $record) {
        $rows[] = [
            fullname($record),
            $record->missionid !== '' ? \mod_cosmolab\helper::mission_title($record->missionid) : get_string('sandbox', 'cosmolab'),
            $record->completed ? get_string('statuscompleted', 'cosmolab') : get_string('statusinprogress', 'cosmolab'),
            format_float((float)$record->score, 2),
            (int)$record->attempts,
            $record->progress,
            userdate($record->timemodified),
        ];
    }

    $filename = clean_filename('cosmolab-report-' . $cosmolab->id . '.csv');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    foreach ($rows as $row) {
        fputcsv($out, $row, ';');
    }
    fclose($out);
    exit;
}

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('report', 'cosmolab'));

$labs = \mod_cosmolab\helper::labs();
echo html_writer::tag(
    'p',
    get_string('lab', 'cosmolab') . ': ' . s($labs[$cosmolab->lab] ?? $cosmolab->lab) .
    ' · ' . get_string('mission', 'cosmolab') . ': ' .
    s($cosmolab->missionid !== '' ? \mod_cosmolab\helper::mission_title($cosmolab->missionid) : get_string('sandbox', 'cosmolab')),
    ['class' => 'cosmolab-report-head']
);

if (!$records) {
    echo $OUTPUT->notification(get_string('noresults', 'cosmolab'), 'info');
} else {
    $table = new html_table();
    $table->head = [
        get_string('student', 'cosmolab'),
        get_string('mission', 'cosmolab'),
        get_string('status'),
        get_string('score', 'cosmolab'),
        get_string('attempts', 'cosmolab'),
        get_string('progress', 'cosmolab'),
        get_string('lastmodified'),
    ];
    $table->attributes['class'] = 'generaltable cosmolab-report-table';

    foreach ($records as $record) {
        $status = $record->completed
            ? html_writer::tag('span', get_string('statuscompleted', 'cosmolab'), ['class' => 'cosmolab-chip ok'])
            : html_writer::tag('span', get_string('statusinprogress', 'cosmolab'), ['class' => 'cosmolab-chip pending']);

        $table->data[] = [
            html_writer::link(
                new moodle_url('/user/view.php', ['id' => $record->userid, 'course' => $course->id]),
                fullname($record)
            ),
            s($record->missionid !== '' ? \mod_cosmolab\helper::mission_title($record->missionid) : get_string('sandbox', 'cosmolab')),
            $status,
            format_float((float)$record->score, 2),
            (int)$record->attempts,
            s((string)$record->progress),
            userdate($record->timemodified),
        ];
    }

    echo html_writer::table($table);
}

echo html_writer::link(
    new moodle_url('/mod/cosmolab/report.php', ['id' => $cm->id, 'download' => 'csv']),
    get_string('downloadcsv', 'cosmolab'),
    ['class' => 'btn btn-secondary']
);

echo $OUTPUT->footer();
