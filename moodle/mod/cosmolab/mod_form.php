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
 * Activity settings form for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Module settings form.
 */
class mod_cosmolab_mod_form extends moodleform_mod {

    /**
     * Defines the form.
     */
    public function definition() {
        global $CFG, $COURSE;

        $mform = $this->_form;

        // General.
        $mform->addElement('header', 'general', get_string('general', 'form'));

        $mform->addElement('text', 'name', get_string('name'), ['size' => '64']);
        $mform->setType('name', empty($CFG->formatstringstriptags) ? PARAM_CLEANHTML : PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');

        $this->standard_intro_elements(get_string('intro', 'cosmolab'));

        // Platform settings.
        $mform->addElement('header', 'cosmolabhdr', get_string('platformsettings', 'cosmolab'));

        $mform->addElement('select', 'lab', get_string('lab', 'cosmolab'), \mod_cosmolab\helper::labs());
        $mform->setType('lab', PARAM_ALPHANUMEXT);
        $mform->addHelpButton('lab', 'lab', 'cosmolab');
        $mform->setDefault('lab', 'cubesat');

        $missions = ['' => get_string('sandbox', 'cosmolab')];
        foreach (\mod_cosmolab\helper::missions() as $id => $mission) {
            $missions[$id] = $mission['title'];
        }
        $mform->addElement('select', 'missionid', get_string('mission', 'cosmolab'), $missions);
        $mform->setType('missionid', PARAM_ALPHANUMEXT);
        $mform->addHelpButton('missionid', 'mission', 'cosmolab');
        $mform->setDefault('missionid', '');

        $mform->addElement('text', 'baseurl', get_string('baseurl', 'cosmolab'), ['size' => '70']);
        $mform->setType('baseurl', PARAM_URL);
        $mform->setDefault('baseurl', \mod_cosmolab\helper::DEFAULT_BASE_URL);
        $mform->addHelpButton('baseurl', 'baseurl', 'cosmolab');
        $mform->addRule('baseurl', null, 'required', null, 'client');

        $mform->addElement('selectyesno', 'embedmode', get_string('embedmode', 'cosmolab'));
        $mform->setDefault('embedmode', 1);
        $mform->addHelpButton('embedmode', 'embedmode', 'cosmolab');

        $mform->addElement('text', 'frameheight', get_string('frameheight', 'cosmolab'), ['size' => '6']);
        $mform->setType('frameheight', PARAM_INT);
        $mform->setDefault('frameheight', 820);
        $mform->addRule('frameheight', null, 'numeric', null, 'client');
        $mform->addHelpButton('frameheight', 'frameheight', 'cosmolab');

        // Оценка: стандартные элементы Moodle (максимальный балл, шкала, категория, проходной балл).
        // Настройка помогает выбрать и стандартное условие завершения «получена оценка».
        $this->standard_grading_coursemodule_elements();

        // Hidden field keeps the custom completion rule value in the module table.
        $mform->addElement('hidden', 'completionmission', 0);
        $mform->setType('completionmission', PARAM_INT);

        $this->standard_coursemodule_elements();

        $this->add_action_buttons();
    }

    /**
     * Checks that the grade max is a positive number when grading is enabled.
     *
     * @param array $data submitted data
     * @param array $files submitted files
     * @return array errors
     */
    public function validation($data, $files) {
        $errors = parent::validation($data, $files);

        if (!empty($data['baseurl']) && !preg_match('~^https?://~i', trim($data['baseurl']))) {
            $errors['baseurl'] = get_string('errorbaseurl', 'cosmolab');
        }

        return $errors;
    }

    /**
     * Adds the custom completion rule "mission passed".
     *
     * @return array element names
     */
    public function add_completion_rules() {
        $mform = $this->_form;
        $group = [];

        $group[] = $mform->createElement(
            'checkbox',
            'completionmissionenabled',
            '',
            get_string('completionmission', 'cosmolab')
        );

        $mform->addGroup($group, 'completionmissiongroup', '', [' '], false);
        $mform->addHelpButton('completionmissiongroup', 'completionmission', 'cosmolab');

        return ['completionmissiongroup'];
    }

    /**
     * Tells whether the custom completion rule is enabled.
     *
     * @param array $data submitted data
     * @return bool
     */
    public function completion_rule_enabled($data) {
        return !empty($data['completionmissionenabled']);
    }

    /**
     * Prepares default values for the custom completion checkbox.
     *
     * @param array $defaultvalues defaults
     */
    public function data_preprocessing(&$defaultvalues) {
        parent::data_preprocessing($defaultvalues);
        $defaultvalues['completionmissionenabled'] = !empty($defaultvalues['completionmission']) ? 1 : 0;
    }

    /**
     * Syncs the custom completion checkbox with the hidden database field.
     *
     * @param stdClass $data form data
     */
    public function data_postprocessing($data) {
        parent::data_postprocessing($data);
        if (!empty($data->completionunlocked)) {
            $autocompletion = !empty($data->completion) && $data->completion == COMPLETION_TRACKING_AUTOMATIC;
            if (empty($data->completionmissionenabled) || !$autocompletion) {
                $data->completionmission = 0;
            } else {
                $data->completionmission = 1;
            }
        }
    }
}
