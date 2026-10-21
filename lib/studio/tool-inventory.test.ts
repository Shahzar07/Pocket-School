import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeSidebarId,
  isAiToolPath,
  ownsStudioShell,
  sidebarTools,
} from './tool-inventory';

describe('AI tool shell inventory', () => {
  it('wraps studio children and leaves the chat homes to draw their own shell', () => {
    assert.equal(isAiToolPath('/dashboard/studio'), true);
    assert.equal(ownsStudioShell('/dashboard/studio'), true);
    assert.equal(ownsStudioShell('/dashboard/studio/et'), true);
    assert.equal(ownsStudioShell('/dashboard/studio/maths'), false);
    assert.equal(isAiToolPath('/dashboard/studio/maths/lab'), true);
    assert.equal(isAiToolPath('/dashboard/studio/exam-prep/join/abc'), true);
    assert.equal(isAiToolPath('/dashboard/teacher/upload'), true);
    assert.equal(isAiToolPath('/dashboard/admin/books'), true);
    assert.equal(isAiToolPath('/reads/studio'), true);
    assert.equal(isAiToolPath('/ai-teachers/et-maths/session'), true);
    assert.equal(isAiToolPath('/reads'), false);
    assert.equal(isAiToolPath('/dashboard/admin/blog'), false);
    assert.equal(isAiToolPath('/dashboard/teacher/gradebook'), false);
  });

  it('keeps role gates on the tools list', () => {
    const student = sidebarTools({ role: 'student' }, 'dashboard').map(tool => tool.label);
    const teacher = sidebarTools({ role: 'teacher' }, 'dashboard').map(tool => tool.label);
    const parent = sidebarTools({ role: 'parent' }, 'dashboard').map(tool => tool.label);
    assert.equal(student.includes('Timetabler'), false);
    assert.equal(student.includes('Teacher Toolkit'), false);
    assert.equal(student.includes('Research Helper'), true);
    assert.equal(teacher.includes('Timetabler'), true);
    assert.equal(teacher.includes('Teacher Toolkit'), true);
    assert.equal(teacher.includes('Parent Explainer'), false);
    assert.equal(parent.includes('Parent Explainer'), true);
    assert.equal(parent.includes('Timetabler'), false);
    assert.equal(sidebarTools({ role: 'admin' }, 'dashboard').some(tool => tool.label === 'AI Book Creator'), true);
    assert.equal(student.includes('AI Book Creator'), false);
  });

  it('puts AI Teachers in the top group and gives every tool an icon', () => {
    for (const role of ['student', 'teacher', 'parent', 'admin', 'institution_admin'] as const) {
      const tools = sidebarTools({ role }, 'dashboard');
      const teachers = tools.find(tool => tool.id === 'ai-teachers');
      assert.ok(teachers);
      assert.equal(teachers.placement, 'primary');
      assert.equal(teachers.icon, 'graduation');
      assert.equal(tools.some(tool => tool.label === 'ET + Subject'), false);
      assert.equal(tools.every(tool => tool.icon.length > 0), true);
    }
    const admin = sidebarTools({ role: 'admin' }, 'dashboard').filter(tool => tool.placement === 'tools').map(tool => tool.id);
    assert.deepEqual(admin.slice(0, 8), [
      'ai-studio', 'et-ai', 'et-maths', 'et-exams', 'et-essays', 'creator-store', 'ai-book-creator', 'timetabler',
    ]);
    const studentTools = sidebarTools({ role: 'student' }, 'dashboard');
    assert.equal(studentTools.some(tool => tool.id === 'timetabler' || tool.id === 'teacher-toolkit'), false);
    assert.equal(studentTools.some(tool => tool.id === 'book-studio'), true);
    const teacherTools = sidebarTools({ role: 'teacher' }, 'dashboard');
    assert.equal(teacherTools.some(tool => tool.id === 'timetabler'), true);
    assert.equal(teacherTools.some(tool => tool.id === 'teacher-toolkit'), true);
  });

  it('highlights the longest matching tool', () => {
    const tools = sidebarTools({ role: 'teacher' }, 'dashboard');
    assert.equal(activeSidebarId('/dashboard/studio', tools), 'ai-studio');
    assert.equal(activeSidebarId('/dashboard/studio/et', tools), 'et-ai');
    assert.equal(activeSidebarId('/dashboard/studio/maths/packs/igcse', tools), 'et-maths');
    assert.equal(activeSidebarId('/dashboard/studio/exams/packs', tools), 'official-exams');
    const official = tools.find(tool => tool.id === 'official-exams');
    assert.equal(official?.label, 'Official exams');
    assert.equal(official?.parentId, 'et-exams');
    assert.equal(sidebarTools({ role: 'student' }, 'dashboard').some(tool => tool.label === 'Exam pack desk'), false);
    assert.equal(sidebarTools({ role: 'admin' }, 'dashboard').some(tool => tool.label === 'Exam pack desk'), true);
    assert.equal(activeSidebarId('/dashboard/teacher/timetable', tools), 'timetabler');
    assert.equal(activeSidebarId('/reads/studio', tools), 'book-studio');
    assert.equal(activeSidebarId('/dashboard/studio/teachers/et-maths', tools), 'ai-teachers');
  });
});
