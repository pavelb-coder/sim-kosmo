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
 * Restore structure step for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @category   backup
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Restores the activity structure.
 */
class restore_cosmolab_activity_structure_step extends restore_activity_structure_step {

    /**
     * Defines the restore structure.
     *
     * @return array
     */
    protected function define_structure() {
        $paths = [];
        $userinfo = $this->get_setting_value('userinfo');

        $paths[] = new restore_path_element('cosmolab', '/activity/cosmolab');

        if ($userinfo) {
            $paths[] = new restore_path_element('cosmolab_result', '/activity/cosmolab/progress/result');
        }

        return $this->paths_to_structure($paths);
    }

    /**
     * Processes one activity.
     *
     * @param array $data
     */
    protected function process_cosmolab($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;

        $data->course = $this->get_courseid();
        $data->timecreated = $this->apply_date_offset($data->timecreated ?? time());
        $data->timemodified = $this->apply_date_offset($data->timemodified ?? time());
        if (!isset($data->baseurl) || $data->baseurl === '') {
            $data->baseurl = \mod_cosmolab\helper::DEFAULT_BASE_URL;
        }
        if (!isset($data->completionmission)) {
            $data->completionmission = 0;
        }

        $newitemid = $DB->insert_record('cosmolab', $data);
        $this->apply_activity_instance($newitemid);
    }

    /**
     * Processes one stored result.
     *
     * @param array $data
     */
    protected function process_cosmolab_result($data) {
        global $DB;

        $data = (object)$data;

        $data->cosmolabid = $this->get_new_parentid('cosmolab');
        $data->userid = $this->get_mappingid('user', $data->userid);
        if (empty($data->userid)) {
            return;
        }

        $data->timecreated = $this->apply_date_offset($data->timecreated ?? time());
        $data->timemodified = $this->apply_date_offset($data->timemodified ?? time());

        $DB->insert_record('cosmolab_progress', $data);
    }

    /**
     * Restores the intro files.
     */
    protected function after_execute() {
        $this->add_related_files('mod_cosmolab', 'intro', null);
    }
}
