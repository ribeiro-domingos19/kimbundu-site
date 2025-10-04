const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const {
    getUsers, saveUsers, getLessons, saveLessons, getComments, saveComments,
    getMessages, saveMessages, getSubmissionLogs
} = require('../database');
// Importação do middleware de autorização
const { requireAuth, requireAdmin } = require('./auth');
const { parseLessonContent } = require('../utils/parser');

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'content'));
    },
    filename: (req, file, cb) => {
        // Salva apenas o nome original sem espaços e em minúsculas
        const cleanName = file.originalname
            .toLowerCase()
            .replace(/\s+/g, '_'); // troca espaços por "_"
        cb(null, cleanName);
    }
});
const upload = multer({ storage });

// --- Rotas de Gerenciamento de Aulas ---

// Rota 1: Dashboard principal - Protegida por requireAdmin
router.get('/', requireAdmin, (req, res) => {
    const lessons = getLessons();
    res.render('admin/dashboard', {
        lessons,
        title: 'Painel Admin',
        user: req.user
    });
});

// Rota 2: Adiciona uma nova aula (com upload do .txt) - Protegida por requireAdmin
router.post('/lessons', requireAdmin, upload.single('content_file'), (req, res) => {
    const { title, description, module, release_date } = req.body;

    if (!title || !description || !module || !req.file) {
        return res.status(400).send('Preencha todos os campos obrigatórios e envie o arquivo de conteúdo.');
    }

    const lessons = getLessons();
    // Gera novo ID de forma segura
    const newId = lessons.length > 0 ? Math.max(...lessons.map(l => l.id)) + 1 : 101;

    const newLesson = {
        id: newId,
        title,
        description,
        module,
        // Armazena apenas o nome do arquivo sem a extensão
        content_file: path.parse(req.file.filename).name,
        release_date: release_date || null
    };

    lessons.push(newLesson);
    saveLessons(lessons);

    res.redirect('/admin');
});

// Rota 7: Visualizar conteúdo da aula - Protegida por requireAdmin
router.get('/lessons/:id', requireAdmin, (req, res) => {
    const lessonId = parseInt(req.params.id);
    const lessons = getLessons();
    const lesson = lessons.find(l => l.id === lessonId);

    if (!lesson) return res.status(404).send('Aula não encontrada.');

    try {
        const txtFilePath = path.join(__dirname, '..', 'content', `${lesson.content_file}.txt`);
        const rawContent = fs.readFileSync(txtFilePath, 'utf8');
        const formattedHtml = parseLessonContent(rawContent);

        res.render('admin/lesson_view', {
            lesson,
            content: formattedHtml,
            title: `Visualizar: ${lesson.title}`,
            user: req.user
        });

    } catch (err) {
        console.error(`Erro ao carregar o conteúdo da aula: ${err.message}`);
        res.status(500).send(`Erro ao carregar o conteúdo da aula: Arquivo content/${lesson.content_file}.txt não encontrado.`);
    }
});


// --- Rotas de Gerenciamento de Usuários ---

// Rota 3: Aprova um usuário - Protegida por requireAdmin
router.post('/users/:id/approve', requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex !== -1 && users[userIndex].approved === false) {
        users[userIndex].approved = true;
        saveUsers(users);
        return res.redirect('/admin/users');
    }

    res.status(404).send('Usuário não encontrado ou já aprovado.');
});

// Rota 4: Lista usuários - Protegida por requireAdmin
router.get('/users', requireAdmin, (req, res) => {
    const users = getUsers();
    // Filtra o próprio admin logado da lista
    const usersList = users.filter(u => u.id !== req.user.id);

    res.render('admin/users', {
        users: usersList,
        title: 'Gerenciar Usuários',
        user: req.user
    });
});


// --- Rotas de Gerenciamento de Feedback ---

// Rota 5: Lista feedbacks/comentários - Protegida por requireAdmin
router.get('/feedback', requireAdmin, (req, res) => {
    // Inverte para mostrar o mais recente primeiro, como na versão anterior
    const comments = getComments().reverse(); 
    res.render('admin/feedback', {
        comments,
        title: 'Gerenciar Feedback',
        user: req.user
    });
});

// Rota 6: Responder a um comentário - Protegida por requireAdmin
router.post('/feedback/reply/:id', requireAdmin, (req, res) => {
    // O ID é uma STRING (timestamp), mantido como string para comparação
    const commentId = req.params.id;
    const { adminResponse } = req.body;

    if (!adminResponse) {
        return res.status(400).send('A resposta do administrador é obrigatória.');
    }

    const comments = getComments();
    // Compara o ID como STRING.
    const commentIndex = comments.findIndex(c => c.id.toString() === commentId.toString());

    if (commentIndex !== -1) {
        comments[commentIndex].adminResponse = adminResponse;
        comments[commentIndex].status = 'replied';
        comments[commentIndex].adminTimestamp = new Date().toISOString();

        saveComments(comments);
        return res.redirect('/admin/feedback');
    }

    res.status(404).send('Comentário não encontrado.');
});

// --- Rotas de Gerenciamento de Mensagens ---

// Listar mensagens no painel admin (Já protegida)
router.get('/messages', requireAdmin, (req, res) => {
    const messages = getMessages();
    res.render('admin/messages', {
        messages,
        user: req.user,
        title: 'Gerenciar Mensagens'
    });
});

// Criar nova mensagem (Já protegida)
router.post('/messages', requireAdmin, (req, res) => {
    const messages = getMessages();
    const newMessage = {
        id: Date.now(),
        text: req.body.text,
        createdAt: new Date().toISOString()
    };
    messages.push(newMessage);
    saveMessages(messages);
    res.redirect('/admin/messages');
});

// Excluir mensagem (Já protegida)
router.post('/messages/:id/delete', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    let messages = getMessages();
    messages = messages.filter(m => m.id !== id);
    saveMessages(messages);
    res.redirect('/admin/messages');
});

// --- Rotas de Logs de Quiz ---

// Lista logs de submissão dos quizzes (Já protegida)
router.get('/quiz-submissions', requireAdmin, (req, res) => {
    try {
        const submissionLogs = getSubmissionLogs().reverse();
        const lessons = getLessons();

        const logsWithLessonInfo = submissionLogs.map(log => {
            const lesson = lessons.find(l => l.id.toString() === log.lessonId.toString());
            return {
                ...log,
                lessonTitle: lesson ? lesson.title : `Aula ID ${log.lessonId} (Não Encontrada)`
            };
        });

        res.render('admin/quiz_submissions', {
            logs: logsWithLessonInfo,
            title: 'Submissões de Quiz',
            user: req.user
        });
    } catch (error) {
        console.error("Erro ao carregar logs de quiz:", error);
        res.status(500).send("Erro ao carregar logs de submissão do quiz.");
    }
});

// Exporta o router
module.exports = { router };

