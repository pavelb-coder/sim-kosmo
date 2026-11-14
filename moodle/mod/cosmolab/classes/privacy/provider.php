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
 * Privacy subsystem implementation for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cosmolab\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\transform;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

/**
 * Privacy provider for the КосмоЛаб activity module.
 */
class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\core_userlist_provider,
    \core_privacy\local\request\plugin\provider {

    /**
     * Describes the personal data stored by the plugin.
     *
     * @param collection $collection collection to add metadata to
     * @return collection
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('cosmolab', [
            'name' => 'privacy:metadata:cosmolab:name',
            'intro' => 'privacy:metadata:cosmolab:intro',
        ], 'privacy:metadata:cosmolab');

        $collection->add_database_table('cosmolab_progress', [
            'cosmolabid' => 'privacy:metadata:cosmolab_progress:cosmolabid',
            'userid' => 'privacy:metadata:cosmolab_progress:userid',
            'missionid' => 'privacy:metadata:cosmolab_progress:missionid',
            'progress' => 'privacy:metadata:cosmolab_progress:progress',
            'completed' => 'privacy:metadata:cosmolab_progress:completed',
            'score' => 'privacy:metadata:cosmolab_progress:score',
            'attempts' => 'privacy:metadata:cosmolab_progress:attempts',
            'timemodified' => 'privacy:metadata:cosmolab_progress:timemodified',
        ], 'privacy:metadata:cosmolab_progress');

        $collection->add_external_location_link('cosmolab_platform', [
            'missionid' => 'privacy:metadata:cosmolab_platform:missionid',
            'progress' => 'privacy:metadata:cosmolab_platform:progress',
        ], 'privacy:metadata:cosmolab_platform');

        return $collection;
    }

    /**
     * Returns the list of contexts containing personal data of the user.
     *
     * @param int $userid user id
     * @return contextlist
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $contextlist = new contextlist();

        $sql = "SELECT ctx.id
                  FROM {context} ctx
                  JOIN {course_modules} cm ON cm.id = ctx.instanceid AND ctx.contextlevel = :contextlevel
                  JOIN {modules} m ON m.id = cm.module AND m.name = :modname
                  JOIN {cosmolab} a ON a.id = cm.instance
                  JOIN {cosmolab_progress} p ON p.cosmolabid = a.id
                 WHERE p.userid = :userid";

        $contextlist->add_from_sql($sql, [
            'contextlevel' => CONTEXT_MODULE,
            'modname' => 'cosmolab',
            'userid' => $userid,
        ]);

        return $contextlist;
    }

    /**
     * Adds the users having personal data in the given context.
     *
     * @param userlist $userlist user list
     */
    public static function get_users_in_context(userlist $userlist) {
        $context = $userlist->get_context();
        if (!$context instanceof \context_module) {
            return;
        }

        $sql = "SELECT p.userid
                  FROM {cosmolab_progress} p
                  JOIN {course_modules} cm ON cm.instance = p.cosmolabid
                  JOIN {modules} m ON m.id = cm.module AND m.name = :modname
                 WHERE cm.id = :cmid";

        $userlist->add_from_sql('userid', $sql, [
            'modname' => 'cosmolab',
            'cmid' => $context->instanceid,
        ]);
    }

    /**
     * Exports the personal data of the user.
     *
     * @param approved_contextlist $contextlist approved contexts
     */
    public static function export_user_data(approved_contextlist $contextlist) {
        global $DB;

        $user = $contextlist->get_user();

        foreach ($contextlist->get_contexts() as $context) {
            if (!$context instanceof \context_module) {
                continue;
            }

            $sql = "SELECT p.*, a.name AS activityname
                      FROM {cosmolab_progress} p
                      JOIN {cosmolab} a ON a.id = p.cosmolabid
                      JOIN {course_modules} cm ON cm.instance = a.id
                     WHERE cm.id = :cmid AND p.userid = :userid
                  ORDER BY p.timemodified DESC";

            $records = $DB->get_records_sql($sql, ['cmid' => $context->instanceid, 'userid' => $user->id]);
            if (!$records) {
                continue;
            }

            $data = [];
            foreach ($records as $record) {
                $data[] = (object)[
                    'missionid' => $record->missionid,
                    'progress' => $record->progress,
                    'completed' => transform::yesno($record->completed),
                    'score' => $record->score,
                    'attempts' => $record->attempts,
                    'timemodified' => transform::datetime($record->timemodified),
                ];
            }

            $activityname = reset($records)->activityname;
            writer::with_context($context)->export_data(
                [get_string('privacy:path', 'cosmolab'), $activityname],
                (object)['results' => $data]
            );
        }
    }

    /**
     * Deletes all personal data in the context.
     *
     * @param \context $context context
     */
    public static function delete_data_for_all_users_in_context(\context $context) {
        global $DB;

        if (!$context instanceof \context_module) {
            return;
        }

        $cm = get_coursemodule_from_id('cosmolab', $context->instanceid);
        if (!$cm) {
            return;
        }

        $DB->delete_records('cosmolab_progress', ['cosmolabid' => $cm->instance]);
    }

    /**
     * Deletes the data of one user.
     *
     * @param approved_contextlist $contextlist contexts
     */
    public static function delete_data_for_user(approved_contextlist $contextlist) {
        global $DB;

        $userid = $contextlist->get_user()->id;

        foreach ($contextlist->get_contexts() as $context) {
            if (!$context instanceof \context_module) {
                continue;
            }

            $cm = get_coursemodule_from_id('cosmolab', $context->instanceid);
            if (!$cm) {
                continue;
            }

            $DB->delete_records('cosmolab_progress', [
                'cosmolabid' => $cm->instance,
                'userid' => $userid,
            ]);
        }
    }

    /**
     * Deletes the data of several users.
     *
     * @param approved_userlist $userlist approved users
     */
    public static function delete_data_for_users(approved_userlist $userlist) {
        global $DB;

        $context = $userlist->get_context();
        if (!$context instanceof \context_module) {
            return;
        }

        $cm = get_coursemodule_from_id('cosmolab', $context->instanceid);
        if (!$cm) {
            return;
        }

        $userids = $userlist->get_userids();
        if (!$userids) {
            return;
        }

        [$insql, $inparams] = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED);
        $params = array_merge(['cosmolabid' => $cm->instance], $inparams);

        $DB->delete_records_select('cosmolab_progress', "cosmolabid = :cosmolabid AND userid $insql", $params);
    }
}
