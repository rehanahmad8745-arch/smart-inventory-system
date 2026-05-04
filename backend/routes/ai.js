const express = require('express');
const router = express.Router();

router.post('/predict', (req, res) => {
    res.json({
        success: true,
        text: 'AI route working perfectly'
    });
});

module.exports = router;