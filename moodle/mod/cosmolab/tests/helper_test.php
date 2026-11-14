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
 * Unit tests for mod_cosmolab helpers.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cosmolab;

defined('MOODLE_INTERNAL') || die();

/**
 * Tests for the helper class.
 *
 * @covers \mod_cosmolab\helper
 */
class helper_test extends \advanced_testcase {

    /**
     * The lab catalogue contains the five laboratories of the platform.
     */
    public function test_labs(): void {
        $labs = helper::labs();
        $this->assertCount(5, $labs);
        foreach (['cubesat', 'orbit', 'rocket', 'sdr', 'lss'] as $key) {
            $this->assertArrayHasKey($key, $labs);
        }
    }

    /**
     * Unknown lab keys fall back to cubesat.
     */
    public function test_normalise_lab(): void {
        $this->assertEquals('rocket', helper::normalise_lab('rocket'));
        $this->assertEquals('cubesat', helper::normalise_lab('unknown'));
        $this->assertEquals('cubesat', helper::normalise_lab(''));
        $this->assertEquals('cubesat', helper::normalise_lab('<script>'));
    }

    /**
     * Only http(s) URLs are accepted as a platform address.
     */
    public function test_normalise_base_url(): void {
        $this->assertEquals(helper::DEFAULT_BASE_URL, helper::normalise_base_url(''));
        $this->assertEquals(helper::DEFAULT_BASE_URL, helper::normalise_base_url('javascript:alert(1)'));
        $this->assertEquals(helper::DEFAULT_BASE_URL, helper::normalise_base_url('ftp://example.com/'));
        $this->assertEquals('https://school.example/lab/', helper::normalise_base_url('https://school.example/lab'));
        $this->assertEquals('https://school.example/lab/', helper::normalise_base_url('https://school.example/lab/'));
    }

    /**
     * The iframe URL contains the mission and the embed flag.
     */
    public function test_iframe_url(): void {
        $instance = (object)[
            'baseurl' => 'https://pavelb-coder.github.io/sim-kosmo/',
            'lab' => 'rocket',
            'missionid' => 'strato_sounder',
            'embedmode' => 1,
        ];

        $url = helper::iframe_url($instance);
        $this->assertStringContainsString('task=strato_sounder', $url);
        $this->assertStringContainsString('embed=1', $url);
        $this->assertStringNotContainsString('lab=', $url);

        $instance->missionid = '';
        $instance->embedmode = 0;
        $url = helper::iframe_url($instance);
        $this->assertStringContainsString('lab=rocket', $url);
        $this->assertStringNotContainsString('embed=', $url);
    }

    /**
     * The mission catalogue contains all 17 practical tasks.
     */
    public function test_missions_catalogue(): void {
        $missions = helper::missions();
        $this->assertCount(17, $missions);
        $this->assertArrayHasKey('fix_tumble', $missions);
        $this->assertEquals('rocket', $missions['fix_tumble']['lab']);
        $this->assertNotEmpty(helper::mission_title('fix_tumble'));
        $this->assertSame('', helper::mission_title('no_such_mission'));
    }

    /**
     * Percent scores are converted into the activity grade range.
     */
    public function test_score_to_grade(): void {
        global $CFG;
        require_once($CFG->dirroot . '/mod/cosmolab/lib.php');

        $instance = (object)['grade' => 20];
        $this->assertEquals(20, \cosmolab_score_to_grade($instance, 100));
        $this->assertEquals(10, \cosmolab_score_to_grade($instance, 50));
        $this->assertEquals(0, \cosmolab_score_to_grade($instance, 0));
        $this->assertEquals(20, \cosmolab_score_to_grade($instance, 150));
    }
}
