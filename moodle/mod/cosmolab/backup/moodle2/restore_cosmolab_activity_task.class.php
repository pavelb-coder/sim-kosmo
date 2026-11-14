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
 * Restore task for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @category   backup
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/cosmolab/backup/moodle2/restore_cosmolab_stepslib.php');

/**
 * Restore task that provides all the settings and steps to restore the activity.
 */
class restore_cosmolab_activity_task extends restore_activity_task {

    /**
     * No specific settings.
     */
    protected function define_my_settings() {
    }

    /**
     * Defines the restore step.
     */
    protected function define_my_steps() {
        $this->add_step(new restore_cosmolab_activity_structure_step('cosmolab_structure', 'cosmolab.xml'));
    }

    /**
     * Defines the contents to be processed by the link decoder.
     *
     * @return array
     */
    public static function define_decode_contents() {
        $contents = [];
        $contents[] = new restore_decode_content('cosmolab', ['intro'], 'cosmolab');
        return $contents;
    }

    /**
     * Defines the decoding rules for links.
     *
     * @return array
     */
    public static function define_decode_rules() {
        $rules = [];

        $rules[] = new restore_decode_rule('COSMOLABVIEWBYID', '/mod/cosmolab/view.php?id=$1', 'course_module');
        $rules[] = new restore_decode_rule('COSMOLABINDEX', '/mod/cosmolab/index.php?id=$1', 'course');
        $rules[] = new restore_decode_rule('COSMOLABVIEWBYC', '/mod/cosmolab/view.php?c=$1', 'cosmolab');

        return $rules;
    }
}
