CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('en','es')),
  last_test INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE order_alerts (
  id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  next_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  UNIQUE(order_id,endpoint)
);
CREATE INDEX order_alerts_due ON order_alerts(next_at);
CREATE INDEX order_alerts_endpoint ON order_alerts(endpoint);
