<?php
/**
 * Автономный тест чистой логики плагина mod_cosmolab без установленного Moodle.
 *
 * Подменяет минимум функций и констант ядра Moodle и проверяет помощники плагина:
 * каталог лабораторий и практикумов, нормализацию настроек, сборку URL для iframe,
 * перевод процентов в баллы и шкалу, возможности модуля и правило завершения.
 *
 * Запуск: php moodle/tools/logic-test.php
 */
error_reporting(E_ALL);
define('MOODLE_INTERNAL', true);
define('MUST_EXIST', 1);
define('FORMAT_HTML', 1);
define('PARAM_ALPHANUMEXT', 'alphanumext');
define('PARAM_TEXT', 'text');
define('PARAM_URL', 'url');
define('PARAM_INT', 'int');
define('PARAM_BOOL', 'bool');
define('PARAM_FLOAT', 'float');
define('COMPLETION_TRACKING_NONE', 0);
define('COMPLETION_TRACKING_MANUAL', 1);
define('COMPLETION_TRACKING_AUTOMATIC', 2);
define('COMPLETION_UNKNOWN', 2);
define('COMPLETION_COMPLETE', 1);
define('COMPLETION_INCOMPLETE', 0);
define('GRADE_TYPE_NONE', 0);
define('GRADE_TYPE_VALUE', 1);
define('GRADE_TYPE_SCALE', 2);
define('FEATURE_MOD_INTRO', 'mod_intro');
define('FEATURE_SHOW_DESCRIPTION', 'show_description');
define('FEATURE_GRADE_HAS_GRADE', 'grade_has_grade');
define('FEATURE_GRADE_OUTCOMES', 'grade_outcomes');
define('FEATURE_BACKUP_MOODLE2', 'backup_moodle2');
define('FEATURE_COMPLETION_TRACKS_VIEWS', 'completion_tracks_views');
define('FEATURE_COMPLETION_HAS_RULES', 'completion_has_rules');

// --- Минимальные заглушки ядра Moodle ---
function clean_param($value, $type) {
    return trim(strip_tags((string)$value));
}
function get_string($id, $comp = '', $a = null) {
    return $id;
}
function format_string($s) {
    return $s;
}
function shorten_text($text, $ideal = 30, $exact = false, $ending = '...') {
    return strlen($text) > $ideal ? substr($text, 0, $ideal) . $ending : $text;
}
function s($v) {
    return htmlspecialchars((string)$v, ENT_COMPAT);
}
function format_float($v, $dec = 2) {
    return number_format((float)$v, $dec, '.', '');
}

class stub_db {
    public $scales = [
        7 => null,
    ];
    public function __construct() {
        $this->scales[7] = (object)['id' => 7, 'scale' => 'Не выполнено, Частично, Выполнено, Отлично'];
    }
    public function get_record($table, $conditions, $fields = '*', $strictness = 0) {
        if ($table === 'scale' && isset($conditions['id'])) {
            return $this->scales[(int)$conditions['id']] ?? false;
        }
        return false;
    }
    public $progress = [];
    public function record_exists($table, $conditions) {
        return false;
    }
    public function get_records($table, $conditions = [], $sort = '', $fields = '*', $limitfrom = 0, $limitnum = 0) {
        if ($table === 'cosmolab_progress') {
            return $this->progress;
        }
        return [];
    }
}
$DB = new stub_db();

require_once __DIR__ . '/../mod/cosmolab/classes/helper.php';
require_once __DIR__ . '/../mod/cosmolab/lib.php';

$fail = 0;
function check($name, $actual, $expected) {
    global $fail;
    $ok = is_float($expected) ? abs((float)$actual - (float)$expected) < 0.001 : $actual === $expected;
    printf("  %s %s\n", $ok ? '✓' : '✗', $name);
    if (!$ok) {
        printf("      ожидалось: %s, получено: %s\n", var_export($expected, true), var_export($actual, true));
        $fail++;
    }
}

echo "helper::labs / missions\n";
check('5 лабораторий', count(\mod_cosmolab\helper::labs()), 5);
check('17 практикумов', count(\mod_cosmolab\helper::missions()), 17);
check('rocket: fix_tumble', \mod_cosmolab\helper::missions()['fix_tumble']['lab'], 'rocket');
check(
    'заголовок fix_tumble',
    \mod_cosmolab\helper::mission_title('fix_tumble'),
    '7. Авария: кувырок ракеты (ЦД впереди ЦМ)'
);
check('неизвестный практикум', \mod_cosmolab\helper::mission_title('nope'), '');

echo "normalise\n";
check('lab: rocket', \mod_cosmolab\helper::normalise_lab('rocket'), 'rocket');
check('lab: мусор -> cubesat', \mod_cosmolab\helper::normalise_lab('<script>'), 'cubesat');
check('baseurl: пусто -> default', \mod_cosmolab\helper::normalise_base_url(''), \mod_cosmolab\helper::DEFAULT_BASE_URL);
check(
    'baseurl: javascript -> default',
    \mod_cosmolab\helper::normalise_base_url('javascript:alert(1)'),
    \mod_cosmolab\helper::DEFAULT_BASE_URL
);
check('baseurl: без слэша', \mod_cosmolab\helper::normalise_base_url('https://school.local/lab'), 'https://school.local/lab/');

