// routes/lessonRoutes.js

const { Router } = require('express');
const router = Router();
const lessonController = require('../controllers/lessonController'); 
const { requireAuth } = require('./auth'); 

// Rota para a listagem de aulas (GET /lessons)
router.get('/', requireAuth, lessonController.lesson_index); 

// Rota para ver os detalhes de uma aula (GET /lessons/:id)
router.get('/:id', requireAuth, lessonController.lesson_details);

// 🔥 NOVA ROTA 1: Para mostrar a página do Quiz (GET)
// Esta rota corresponde ao link que você tem no show.ejs
router.get('/:id/quiz', requireAuth, lessonController.startQuiz); 

// 🔥 NOVA ROTA 2: Para RECEBER a submissão do Quiz (POST)
// O formulário do Quiz vai postar para /lessons/101/submit
router.post('/:id/submit', requireAuth, lessonController.submitQuiz); 

module.exports = router;

