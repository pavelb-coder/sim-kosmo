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
 * External functions and service definitions for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    'mod_cosmolab_submit_result' => [
        'classname' => 'mod_cosmolab\external\submit_result',
        'methodname' => 'execute',
        'description' => 'Stores the progress of a student in a КосмоЛаб activity and updates grade/completion.',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'mod/cosmolab:submit',
    ],
    'mod_cosmolab_get_result' => [
        'classname' => 'mod_cosmolab\external\get_result',
        'methodname' => 'execute',
        'description' => 'Returns the stored status of the current user in a КосмоЛаб activity.',
        'type' => 'read',
        'ajax' => true,
        'capabilities' => 'mod/cosmolab:view',
    ],
];
