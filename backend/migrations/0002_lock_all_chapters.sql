-- Lock every tape until payment.
--
-- The free first-chapter preview is gone: no audio URL — sample or full —
-- is released to an account that has not paid.

UPDATE chapters SET is_free = FALSE WHERE is_free;
