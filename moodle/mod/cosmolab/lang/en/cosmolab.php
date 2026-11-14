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
 * English strings for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['attempts'] = 'Attempts';
$string['baseurl'] = 'КосмоЛаб platform URL';
$string['baseurl_help'] = 'Address of the КосмоЛаб platform to embed. Default: the public GitHub Pages build. Set the address of your own copy if the platform is hosted on the school server.';
$string['completionmission'] = 'The student must pass the mission';
$string['completionmission_help'] = 'The activity is considered complete when the virtual laboratory reports that the mission is passed.';
$string['cosmolab:addinstance'] = 'Add a new КосмоЛаб activity';
$string['cosmolab:submit'] = 'Submit results from the laboratory';
$string['cosmolab:view'] = 'View the КосмоЛаб activity';
$string['cosmolab:viewreports'] = 'View the results report of КосмоЛаб';
$string['downloadcsv'] = 'Download report as CSV';
$string['embedmode'] = 'Compact (embed) layout';
$string['embedmode_help'] = 'Hides the platform header and opens the laboratory in the compact embed mode, which fits inside the activity page.';
$string['embednote'] = 'The laboratory runs in an iframe. If the page does not load, the school network may block external frames — open the platform in a new tab or host your own copy (see the module settings).';
$string['errorbaseurl'] = 'The platform URL must start with http:// or https://';
$string['errorgrade'] = 'The maximum grade must be a positive number';
$string['frameheight'] = 'Frame height (px)';
$string['frameheight_help'] = 'Height of the embedded laboratory frame. 820 px fits a 1366×768 screen, 1000–1200 px is comfortable for projectors and large monitors.';
$string['gradeenabled'] = 'Grade the mission';
$string['gradeenabled_help'] = 'When enabled, a passed mission is sent to the gradebook.';
$string['grademax'] = 'Maximum grade';
$string['grademax_help'] = 'Grade awarded for a passed mission. Landing quality and flight parameters do not change the grade: the mission is graded as pass/fail and converted into this maximum.';
$string['iframe_title'] = 'Virtual laboratory «КосмоЛаб»: {$a}';
$string['intro'] = 'Description';
$string['lab'] = 'Laboratory';
$string['lab_cubesat'] = 'CubeSat / OrbiCraft — attitude control';
$string['lab_lss'] = 'Life support system of the station';
$string['lab_orbit'] = 'Orbital mechanics and manoeuvres';
$string['lab_rocket'] = 'Rocket and CanSat (OpenRocket)';
$string['lab_sdr'] = 'UHF receiving station and remote sensing';
$string['lab_help'] = 'The laboratory that opens by default. If a mission is selected, the laboratory is chosen automatically.';
$string['lastmodified'] = 'Last updated';
$string['mission'] = 'Practical task (mission)';
$string['mission_help'] = 'A graded practical task from the mission catalogue. Choose "Free sandbox" to let students explore the laboratory without an automatic check.';
$string['missionmismatch'] = 'The reported mission does not match the mission of this activity';
$string['modulename'] = 'КосмоЛаб (virtual laboratory)';
$string['modulename_help'] = 'Adds an interactive КосмоЛаб virtual laboratory (CubeSat, orbital mechanics, rockets and CanSat with OpenRocket, UHF/SDR remote sensing, life support systems) to the course. The student\'s progress and mission results are stored in the gradebook; no separate registration or software installation is required.';
$string['modulename_link'] = 'mod/cosmolab/view';
$string['modulenameplural'] = 'КосмоЛаб';
$string['noinstances'] = 'There are no КосмоЛаб activities in this course yet';
$string['noresults'] = 'No results yet: students have not completed any tasks in this activity.';
$string['openinnewtab'] = 'Open the laboratory in a new tab';
$string['platformsettings'] = 'Platform and laboratory';
$string['pluginadministration'] = 'КосмоЛаб administration';
$string['pluginname'] = 'КосмоЛаб';
$string['privacy:metadata:cosmolab'] = 'Activity settings of the КосмоЛаб element.';
$string['privacy:metadata:cosmolab:name'] = 'Activity name.';
$string['privacy:metadata:cosmolab:intro'] = 'Activity description.';
$string['privacy:metadata:cosmolab_platform'] = 'Data transmitted to the external КосмоЛаб platform loaded in the frame (mission identifier and progress text). The platform processes them in the browser only.';
$string['privacy:metadata:cosmolab_platform:missionid'] = 'Identifier of the practical task opened in the laboratory.';
$string['privacy:metadata:cosmolab_platform:progress'] = 'Short progress text shown to the student.';
$string['privacy:metadata:cosmolab_progress'] = 'Results of the students in the КосмоЛаб activities.';
$string['privacy:metadata:cosmolab_progress:attempts'] = 'Number of attempts.';
$string['privacy:metadata:cosmolab_progress:completed'] = 'Whether the task is passed.';
$string['privacy:metadata:cosmolab_progress:cosmolabid'] = 'Identifier of the activity the result belongs to.';
$string['privacy:metadata:cosmolab_progress:missionid'] = 'Identifier of the practical task.';
$string['privacy:metadata:cosmolab_progress:progress'] = 'Latest progress message of the student.';
$string['privacy:metadata:cosmolab_progress:score'] = 'Score in percent.';
$string['privacy:metadata:cosmolab_progress:timemodified'] = 'Time of the last update.';
$string['privacy:metadata:cosmolab_progress:userid'] = 'Identifier of the student.';
$string['privacy:path'] = 'КосмоЛаб results';
$string['progress'] = 'Progress';
$string['progressempty'] = 'No progress yet — start the task in the laboratory.';
$string['report'] = 'Results report';
$string['reseterror'] = 'Results could not be reset';
$string['resetresults'] = 'Delete all results of the students in the КосмоЛаб activities';
$string['resulterror'] = 'The result was not saved — check the connection';
$string['resultsaved'] = 'Mission passed';
$string['sandbox'] = 'Free sandbox (no automatic check)';
$string['score'] = 'Score, %';
$string['status'] = 'Status';
$string['statuscompleted'] = 'Passed';
$string['statusinprogress'] = 'In progress';
$string['student'] = 'Student';
