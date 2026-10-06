import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGoalProgress,
  calculateOverallProgress,
  calculateSubtaskProgress,
  getTodayTasks,
  getOverdueTasks,
  toISODateString,
  formatDateDisplay,
  formatHeroDate,
  getDateStrip,
  getTaskColorTheme,
  compressImageFile,
  computeTranslucencyValues,
  filterTasksByDate
} from '../src/utils.js';


describe('Progress Tracker Utility Logic', () => {
  const mockTasks = [
    { id: 't1', goalId: 'g1', title: 'Task 1', completed: true, dueDate: '2026-10-01' },
    { id: 't2', goalId: 'g1', title: 'Task 2', completed: false, dueDate: '2026-10-03' },
    { id: 't3', goalId: 'g2', title: 'Task 3', completed: true, dueDate: '2026-10-03' },
    { id: 't4', goalId: 'g2', title: 'Task 4', completed: false, dueDate: '2026-10-05' },
    { id: 't5', title: 'Standalone Task', completed: false, dueDate: '2026-09-30' },
  ];

  const mockSubtasks = [
    { id: 's1', taskId: 't2', title: 'Sub 1', completed: true },
    { id: 's2', taskId: 't2', title: 'Sub 2', completed: true },
    { id: 's3', taskId: 't2', title: 'Sub 3', completed: false },
  ];

  test('calculateGoalProgress computes correct percentages and counts', () => {
    const prog1 = calculateGoalProgress(mockTasks, 'g1');
    assert.equal(prog1.completedCount, 1);
    assert.equal(prog1.totalCount, 2);
    assert.equal(prog1.percent, 50);

    const progEmpty = calculateGoalProgress(mockTasks, 'non-existent');
    assert.equal(progEmpty.completedCount, 0);
    assert.equal(progEmpty.totalCount, 0);
    assert.equal(progEmpty.percent, 0);
  });

  test('calculateOverallProgress computes correct totals across all tasks', () => {
    const overall = calculateOverallProgress(mockTasks);
    assert.equal(overall.completedCount, 2);
    assert.equal(overall.totalCount, 5);
    assert.equal(overall.percent, 40);
  });

  test('calculateSubtaskProgress returns accurate subtask completion', () => {
    const subProg = calculateSubtaskProgress(mockSubtasks, 't2');
    assert.equal(subProg.completedCount, 2);
    assert.equal(subProg.totalCount, 3);
    assert.equal(subProg.percent, 67);

    const noSubProg = calculateSubtaskProgress(mockSubtasks, 't1');
    assert.equal(noSubProg.totalCount, 0);
    assert.equal(noSubProg.percent, 0);
  });

  test('getTodayTasks filters tasks matching given date', () => {
    const today = getTodayTasks(mockTasks, '2026-10-03');
    assert.equal(today.length, 2);
    assert.deepEqual(today.map(t => t.id), ['t2', 't3']);
  });

  test('getOverdueTasks identifies incomplete tasks past their due date', () => {
    const overdue = getOverdueTasks(mockTasks, '2026-10-03');
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0].id, 't5');
  });

  test('toISODateString correctly formats date objects to YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 3); // Month is 0-indexed: 9 = October
    assert.equal(toISODateString(d), '2026-10-03');
  });

  test('formatDateDisplay formats YYYY-MM-DD for UI display and handles null/all', () => {
    const display = formatDateDisplay('2026-10-03');
    assert.match(display, /Oct 3, 2026/);

    assert.equal(formatDateDisplay(null), 'All Dates');
    assert.equal(formatDateDisplay(undefined), 'All Dates');
    assert.equal(formatDateDisplay('all'), 'All Dates');
  });

  test('filterTasksByDate returns all tasks when date is null or all, and filters by specific date', () => {
    // When date is null, all tasks are returned irrespective of date
    const allTasksNull = filterTasksByDate(mockTasks, null);
    assert.equal(allTasksNull.length, 5);
    assert.deepEqual(allTasksNull.map(t => t.id), ['t1', 't2', 't3', 't4', 't5']);

    // When date is 'all', all tasks are returned
    const allTasksStr = filterTasksByDate(mockTasks, 'all');
    assert.equal(allTasksStr.length, 5);

    // When date is undefined, all tasks are returned
    const allTasksUndef = filterTasksByDate(mockTasks, undefined);
    assert.equal(allTasksUndef.length, 5);

    // When a specific date is selected, only tasks for that date are returned
    const specificDate = filterTasksByDate(mockTasks, '2026-10-03');
    assert.equal(specificDate.length, 2);
    assert.deepEqual(specificDate.map(t => t.id), ['t2', 't3']);
  });

  test('formatHeroDate formats date into dayMonth and weekday', () => {
    const hero = formatHeroDate('2026-06-04');
    assert.equal(hero.dayMonth, '04.06');
    assert.equal(hero.dayName, 'Thursday');
    assert.equal(hero.full, '04.06 Thursday');
  });

  test('getDateStrip generates array of sequential dates', () => {
    const base = new Date(2026, 9, 3);
    const strip = getDateStrip(base, 0, 4);
    assert.equal(strip.length, 5);
    assert.equal(strip[0].dateStr, '2026-10-03');
    assert.equal(strip[1].dayNum, '04');
  });

  test('getTaskColorTheme rotates through 4 distinct card themes', () => {
    assert.equal(getTaskColorTheme(0).theme, 'mint');
    assert.equal(getTaskColorTheme(1).theme, 'cream');
    assert.equal(getTaskColorTheme(2).theme, 'orange');
    assert.equal(getTaskColorTheme(3).theme, 'slate');
    assert.equal(getTaskColorTheme(4).theme, 'mint');
  });

  test('compressImageFile rejects invalid file input gracefully', async () => {
    await assert.rejects(
      async () => {
        // @ts-ignore
        await compressImageFile(null);
      },
      { message: 'Selected file is not an image' }
    );
  });

  test('computeTranslucencyValues accurately computes alpha and blur and handles bounds', () => {
    // 0% translucency = solid (alpha 1.0, blur 12px)
    const solid = computeTranslucencyValues(0);
    assert.equal(solid.alpha, 1);
    assert.equal(solid.blurPx, 12);

    // 50% translucency = alpha 0.5, blur 18px
    const mid = computeTranslucencyValues(50);
    assert.equal(mid.alpha, 0.5);
    assert.equal(mid.blurPx, 18);

    // 100% translucency = fully transparent glass (alpha 0.0, blur 24px)
    const max = computeTranslucencyValues(100);
    assert.equal(max.alpha, 0);
    assert.equal(max.blurPx, 24);

    // Clamps negative numbers to 0
    const under = computeTranslucencyValues(-20);
    assert.equal(under.alpha, 1);
    assert.equal(under.blurPx, 12);

    // Clamps values above 100 to 100
    const over = computeTranslucencyValues(120);
    assert.equal(over.alpha, 0);
    assert.equal(over.blurPx, 24);
  });


  test('handles multiple goals with independent progress calculation', () => {
    const goals = [
      { id: 'g1', title: 'Goal 1' },
      { id: 'g2', title: 'Goal 2' },
      { id: 'g3', title: 'Goal 3' },
    ];
    const results = goals.map(g => calculateGoalProgress(mockTasks, g.id));
    assert.equal(results[0].percent, 50); // g1 has 1 of 2 completed
    assert.equal(results[1].percent, 50); // g2 has 1 of 2 completed
    assert.equal(results[2].percent, 0);  // g3 has 0 tasks
  });
});




