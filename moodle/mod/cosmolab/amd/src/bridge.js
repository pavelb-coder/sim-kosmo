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
 * Bridge between the Moodle activity and the КосмоЛаб platform loaded in the iframe.
 *
 * @module     mod_cosmolab/bridge
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['core/ajax', 'core/str'], function(Ajax, Str) {

    var config = null;
    var frame = null;
    var submitted = false;
    var lastProgress = '';

    /**
     * Updates the state chip on the activity page.
     *
     * @param {String} text
     * @param {Boolean} ok
     */
    function setState(text, ok) {
        var chip = document.getElementById('cosmolab-statechip');
        if (!chip) {
            return;
        }
        chip.textContent = text;
        chip.className = 'cosmolab-chip ' + (ok ? 'ok' : 'pending');
    }

    /**
     * Updates the progress line.
     *
     * @param {String} text
     */
    function setProgress(text) {
        if (!text || text === lastProgress) {
            return;
        }
        lastProgress = text;
        var box = document.getElementById('cosmolab-progress');
        if (box) {
            box.textContent = text;
        }
    }

    /**
     * Updates the grade chip.
     *
     * @param {Number} score percent
     */
    function setGrade(score) {
        var chip = document.getElementById('cosmolab-gradechip');
        if (!chip || !config.gradeEnabled) {
            return;
        }
        var percent = Math.max(0, Math.min(100, parseFloat(score) || 0));
        var value = Math.round(config.gradeMax * percent) / 100;
        chip.textContent = value.toFixed(2) + ' / ' + config.gradeMax.toFixed(2);
    }

    /**
     * Sends the activity configuration to the laboratory.
     */
    function sendConfig() {
        if (!frame || !frame.contentWindow) {
            return;
        }
        try {
            frame.contentWindow.postMessage({
                source: 'moodle-cosmolab',
                type: 'config',
                missionId: config.missionId,
                lab: config.lab,
                embed: true
            }, config.origin || '*');
        } catch (e) {
            window.console.log('CosmoLab: cannot post configuration', e);
        }
    }

    /**
     * Stores the result on the server.
     *
     * @param {Object} payload message from the laboratory
     */
    function submit(payload) {
        if (!payload.completed) {
            setProgress(payload.progress || '');
            return;
        }
        if (submitted) {
            setProgress(payload.message || '');
            return;
        }
        submitted = true;

        Ajax.call([{
            methodname: 'mod_cosmolab_submit_result',
            args: {
                cmid: config.cmid,
                missionid: payload.missionId || config.missionId || '',
                completed: true,
                progress: payload.message || '',
                score: typeof payload.score === 'number' ? payload.score : 100
            }
        }])[0].then(function(result) {
            if (!result || !result.status) {
                submitted = false;
                return result;
            }
            setProgress(payload.message || result.message || '');
            setGrade(result.score);
            Str.get_string('resultsaved', 'cosmolab').then(function(text) {
                setState(text, true);
                return text;
            }).catch(function() {
                setState('OK', true);
            });
            return result;
        }).catch(function(error) {
            submitted = false;
            Str.get_string('resulterror', 'cosmolab').then(function(text) {
                setState(text, false);
                return text;
            }).catch(function() {
                setState('Error', false);
            });
            window.console.log('CosmoLab: cannot store the result', error);
        });
    }

    /**
     * Handles messages coming from the laboratory iframe.
     *
     * @param {MessageEvent} event
     */
    function onMessage(event) {
        if (config.origin && event.origin !== config.origin) {
            return;
        }
        var data = event.data;
        if (!data || typeof data !== 'object' || data.source !== 'cosmolab') {
            return;
        }

        // Задание в элементе курса фиксировано: результаты других практикумов игнорируем.
        if (config.missionId && data.missionId && data.missionId !== config.missionId) {
            return;
        }

        if (data.type === 'ready') {
            sendConfig();
        } else if (data.type === 'mission-complete') {
            submit({
                completed: true,
                missionId: data.missionId,
                message: data.message,
                score: typeof data.score === 'number' ? data.score : 100
            });
        } else if (data.type === 'progress') {
            submit({completed: false, progress: data.progress});
        } else if (data.type === 'state') {
            setProgress(data.progress || '');
        }
    }

    return {
        /**
         * Initialises the bridge.
         *
         * @param {Object} cfg configuration from PHP
         */
        init: function(cfg) {
            config = cfg || {};
            config.gradeMax = parseFloat(config.gradeMax || 100);
            frame = document.getElementById('cosmolab-frame');
            if (!frame) {
                return;
            }

            window.addEventListener('message', onMessage);
            frame.addEventListener('load', function() {
                sendConfig();
                window.setTimeout(sendConfig, 800);
                window.setTimeout(sendConfig, 2500);
            });

            // Some browsers fire load before the JS module of the platform is ready.
            window.setTimeout(sendConfig, 3000);
        }
    };
});
