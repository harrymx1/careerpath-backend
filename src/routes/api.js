const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');

// Assessment & Recommendation Routes
router.post('/assessments', assessmentController.submitAssessment);
router.get('/profiles/:id/recommendations', assessmentController.getUserRecommendations);

module.exports = router;
