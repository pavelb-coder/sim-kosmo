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
 * Backup structure step for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @category   backup
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Defines the complete structure of the activity for backup.
 */
class backup_cosmolab_activity_structure_step extends backup_activity_structure_step {

    /**
     * Defines the backup structure.
     *
     * @return backup_nested_element
     */
    protected function define_structure() {

        $userinfo = $this->get_setting_value('userinfo');

        $cosmolab = new backup_nested_element('cosmolab', ['id'], [
            'name', 'intro', 'introformat', 'lab', 'missionid', 'baseurl', 'embedmode', 'frameheight',
            'gradeenabled', 'grade', 'completionmission', 'timecreated', 'timemodified',
        ]);

        $progress = new backup_nested_element('progress');

        $result = new backup_nested_element('result', ['id'], [
            'userid', 'missionid', 'lab', 'progress', 'completed', 'score', 'attempts',
            'timecreated', 'timemodified',
        ]);

        $cosmolab->add_child($progress);
        $progress->add_child($result);

        $cosmolab->set_source_table('cosmolab', ['id' => backup::VAR_ACTIVITYID]);

        if ($userinfo) {
            $result->set_source_table('cosmolab_progress', ['cosmolabid' => backup::VAR_PARENTID]);
        }

        $result->annotate_ids('user', 'userid');
        $cosmolab->annotate_files('mod_cosmolab', 'intro', null);

        return $this->prepare_activity_structure($cosmolab);
    }
}
