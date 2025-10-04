// routes/lessons.js (CÓDIGO COMPLETO E CORRIGIDO PARA EXIBIR COMENTÁRIOS)

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 💡 CORREÇÃO 1: Importa getComments
const { getLessons, getLessonContent, getMessages, getComments } = require('../database'); 
const { parseLessonContent } = require('../utils/parser');
const { requireAuth } = require('./auth'); // middleware de login


// Função para salvar o log de submissões do Quiz (simulação de DB)
function saveSubmissionLog(logEntry) {
    const logPath = path.join(__dirname, '..', 'content', 'quiz_submissions.json');
    let logs = [];
    
    // Tenta ler logs existentes
    if (fs.existsSync(logPath)) {
        try {
            logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        } catch (e) {
            console.error("Erro ao ler log de submissões:", e);
        }
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
}

// Função para salvar o COMENTÁRIO/FEEDBACK (simulação de DB)
function saveComment(commentEntry) {
    // Caminho para o comments.json na raiz do projeto
    const commentsPath = path.join(__dirname, '..', 'comments.json');
    let comments = [];
    
    if (fs.existsSync(commentsPath)) {
        try {
            comments = JSON.parse(fs.readFileSync(commentsPath, 'utf8'));
        } catch (e) {
            console.error("Erro ao ler arquivo de comentários:", e);
        }
    }
    
    // Garante que os campos de ID e Resposta do Admin estejam corretos
    commentEntry.id = Date.now().toString(); 
    commentEntry.status = 'pending'; // Status inicial
    commentEntry.adminResponse = null; 
    
    comments.push(commentEntry);
    fs.writeFileSync(commentsPath, JSON.stringify(comments, null, 2), 'utf8');
}


// --- LÓGICA DE PROCESSAMENTO DO QUIZ ---
router.post('/:id/submit', requireAuth, (req, res) => {
// ... código omitido (mantido o original para o quiz) ...
  const lessonId = req.params.id;
  const userAnswers = req.body; 
  const user = req.user;

  const solutionsPath = path.join(__dirname, '..', 'content', `solutions_${lessonId}.json`);

  if (!fs.existsSync(solutionsPath)) {
    console.warn(`Aviso: Nenhuma solução encontrada para o quiz ${lessonId}.`);
    return res.redirect(`/lessons/${lessonId}`); 
  }

  const solutions = JSON.parse(fs.readFileSync(solutionsPath, 'utf8'));
  let score = 0;
  
  Object.keys(solutions).forEach(qKey => {
    const correctAnswerIndex = solutions[qKey];
    const userAnswerIndex = userAnswers[qKey];

    if (userAnswerIndex && parseInt(userAnswerIndex) === correctAnswerIndex) {
      score++;
    }
  });

  const totalQuestions = Object.keys(solutions).length;
  const submissionLog = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      lessonId: lessonId,
      score: score,
      total: totalQuestions,
      userAnswers: userAnswers
  };
  
  saveSubmissionLog(submissionLog);

  req.session.quizResult = { 
      score, 
      total: totalQuestions, 
      message: `Você acertou ${score} de ${totalQuestions} perguntas no quiz!` 
  };
  
  res.redirect(`/lessons/${lessonId}`);
});


// --- LÓGICA DE ENVIO DE FEEDBACK (CORRIGIDA) ---
router.post('/:id/feedback', requireAuth, (req, res) => {
    const lessonId = parseInt(req.params.id); 
    const message = req.body.message; 
    const user = req.user; 

    if (!message || message.trim() === "") {
        req.session.errorMessage = "A mensagem de feedback não pode estar vazia.";
        return res.redirect(`/lessons/${lessonId}`);
    }

    const commentLog = {
        timestamp: new Date().toISOString(),
        userId: user.id, 
        // 🚨 CORREÇÃO 3: MUDANÇA DE 'userName' PARA 'username' (para consistência com feedback.ejs)
        username: user.username, 
        lessonId: lessonId,
        // 🚨 CORREÇÃO 4: MUDANÇA DE 'text' PARA 'message' (para consistência com feedback.ejs)
        message: message 
    };
    
    saveComment(commentLog);

    req.session.successMessage = "Sua dúvida/feedback foi enviado com sucesso para a administração!";

    res.redirect(`/lessons/${lessonId}`);
});


// Rota GET para exibir o formulário do quiz
router.get('/:id/quiz', requireAuth, (req, res) => {
// ... código omitido (mantido o original para o quiz) ...
  const lessonId = req.params.id;
  const quizPath = path.join(__dirname, '..', 'content', `quiz_${lessonId}.json`);

  if (!fs.existsSync(quizPath)) {
    return res.send("Nenhum quiz disponível para esta aula.");
  }

  const quizData = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
  res.render('lessons/quiz', { quiz: quizData, lessonId }); 
});


// Lista todas as aulas
router.get('/', requireAuth, (req, res) => {
// ... código omitido (mantido o original para listagem) ...
  const lessons = getLessons();
  const messages = getMessages();
  res.render('lessons/index', { 
      lessons, 
      messages, 
      user: req.user,
      title: 'Todas as Aulas' 
  });
});

// Visualizar uma aula específica (ATUALIZADA para carregar COMENTÁRIOS)
router.get('/:id', requireAuth, (req, res) => {
  const lessonId = parseInt(req.params.id); // Convertido para inteiro para filtrar corretamente
  const lessons = getLessons();
  const lesson = lessons.find(l => l.id === lessonId); // Compara inteiros

  if (!lesson) {
    return res.status(404).send('Aula não encontrada.');
  }

  try {
    const rawContent = getLessonContent(lessonId);
    const formattedHtml = parseLessonContent(rawContent);
    const messages = getMessages();

    // Lógica para carregar e filtrar COMENTÁRIOS
    const allComments = getComments();
    const lessonComments = allComments
        .filter(c => c.lessonId.toString() === lessonId.toString()) // Filtra por ID da aula
        // Ordena: mais antigo primeiro
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); 

    // LÓGICA DE MENSAGENS DE SESSÃO: Recupera e Limpa a Sessão
    const quizResult = req.session.quizResult;
    delete req.session.quizResult; 
    
    const successMessage = req.session.successMessage;
    delete req.session.successMessage;
    const errorMessage = req.session.errorMessage;
    delete req.session.errorMessage;
    
    res.render('lessons/show', {
      lesson,
      content: formattedHtml,
      messages,
      user: req.user,
      title: lesson.title,
      quizResult: quizResult,
      successMessage: successMessage, 
      errorMessage: errorMessage,
      // Passa os COMENTÁRIOS filtrados para o template
      comments: lessonComments 
    });
  } catch (err) {
    console.error('Erro ao carregar aula:', err);
    res.status(500).send('Erro ao carregar o conteúdo da aula.');
  }
});

module.exports = { router };

