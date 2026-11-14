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
 * Lists all КосмоЛаб activities in a course.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require('../../config.php');
require_once($CFG->dirroot . '/mod/cosmolab/lib.php');

$id = required_param('id', PARAM_INT); // Course id.

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_course_login($course, true);

$PAGE->set_url('/mod/cosmolab/index.php', ['id' => $id]);
$PAGE->set_title(format_string($course->fullname));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context(\context_course::instance($course->id));
$PAGE->requires->css('/mod/cosmolab/styles.css');

$event = \core\event\course_module_instance_list_viewed::create([
    'context' => \context_course::instance($course->id),
]);
$event->add_record_snapshot('course', $course);
$event->trigger();

echo $OUTPUT->header();

$instances = get_all_instances_in_course('cosmolab', $course);
$labs = \mod_cosmolab\helper::labs();

if (!$instances) {
    notice(get_string('noinstances', 'cosmolab'), new moodle_url('/course/view.php', ['id' => $course->id]));
}

$table = new html_table();
$table->head = [
    get_string('name'),
    get_string('lab', 'cosmolab'),
    get_string('mission', 'cosmolab'),
    get_string('intro', 'cosmolab'),
];
$table->align = ['left', 'left', 'left', 'left'];
$table->attributes['class'] = 'generaltable cosmolab-index';

foreach ($instances as $instance) {
    $url = new moodle_url('/mod/cosmolab/view.php', ['id' => $instance->coursemodule]);
    $name = format_string($instance->name, true, ['context' => \context_course::instance($course->id)]);
    $link = html_writer::link($url, $name);
    if (!$instance->visible) {
        $link .= ' ' . html_writer::tag('span', get_string('hiddenfromstudents'), ['class' => 'dimmed_text']);
    }

    $missiontitle = \mod_cosmolab\helper::mission_title($instance->missionid);

    $table->data[] = [
        $link,
        s($labs[$instance->lab] ?? $instance->lab),
        s($missiontitle !== '' ? $missiontitle : get_string('sandbox', 'cosmolab')),
        format_text($instance->intro, $instance->introformat, ['context' => \context_course::instance($course->id)]),
    ];
}

echo $OUTPUT->heading(get_string('modulenameplural', 'cosmolab'), 2);
echo html_writer::table($table);

echo $OUTPUT->footer();
