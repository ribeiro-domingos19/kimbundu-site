// ===========================================
// routes/admin.js (CÓDIGO COMPLETO E FINAL)
// ===========================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 💡 MUDANÇA: Importa TODAS as funções ASSÍNCRONAS do Firebase
const {
    getUsers, approveUser, deleteUser, updateUser, 
    getLessons, saveLessons, getLessonContent, 
    getComments, saveReplyToComment, deleteComment, deleteAllComments, // FUNÇÕES DE COMENTÁRIOS
    getMessages, saveNewMessage, deleteMessage, deleteAllMessages, // FUNÇÕES DE MENSAGENS
    getSubmissionLogs
} = require('../database');

const { requireAdmin } = require('./auth');
const { parseLessonContent } = require('../utils/parser');

// Configuração do Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Assegura que o diretório 'content' existe, se não, o upload falha
        const contentDir = path.join(__dirname, '..', 'content');
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir);
        }
        cb(null, contentDir);
    },
    filename: (req, file, cb) => {
        const cleanName = file.originalname
            .toLowerCase()
            .replace(/\s+/g, '_');
        cb(null, cleanName);
    }
});
const upload = multer({ storage });


// Aplica o middleware requireAdmin a todas as rotas do painel
router.use(requireAdmin);

// --- Rotas de Gerenciamento de Aulas ---

// Rota 1: Dashboard principal
router.get('/', (req, res) => {
    // getLessons é síncrona (lê lessons.json)
    const lessons = getLessons(); 
    res.render('admin/dashboard', {
        lessons,
        title: 'Painel Admin',
        user: req.user,
        successMessage: req.query.success
    });
});

// Rota 2: Adiciona uma nova aula (com upload do .txt)
// O Multer deve ser invocado como um middleware antes da função da rota
router.post('/lessons', upload.single('content_file'), (req, res) => {
    try {
        // 💡 VERIFICAÇÃO FINAL E CRÍTICA PARA O ERRO DA AULA:
        if (!req.file || req.file.mimetype !== 'text/plain') {
            const errorMessage = req.file ? "O arquivo deve ser do tipo .txt." : "O arquivo de conteúdo (.txt) da aula é obrigatório.";
            // Adiciona um redirecionamento de erro para mostrar no dashboard
            return res.redirect(`/admin?error=${encodeURIComponent(errorMessage)}`);
        }

        const lessons = getLessons();
        const newId = lessons.length > 0 ? Math.max(...lessons.map(l => l.id)) + 1 : 1; 

        const newLesson = {
            id: newId,
            title: req.body.title,
            content_file: req.file.filename.replace('.txt', ''),
            quiz: req.body.quiz === 'on' 
        };

        if (newLesson.quiz) {
            // Lógica de quiz
            newLesson.questions = {
                q1: {
                    text: req.body.q1_text,
                    options: [req.body.q1_optA, req.body.q1_optB, req.body.q1_optC],
                    answer: parseInt(req.body.q1_answer)
                }
            };
        }

        lessons.push(newLesson);
        saveLessons(lessons); // Síncrona
        res.redirect('/admin?success=Aula%20adicionada%20com%20sucesso.');

    } catch (e) {
        console.error("Erro ao adicionar nova aula:", e);
        res.redirect(`/admin?error=${encodeURIComponent("Erro interno ao tentar adicionar a aula. Verifique as permissões de escrita.")}`);
    }
});

// Rota 3: Excluir uma aula (Exclui do JSON e o arquivo .txt)
router.post('/lessons/:id/delete', (req, res) => {
    const id = parseInt(req.params.id);
    let lessons = getLessons();
    const lessonToDelete = lessons.find(l => l.id === id);

    if (lessonToDelete) {
        // 1. Excluir o arquivo de conteúdo
        const filePath = path.join(__dirname, '..', 'content', `${lessonToDelete.content_file}.txt`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        // 2. Excluir a entrada do JSON
        lessons = lessons.filter(l => l.id !== id);
        saveLessons(lessons); // Síncrona
    }
    res.redirect('/admin?success=Aula%20eliminada%20com%20sucesso.');
});

// ... (Rotas de users, lesson content, quiz submissions - Mantidas) ...

// --- Rotas de Gerenciamento de Feedback/Comentários ---

// ROTA NOVA: Excluir um único Comentário/Feedback
router.post('/feedback/:id/delete', async (req, res) => {
    const commentFirestoreId = req.params.id;
    
    try {
        await deleteComment(commentFirestoreId);
        res.redirect('/admin/feedback?success=Feedback%20excluído%20com%20sucesso.');
    } catch (error) {
        console.error("Erro ao excluir feedback:", error);
        res.status(500).send("Erro interno ao excluir feedback.");
    }
});

// ROTA NOVA: Excluir TODOS os Comentários/Feedback
router.post('/feedback/delete-all', async (req, res) => {
    try {
        const count = await deleteAllComments();
        const message = `Todos os ${count} itens de feedback/comentários foram eliminados com sucesso.`;
        res.redirect(`/admin/feedback?success=${encodeURIComponent(message)}`);
    } catch (error) {
        console.error("Erro ao excluir todo o feedback:", error);
        res.status(500).send("Erro interno ao excluir todo o feedback.");
    }
});


// --- Rotas de Mensagens Globais ---

// Excluir mensagem individual
router.post('/messages/:id/delete', async (req, res) => {
    const messageFirestoreId = req.params.id;
    
    try {
        await deleteMessage(messageFirestoreId); 
        res.redirect('/admin/messages?success=Mensagem%20excluída%20com%20sucesso.');
    } catch (error) {
        console.error("Erro ao excluir mensagem:", error);
        res.status(500).send("Erro interno ao excluir mensagem.");
    }
});

// ROTA NOVA: Excluir TODAS as mensagens globais
router.post('/messages/delete-all', async (req, res) => {
    try {
        const count = await deleteAllMessages();
        const message = `Todas as ${count} mensagens globais foram eliminadas com sucesso.`;
        res.redirect(`/admin/messages?success=${encodeURIComponent(message)}`);
    } catch (error) {
        console.error("Erro ao excluir todas as mensagens:", error);
        res.status(500).send("Erro interno ao excluir todas as mensagens.");
    }
});

// ... (Outras rotas do admin.js) ...

module.exports = { router };

