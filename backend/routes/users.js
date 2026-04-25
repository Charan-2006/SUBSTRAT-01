const express = require('express');
const { getEngineers } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

const router = express.Router();

router.get('/', protect, authorize('Manager'), getEngineers);

module.exports = router;
