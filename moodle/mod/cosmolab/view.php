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
 * Main activity page: embeds the КосмоЛаб virtual laboratory.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require('../../config.php');
require_once($CFG->dirroot . '/mod/cosmolab/lib.php');
require_once($CFG->libdir . '/completionlib.php');

$id = optional_param('id', 0, PARAM_INT); // Course module id.
$c = optional_param('c', 0, PARAM_INT);   // Instance id.

if ($id) {
    $cm = get_coursemodule_from_id('cosmolab', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $cosmolab = $DB->get_record('cosmolab', ['id' => $cm->instance], '*', MUST_EXIST);
} else {
    $cosmolab = $DB->get_record('cosmolab', ['id' => $c], '*', MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cosmolab->course], '*', MUST_EXIST);
    $cm = get_coursemodule_from_instance('cosmolab', $cosmolab->id, $course->id, false, MUST_EXIST);
}

require_course_login($course, true, $cm);

$context = \mod_cosmolab\helper::context_from_cm($cm);
require_capability('mod/cosmolab:view', $context);

$PAGE->set_url('/mod/cosmolab/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($cosmolab->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_cm($cm, $course);
$PAGE->requires->css('/mod/cosmolab/styles.css');

// Mark the activity as viewed for completion tracking.
$completion = new completion_info($course);
$completion->set_module_viewed($cm);

// Trigger the standard "course module viewed" event.
$event = \mod_cosmolab\event\course_module_viewed::create([
    'objectid' => $cosmolab->id,
    'context' => $context,
]);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('cosmolab', $cosmolab);
$event->trigger();

$summary = \mod_cosmolab\helper::user_progress($cosmolab, $USER->id);
$iframeurl = \mod_cosmolab\helper::iframe_url($cosmolab);
$baseparts = parse_url(\mod_cosmolab\helper::normalise_base_url($cosmolab->baseurl));
$origin = ($baseparts['scheme'] ?? 'https') . '://' . ($baseparts['host'] ?? '') .
    (isset($baseparts['port']) ? ':' . $baseparts['port'] : '');

$labs = \mod_cosmolab\helper::labs();
$labname = $labs[$cosmolab->lab] ?? $cosmolab->lab;
$missiontitle = \mod_cosmolab\helper::mission_title($cosmolab->missionid);

$gradevalue = cosmolab_score_to_grade($cosmolab, $summary->score);
$gradetext = format_float($gradevalue, 2) . ' / ' . format_float(cosmolab_grade_max($cosmolab), 2);

echo $OUTPUT->header();

if ($cosmolab->intro) {
    echo $OUTPUT->box(format_module_intro('cosmolab', $cosmolab, $cm->id), 'generalbox mod_introbox', 'cosmolabintro');
}

// Status panel.
$statusclass = $summary->completed ? 'cosmolab-status ok' : 'cosmolab-status';
echo html_writer::start_div($statusclass, ['id' => 'cosmolab-status']);
echo html_writer::tag('span', get_string('lab', 'cosmolab') . ': ' . s($labname), ['class' => 'cosmolab-chip']);
echo html_writer::tag(
    'span',
    get_string('mission', 'cosmolab') . ': ' . s($missiontitle !== '' ? $missiontitle : get_string('sandbox', 'cosmolab')),
    ['class' => 'cosmolab-chip']
);
if (!empty($cosmolab->grade)) {
    echo html_writer::tag(
        'span',
        get_string('grade') . ': ' . $gradetext,
        ['class' => 'cosmolab-chip', 'id' => 'cosmolab-gradechip']
    );
}
echo html_writer::tag(
    'span',
    $summary->completed ? get_string('statuscompleted', 'cosmolab') : get_string('statusinprogress', 'cosmolab'),
    ['class' => 'cosmolab-chip ' . ($summary->completed ? 'ok' : 'pending'), 'id' => 'cosmolab-statechip']
);
echo html_writer::end_div();

echo html_writer::tag(
    'div',
    s($summary->progress !== '' ? $summary->progress : get_string('progressempty', 'cosmolab')),
    ['class' => 'cosmolab-progress', 'id' => 'cosmolab-progress']
);

// The laboratory itself.
echo html_writer::start_div('cosmolab-frame-wrap');
echo html_writer::tag('iframe', '', [
    'id' => 'cosmolab-frame',
    'class' => 'cosmolab-frame',
    'src' => $iframeurl,
    'title' => get_string('iframe_title', 'cosmolab', s($cosmolab->name)),
    'height' => (int)$cosmolab->frameheight,
    'style' => 'width:100%;height:' . (int)$cosmolab->frameheight . 'px;border:0;',
    'allow' => 'fullscreen; clipboard-write; clipboard-read',
    'allowfullscreen' => 'allowfullscreen',
    'referrerpolicy' => 'origin',
    'sandbox' => 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals',
]);
echo html_writer::end_div();

echo html_writer::link(
    $iframeurl,
    get_string('openinnewtab', 'cosmolab'),
    ['target' => '_blank', 'rel' => 'noopener', 'class' => 'cosmolab-openlink']
);

echo html_writer::div(get_string('embednote', 'cosmolab'), 'cosmolab-note');

$PAGE->requires->js_call_amd('mod_cosmolab/bridge', 'init', [[
    'cmid' => (int)$cm->id,
    'origin' => $origin,
    'lab' => $cosmolab->lab,
    'missionId' => (string)$cosmolab->missionid,
    'missionTitle' => $missiontitle,
    'gradeEnabled' => !empty($cosmolab->grade),
    'gradeMax' => (float)cosmolab_grade_max($cosmolab),
    'completed' => (bool)$summary->completed,
    'score' => (float)$summary->score,
]]);

echo $OUTPUT->footer();
