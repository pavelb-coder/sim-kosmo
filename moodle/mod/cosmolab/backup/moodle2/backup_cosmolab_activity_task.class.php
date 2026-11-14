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
 * Backup task for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @category   backup
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/cosmolab/backup/moodle2/backup_cosmolab_stepslib.php');

/**
 * Provides the steps to perform one complete backup of the activity.
 */
class backup_cosmolab_activity_task extends backup_activity_task {

    /**
     * No specific settings for this activity.
     */
    protected function define_my_settings() {
    }

    /**
     * Defines the backup step.
     */
    protected function define_my_steps() {
        $this->add_step(new backup_cosmolab_activity_structure_step('cosmolab_structure', 'cosmolab.xml'));
    }

    /**
     * Encodes URLs to the index and view scripts.
     *
     * @param string $content content to encode
     * @return string encoded content
     */
    public static function encode_content_links($content) {
        global $CFG;

        $base = preg_quote($CFG->wwwroot, '/');

        $search = "/(" . $base . "\/mod\/cosmolab\/index.php\?id\=)([0-9]+)/";
        $content = preg_replace($search, '$@COSMOLABINDEX*$2@$', $content);

        $search = "/(" . $base . "\/mod\/cosmolab\/view.php\?id\=)([0-9]+)/";
        $content = preg_replace($search, '$@COSMOLABVIEWBYID*$2@$', $content);

        $search = "/(" . $base . "\/mod\/cosmolab\/view.php\?c\=)([0-9]+)/";
        $content = preg_replace($search, '$@COSMOLABVIEWBYC*$2@$', $content);

        return $content;
    }
}
