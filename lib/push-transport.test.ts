import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fcmAndroidConfig, fcmDataFields } from './push-transport';
import { pushData, buildAdminTask } from './admin/tasks';
import type { PushMessage } from './push';

test('an Action Centre FCM data map is the app contract and nothing else', () => {
  const task = buildAdminTask({
    type: 'safeline_case',
    entityType: 'hotline_tickets',
    entityPath: 'hotline_tickets/abc',
    title: 'SafeLine case',
    summary: 'A critical ticket is waiting.',
    priority: 'critical',
    slaTier: 'critical',
    now: 10,
  });
  const payload = pushData(task);
  const message: PushMessage = {
    recipientUid: 'admin-1',
    category: 'emergency',
    title: payload.title,
    body: task.summary,
    link: payload.deepLink,
    channelId: 'emergency',
    data: payload,
  };
  assert.deepEqual(Object.keys(fcmDataFields(message)).sort(), ['deepLink', 'entityPath', 'priority', 'slaTier', 'taskId', 'title', 'type']);
  assert.equal(fcmAndroidConfig(message)?.notification.channel_id, 'emergency');
  assert.equal(fcmAndroidConfig(message)?.priority, 'HIGH');
  const admin = fcmAndroidConfig({ ...message, channelId: 'admin', category: 'admin' });
  assert.equal(admin?.notification.channel_id, 'admin');
  assert.equal(admin?.priority, 'NORMAL');
});

test('a push without Action Centre data keeps link and category', () => {
  const message: PushMessage = {
    recipientUid: 'u1',
    category: 'hotline',
    title: 'Poket SafeLine',
    body: 'A ticket is waiting.',
    link: '/dashboard/teacher/hotline',
  };
  assert.deepEqual(fcmDataFields(message), { link: '/dashboard/teacher/hotline', category: 'hotline' });
  assert.equal(fcmAndroidConfig(message), undefined);
});
