/**
 * YOU AND ME — Service Worker
 * Xử lý: Push Notification, schedule nhắc nhở, offline cache, auto-update
 */

const CACHE_NAME = 'yam-v1';
const NOTIFY_TAG = 'yam-reminder';

// ── Cài đặt SW — skipWaiting ngay để kích hoạt bản mới ──────
self.addEventListener('install', e => {
  self.skipWaiting(); // Kích hoạt SW mới ngay, không chờ tab cũ đóng
});

// ── Activate — claim tất cả clients, xóa cache cũ ───────────
self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      // Xóa cache cũ (version cũ) để tải code mới
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  );
});

// ══════════════════════════════════════════════════════════════
// PUSH EVENT — Nhận thông báo từ server (nếu dùng push server)
// ══════════════════════════════════════════════════════════════
self.addEventListener('push', e => {
  let data = { title: '📚 YOU AND ME', body: 'Đến giờ học rồi!', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      tag:     NOTIFY_TAG,
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' },
      actions: [
        { action: 'open',   title: '📖 Học ngay' },
        { action: 'later',  title: '⏰ Nhắc lại sau' },
      ],
    })
  );
});

// ══════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — Người dùng bấm vào thông báo
// ══════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';

  if (e.action === 'later') {
    // Nhắc lại sau 30 phút
    setTimeout(() => {
      self.registration.showNotification('⏰ Nhắc lại: Đến giờ học!', {
        body:  'Bạn đã hẹn nhắc lại. Bắt đầu thôi nào! 💪',
        icon:  '/icons/icon-192.png',
        tag:   NOTIFY_TAG + '-later',
        data:  { url },
      });
    }, 30 * 60 * 1000);
    return;
  }

  // Mở app hoặc focus tab đang mở
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        clients.openWindow(url);
      }
    })
  );
});

// ══════════════════════════════════════════════════════════════
// MESSAGE — Nhận lệnh từ app (lập lịch thông báo)
// ══════════════════════════════════════════════════════════════
self.addEventListener('message', e => {
  const { type, payload } = e.data || {};

  if (type === 'SCHEDULE_REMINDER') {
    // Lập lịch nhắc ngay (delayMs = ms từ bây giờ)
    const { delayMs, title, body, url } = payload;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon:    '/icons/icon-192.png',
        badge:   '/icons/icon-72.png',
        tag:     NOTIFY_TAG,
        vibrate: [200, 100, 200],
        data:    { url: url || '/practice' },
        actions: [
          { action: 'open',  title: '📖 Học ngay' },
          { action: 'later', title: '⏰ Nhắc lại sau' },
        ],
      });
    }, delayMs);

    e.source?.postMessage({ type: 'SCHEDULED', delayMs });
  }

  if (type === 'CANCEL_REMINDERS') {
    // Đóng tất cả notification đang hiển thị
    self.registration.getNotifications({ tag: NOTIFY_TAG }).then(list => {
      list.forEach(n => n.close());
    });
  }

  if (type === 'PING') {
    e.source?.postMessage({ type: 'PONG' });
  }

  // App yêu cầu SW mới kích hoạt ngay
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ══════════════════════════════════════════════════════════════
// PERIODIC BACKGROUND SYNC (nếu browser hỗ trợ)
// ══════════════════════════════════════════════════════════════
self.addEventListener('periodicsync', e => {
  if (e.tag === 'daily-reminder') {
    e.waitUntil(
      self.registration.showNotification('📚 YOU AND ME — Học hàng ngày', {
        body:    'Duy trì thói quen học tập mỗi ngày nhé! 🔥',
        icon:    '/icons/icon-192.png',
        tag:     NOTIFY_TAG,
        vibrate: [200, 100, 200],
        data:    { url: '/practice' },
      })
    );
  }
});