echo "iframe_url\n";
$lab = (object)[
    'baseurl' => 'https://pavelb-coder.github.io/sim-kosmo/',
    'lab' => 'rocket',
    'missionid' => 'strato_sounder',
    'embedmode' => 1,
];
$url = \mod_cosmolab\helper::iframe_url($lab);
check('task в URL', strpos($url, 'task=strato_sounder') !== false, true);
check('embed=1 в URL', strpos($url, 'embed=1') !== false, true);
$lab->missionid = '';
$lab->embedmode = 0;
$url = \mod_cosmolab\helper::iframe_url($lab);
check('lab без практикума', strpos($url, 'lab=rocket') !== false, true);
check('embed выключен', strpos($url, 'embed=') === false, true);

echo "оценки: баллы\n";
$points = (object)['grade' => 20];
check('100% -> 20', \cosmolab_score_to_grade($points, 100), 20.0);
check('50% -> 10', \cosmolab_score_to_grade($points, 50), 10.0);
check('150% -> 20 (ограничение)', \cosmolab_score_to_grade($points, 150), 20.0);
check('grademax для баллов', \cosmolab_grade_max($points), 20.0);

echo "оценки: шкала\n";
$scale = (object)['grade' => -7];
check('4 пункта шкалы', \cosmolab_grade_max($scale), 4.0);
check('0% -> 1 пункт', (float)\cosmolab_score_to_grade($scale, 0), 1.0);
check('100% -> 4 пункт', (float)\cosmolab_score_to_grade($scale, 100), 4.0);
check('50% -> 3 пункт', (float)\cosmolab_score_to_grade($scale, 50), 3.0);

echo "оценки: выключены\n";
$none = (object)['grade' => 0];
check('тип none -> 0', \cosmolab_score_to_grade($none, 100), 0.0);
check('grademax 0', \cosmolab_grade_max($none), 0.0);

echo "features\n";
check('FEATURE_GRADE_HAS_GRADE', cosmolab_supports(FEATURE_GRADE_HAS_GRADE), true);
check('FEATURE_COMPLETION_HAS_RULES', cosmolab_supports(FEATURE_COMPLETION_HAS_RULES), true);
check('неизвестная возможность', cosmolab_supports('nonsense'), null);

echo "normalise_instance\n";
$data = (object)[
    'name' => 'Практикум',
    'lab' => '<b>unknown</b>',
    'baseurl' => 'http://x/',
    'embedmode' => 0,
    'frameheight' => 5000,
    'grade' => 12.5,
];
$data = cosmolab_normalise_instance($data);
check('lab по умолчанию', $data->lab, 'cubesat');
check('высота ограничена', $data->frameheight, COSMOLAB_MAX_FRAME_HEIGHT);
check('baseurl со слэшем', $data->baseurl, 'http://x/');
check('оценка сохранена', $data->grade, 12.5);
check('completionmission по умолчанию', $data->completionmission, 0);
check('embedmode нормализован', $data->embedmode, 0);

echo "user_progress\n";
$activity = (object)['id' => 1, 'missionid' => 'strato_sounder'];
$summary = \mod_cosmolab\helper::user_progress($activity, 5);
check('нет записей -> не зачтено', $summary->completed, false);
check('нет записей -> балл 0', $summary->score, 0.0);
check('нет записей -> пустой прогресс', $summary->progress, '');

$GLOBALS['DB']->progress = [
    11 => (object)[
        'completed' => 0, 'score' => 40, 'progress' => 'Апогей 1200 м', 'attempts' => 1, 'timemodified' => 300,
    ],
    12 => (object)[
        'completed' => 1, 'score' => 60, 'progress' => 'Апогей 2400 м', 'attempts' => 2, 'timemodified' => 200,
    ],
    13 => (object)[
        'completed' => 1, 'score' => 90, 'progress' => 'Апогей 3050 м', 'attempts' => 1, 'timemodified' => 100,
    ],
];
$summary = \mod_cosmolab\helper::user_progress($activity, 5);
check('зачтено', $summary->completed, true);
check('лучший балл из зачтённых', $summary->score, 90.0);
check('прогресс из свежей записи', $summary->progress, 'Апогей 1200 м');
check('попытки суммируются', $summary->attempts, 4);

echo "завершение\n";
$cm = (object)['instance' => 1, 'customdata' => ['customcompletionrules' => ['completionmission' => 1]]];
check('нет записи -> incomplete', cosmolab_get_completion_state(null, $cm, 5, false), COMPLETION_INCOMPLETE);
$cm->customdata['customcompletionrules']['completionmission'] = 0;
check('правило выключено -> без изменений', cosmolab_get_completion_state(null, $cm, 5, false), false);

echo "\n";
echo $fail === 0 ? "ИТОГ: все проверки пройдены\n" : "ИТОГ: ошибок — $fail\n";
exit($fail === 0 ? 0 : 1);
