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
 * Russian strings for mod_cosmolab.
 *
 * @package    mod_cosmolab
 * @copyright  2026 КосмоЛаб / sim-kosmo
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['attempts'] = 'Попытки';
$string['baseurl'] = 'Адрес платформы «КосмоЛаб»';
$string['baseurl_help'] = 'Адрес платформы, которую нужно встроить в курс. По умолчанию — публичная сборка на GitHub Pages. Укажите адрес своей копии, если платформа размещена на сервере школы.';
$string['completionmission'] = 'Студент должен выполнить задание';
$string['completionmission_help'] = 'Элемент курса считается завершённым, когда виртуальная лаборатория сообщает о зачёте практикума.';
$string['cosmolab:addinstance'] = 'Добавлять элемент курса «КосмоЛаб»';
$string['cosmolab:submit'] = 'Отправлять результаты из лаборатории';
$string['cosmolab:view'] = 'Просматривать лабораторию «КосмоЛаб»';
$string['cosmolab:viewreports'] = 'Просматривать отчёт о результатах «КосмоЛаб»';
$string['downloadcsv'] = 'Скачать отчёт в CSV';
$string['embedmode'] = 'Компактный режим (embed)';
$string['embedmode_help'] = 'Скрывает шапку платформы и открывает лабораторию в компактном режиме — так она лучше помещается внутри страницы элемента курса.';
$string['embednote'] = 'Лаборатория открывается во встроенном фрейме. Если страница не загрузилась, школьная сеть может блокировать внешние фреймы — откройте платформу в новой вкладке или разместите свою копию (см. настройки элемента).';
$string['errorbaseurl'] = 'Адрес платформы должен начинаться с http:// или https://';
$string['errorgrade'] = 'Максимальный балл должен быть положительным числом';
$string['frameheight'] = 'Высота фрейма, px';
$string['frameheight_help'] = 'Высота окна лаборатории. 820 px подходит для экрана 1366×768, 1000–1200 px удобно для проектора и больших мониторов.';
$string['gradeenabled'] = 'Выставлять оценку за задание';
$string['gradeenabled_help'] = 'Если включено, зачтённое задание попадает в журнал оценок курса.';
$string['grademax'] = 'Максимальный балл';
$string['grademax_help'] = 'Балл за выполненное задание. Качество посадки и параметры полёта оценку не меняют: задание оценивается «зачёт/незачёт» и переводится в этот максимум.';
$string['iframe_title'] = 'Виртуальная лаборатория «КосмоЛаб»: {$a}';
$string['intro'] = 'Описание';
$string['lab'] = 'Лаборатория';
$string['lab_cubesat'] = 'CubeSat / «ОрбиКрафт» — ориентация КА';
$string['lab_help'] = 'Лаборатория, которая открывается по умолчанию. Если выбрано задание, лаборатория определяется автоматически.';
$string['lab_lss'] = 'Система жизнеобеспечения станции';
$string['lab_orbit'] = 'Орбитальная механика и манёвры';
$string['lab_rocket'] = 'Ракета и CanSat (OpenRocket)';
$string['lab_sdr'] = 'Приёмная станция УКВ и ДЗЗ';
$string['lastmodified'] = 'Обновлено';
$string['mission'] = 'Практикум (задание)';
$string['mission_help'] = 'Практикум с автоматической проверкой из каталога платформы. Выберите «Свободный режим», чтобы ученики работали в песочнице без проверки.';
$string['missionmismatch'] = 'Полученное задание не совпадает с заданием этого элемента курса';
$string['modulename'] = 'КосмоЛаб (виртуальная лаборатория)';
$string['modulename_help'] = 'Добавляет в курс интерактивную виртуальную лабораторию «КосмоЛаб» (CubeSat, орбитальная механика, ракеты и CanSat с OpenRocket, приём УКВ и ДЗЗ, системы жизнеобеспечения). Результаты и прогресс ученика сохраняются в журнале оценок, регистрация и установка ПО не требуются.';
$string['modulename_link'] = 'mod/cosmolab/view';
$string['modulenameplural'] = 'КосмоЛаб';
$string['noinstances'] = 'В этом курсе пока нет элементов «КосмоЛаб»';
$string['noresults'] = 'Результатов пока нет: ученики ещё не выполняли задания в этом элементе.';
$string['openinnewtab'] = 'Открыть лабораторию в новой вкладке';
$string['platformsettings'] = 'Платформа и лаборатория';
$string['pluginadministration'] = 'Управление «КосмоЛаб»';
$string['pluginname'] = 'КосмоЛаб';
$string['privacy:metadata:cosmolab'] = 'Настройки элемента курса «КосмоЛаб».';
$string['privacy:metadata:cosmolab:name'] = 'Название элемента курса.';
$string['privacy:metadata:cosmolab:intro'] = 'Описание элемента курса.';
$string['privacy:metadata:cosmolab_platform'] = 'Данные, передаваемые внешней платформе «КосмоЛаб», загруженной во фрейм (идентификатор задания и текст прогресса). Платформа обрабатывает их только в браузере.';
$string['privacy:metadata:cosmolab_platform:missionid'] = 'Идентификатор открытого практикума.';
$string['privacy:metadata:cosmolab_platform:progress'] = 'Короткий текст прогресса, который видит ученик.';
$string['privacy:metadata:cosmolab_progress'] = 'Результаты учеников в элементах «КосмоЛаб».';
$string['privacy:metadata:cosmolab_progress:attempts'] = 'Количество попыток.';
$string['privacy:metadata:cosmolab_progress:completed'] = 'Задание зачтено или нет.';
$string['privacy:metadata:cosmolab_progress:cosmolabid'] = 'Идентификатор элемента курса, к которому относится результат.';
$string['privacy:metadata:cosmolab_progress:missionid'] = 'Идентификатор практикума.';
$string['privacy:metadata:cosmolab_progress:progress'] = 'Последнее сообщение о прогрессе ученика.';
$string['privacy:metadata:cosmolab_progress:score'] = 'Балл в процентах.';
$string['privacy:metadata:cosmolab_progress:timemodified'] = 'Время последнего обновления.';
$string['privacy:metadata:cosmolab_progress:userid'] = 'Идентификатор ученика.';
$string['privacy:path'] = 'Результаты «КосмоЛаб»';
$string['progress'] = 'Прогресс';
$string['progressempty'] = 'Прогресса пока нет — начните задание в лаборатории.';
$string['report'] = 'Отчёт о результатах';
$string['reseterror'] = 'Не удалось сбросить результаты';
$string['resetresults'] = 'Удалить все результаты учеников в элементах «КосмоЛаб»';
$string['resulterror'] = 'Результат не сохранён — проверьте соединение';
$string['resultsaved'] = 'Задание зачтено';
$string['sandbox'] = 'Свободный режим (без автопроверки)';
$string['score'] = 'Балл, %';
$string['status'] = 'Статус';
$string['statuscompleted'] = 'Зачтено';
$string['statusinprogress'] = 'В процессе';
$string['student'] = 'Ученик';
