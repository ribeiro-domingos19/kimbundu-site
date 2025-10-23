// ===========================================
// routes/lessons.js 
// ===========================================

const express = require('express');
const router = express.Router();

const MIN_PASS_SCORE = 0.7;
const { 
    getLessons, getLessonContent, 
    getUserProgress, markLessonComplete,
    getComments, 
    getMessages, 
    getSubmissionLogs,
    // 💡 CORREÇÃO CRÍTICA: A função para salvar é saveNewComment, não saveComments.
    saveNewComment,
    logQuizSubmission
} = require('../database');

const { requireAuth } = require('./auth');
const { parseLessonContent } = require('../utils/parser');

// Rota principal da área logada, lista todas as aulas
router.get('/', requireAuth, (req, res) => {
    const lessons = getLessons(); // Síncrono, OK (lê JSON local)
    res.render('lessons/index', { 
        lessons, 
        title: 'Aulas',
        user: req.user
    });
});

// Rota para marcar aula como concluída
router.post('/complete/:lessonId', requireAuth, async (req, res) => {
    const lessonId = req.params.lessonId;
    
    try {
        // markLessonComplete é assíncrona
        await markLessonComplete(req.user.id, lessonId); 
        res.redirect(`/lessons/${lessonId}?complete=true`);
    } catch (e) {
        console.error("Erro ao marcar aula como completa:", e);
        res.status(500).send("Erro ao salvar progresso.");
    }
});


// Rota de visualização de aula (GET /lessons/:id)
router.get('/:id', requireAuth, async (req, res) => { 
    const lessonId = req.params.id;
    
    try {
        const rawContent = getLessonContent(lessonId); // Síncrono (lê TXT local)
        const lessonHtml = parseLessonContent(rawContent);
        
        // Funções assíncronas (Firebase)
        const messages = await getMessages(); 
        const userProgress = await getUserProgress(req.user.id); 
        const allComments = await getComments(); 
        
        const comments = allComments
            .filter(c => c.lessonId.toString() === lessonId.toString()) 
            .sort((a, b) => {
                if (a.status === 'responded' && b.status !== 'responded') return -1;
                if (a.status !== 'responded' && b.status === 'responded') return 1;
                return new Date(b.timestamp) - new Date(a.timestamp); 
            });


        let successMsg = null;
        let errorMsg = null;
        
        if (req.query.complete === 'true') {
            successMsg = 'Parabéns! Aula marcada como concluída.';
        } else if (req.query.quiz === 'success') {
            successMsg = 'Parabéns! Quiz concluído com sucesso e aula marcada como concluída.';
        } else if (req.query.quiz === 'fail') {
            errorMsg = 'Resposta do quiz incorreta. Tente novamente!';
        }
        
        const isComplete = userProgress.includes(parseInt(lessonId));
        const lesson = getLessons().find(l => l.id.toString() === lessonId.toString());

        if (!lesson) {
            return res.status(404).send('Aula não encontrada.');
        }

        res.render('lessons/show', {
            lesson,
            content: lessonHtml,
            isComplete,
            comments,
            messages,
            successMessage: successMsg,
            errorMessage: errorMsg, 
            title: lesson.title,
            user: req.user,
            quizSuccess: req.query.quiz === 'success',
            lessonId: parseInt(lessonId) 
        });

    } catch (e) {
        console.error(`Erro ao carregar aula ${lessonId}:`, e);
        res.status(500).send(`Erro interno ao carregar a aula. Por favor, verifique a mensagem de erro no console do servidor.`);
    }
});

// Rota POST para envio de Feedback
router.post('/:lessonId/feedback', requireAuth, async (req, res) => {
    const lessonId = req.params.lessonId;
    const { message } = req.body; 
    
    if (!lessonId || !message || !req.user) {
        return res.status(400).send('Dados inválidos ou usuário não logado.');
    }

    try {
        const newComment = {
            // Os dados necessários para o database.js (Firebase)
            lessonId: parseInt(lessonId),
            userId: req.user.id, 
            username: req.user.username, 
            message: message,
            adminResponse: null, 
            status: 'pending' 
        };

        // 💡 CORREÇÃO CRÍTICA: Chama a função saveNewComment (assíncrona).
        await saveNewComment(newComment); 

        // Redireciona de volta para a aula, pulando para a seção de comentários
        res.redirect(`/lessons/${lessonId}#comments`);

    } catch (e) {
        console.error("Erro ao enviar feedback:", e);
        res.status(500).send("Erro interno ao enviar o feedback. Consulte o console do servidor para detalhes.");
    }
});

router.post('/:lessonId/quiz', requireAuth, async (req, res) => { // 💡 MUDE A ROTA PARA USAR /:lessonId/quiz
    const lessonId = req.params.lessonId;
    const userAnswers = req.body; // Recebe { q1: '0', q2: '1', ... }

    try {
        const lessons = getLessons(); 
        const lesson = lessons.find(l => l.id.toString() === lessonId.toString());

        if (!lesson || !lesson.questions) {
            return res.status(404).send('Dados do quiz não encontrados.');
        }

        const correctQuestions = lesson.questions;
        let score = 0;
        const totalQuestions = Object.keys(correctQuestions).length;

        // 1. Lógica de Correção
        for (const qKey in userAnswers) {
            // Verifica se a chave do formulário existe no gabarito
            if (correctQuestions[qKey]) {
                const correctAnswerIndex = correctQuestions[qKey].answer;
                const userAnswerIndex = parseInt(userAnswers[qKey]);
                
                // Compara a resposta do usuário (índice) com a resposta correta (índice)
                if (userAnswerIndex === correctAnswerIndex) {
                    score++;
                }
            }
        }
        
        // 2. Lógica de Aprovação
        const passRate = score / totalQuestions;
        const passed = passRate >= MIN_PASS_SCORE;

        // 3. Salva o Log no Firebase
        await logQuizSubmission(req.user.id, req.user.username, lessonId, score, totalQuestions, passed);

        // 4. Marca como completo se aprovado
        if (passed) {
            await markLessonComplete(req.user.id, lessonId); 
            // Redireciona com sucesso
            return res.redirect(`/lessons/${lessonId}?quiz=success`);
        } else {
            // Redireciona com falha
            return res.redirect(`/lessons/${lessonId}?quiz=fail`);
        }

    } catch (e) {
        console.error("Erro ao processar submissão do quiz:", e);
        res.status(500).send("Erro interno ao processar o quiz.");
    }
});

// Rota GET para a página do quiz (GET /lessons/:lessonId/quiz)
router.get('/:lessonId/quiz', requireAuth, (req, res) => {
    const lessonId = req.params.lessonId;
    const lessons = getLessons(); 
    const lesson = lessons.find(l => l.id.toString() === lessonId.toString());

    if (!lesson) {
        return res.status(404).send('Quiz não encontrado para esta aula.');
    }
    
    res.render('lessons/quiz', {
        lesson,
        quiz: lesson, // Define 'quiz' para o EJS usar 'quiz.questions'
        lessonId: parseInt(lessonId),
        title: `Quiz: ${lesson.title}`,
        user: req.user
    });
});


module.exports = { router };

