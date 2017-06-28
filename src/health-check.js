const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ data: { ok: true } });
});

module.exports = router;
