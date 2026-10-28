import assert from 'node:assert/strict';
import test from 'node:test';
import { aiStudioDestination, relocateStudioPath, studioRedirects } from './studio-paths';

test('ai-studio keeps the subpath and renames the timetabler', () => {
  assert.equal(aiStudioDestination('/ai-studio'), '/dashboard/studio');
  assert.equal(aiStudioDestination('/ai-studio/timetabler'), '/dashboard/studio/timetable');
  assert.equal(aiStudioDestination('/ai-studio/maths/lab'), '/dashboard/studio/maths/lab');
  assert.equal(relocateStudioPath('/ai-studio/timetabler?week=1'), '/dashboard/studio/timetable?week=1');
  assert.equal(relocateStudioPath('/ai-studio/teachers/et-science'), '/dashboard/studio/teachers/et-science');
  const timetabler = studioRedirects.find(rule => rule.source === '/ai-studio/timetabler');
  const generic = studioRedirects.find(rule => rule.source === '/ai-studio/:path*');
  assert.equal(timetabler?.destination, '/dashboard/studio/timetable');
  assert.equal(generic?.destination, '/dashboard/studio/:path*');
  assert.ok(studioRedirects.findIndex(rule => rule.source === '/ai-studio/timetabler')
    < studioRedirects.findIndex(rule => rule.source === '/ai-studio/:path*'));
});
