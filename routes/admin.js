// ===========================================
// routes/admin.js (CÓDIGO COMPLETO E CORRIGIDO PARA VERSEL/FIREBASE)
// ===========================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 💡 Importa as novas funções assíncronas
const {
    getUsers, approveUser, deleteUser, 
    getLessons, saveNewLesson, deleteLesson, uploadLessonContent, getLessonContent, 
    getComments, saveReplyToComment, deleteComment, deleteAllComments, 
    getMessages, deleteMessage, deleteAllMessages,
    getSubmissionLogs
} = require('../database');

const { requireAdmin } = require('./auth');
const { parseLessonContent } = require('../utils/parser');


// 💡 MUDANÇA CRÍTICA: Configuração do Multer para MEMORY STORAGE (Obrigatório no Vercel)
// O arquivo é armazenado em um Buffer na RAM, e o Node envia para o Firebase Storage
const storage = multer.memoryStorage();

// Configuração de Multer (limites e filtro)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Limite de 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            // Retorna um erro que será pego no uploadMiddleware
            cb(new Error('O arquivo deve ser do tipo .txt.'), false);
        }
    }
});

// Middleware que encapsula e trata os erros de upload
const uploadMiddleware = (req, res, next) => {
    // Usa .single('content_file')
    upload.single('content_file')(req, res, (err) => {
        if (err) {
            console.error("Erro no Upload Multer:", err.message);
            const errorMessage = err.message || "Erro desconhecido no upload do arquivo.";
            return res.redirect(`/admin?error=${encodeURIComponent(errorMessage)}`);
        }
        next();
    });
};


// Aplica o middleware requireAdmin a todas as rotas do painel
router.use(requireAdmin);

// --- Rotas de Gerenciamento de Aulas (ASYNC/AWAIT) ---

// Rota 1: Dashboard principal - AGORA ASYNC
router.get('/', async (req, res) => {
    try {
        const lessons = await getLessons(); // 💡 AGORA É ASSÍNCRONA (Firestore)
        res.render('admin/dashboard', {
            lessons,
            title: 'Painel Admin',
            user: req.user,
            successMessage: req.query.success || null,
            errorMessage: req.query.error || null
        });
    } catch (e) {
        console.error("Erro ao carregar lista de aulas do Firestore:", e);
        // Exibe um erro genérico em caso de falha de conexão/permissão do Firebase
        res.redirect(`/admin?error=${encodeURIComponent("Erro ao carregar aulas. Verifique a conexão com o Firebase.")}`);
    }
});

// Rota 2: Adiciona uma nova aula (com upload para Storage) - AGORA ASYNC
router.post('/lessons', uploadMiddleware, async (req, res) => {
    // Verifica se o Multer processou o arquivo
    if (!req.file || !req.file.buffer) {
        return res.redirect(`/admin?error=${encodeURIComponent("Erro: Arquivo não foi processado ou está vazio.")}`);
    }

    try {
        // 1. Gera nome limpo e remove a extensão
        const rawFileName = req.file.originalname;
        const cleanFileName = rawFileName
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/\.txt$/, ''); 

        // O conteúdo é o Buffer de memória do Multer
        const contentBuffer = req.file.buffer;
        
        // 2. Upload para o Firebase Storage
        const uploadedFileName = await uploadLessonContent(`${cleanFileName}.txt`, contentBuffer);
        
        // 3. Obtém o ID sequencial correto para a nova aula
        const currentLessons = await getLessons();
        const newId = currentLessons.length > 0 ? Math.max(...currentLessons.map(l => l.id || 0)) + 1 : 1; 

        // 4. Salva metadados no Firestore
        const newLesson = {
            id: newId, // ID sequencial para o frontend/progresso
            title: req.body.title,
            description: req.body.description || '',
            module: req.body.module || 'Módulo 1',
            release_date: req.body.release_date || new Date().toISOString().split('T')[0],
            content_file: cleanFileName, // Nome do arquivo no Storage (sem .txt)
            quiz: req.body.quiz === 'on' 
        };

        if (newLesson.quiz) {
            // Lógica de quiz (adaptar se for mais complexa)
            newLesson.questions = {
                q1: {
                    text: req.body.q1_text,
                    options: [req.body.q1_optA, req.body.q1_optB, req.body.q1_optC],
                    answer: parseInt(req.body.q1_answer)
                }
            };
        }

        await saveNewLesson(newLesson); // 💡 Salva no Firestore

        res.redirect('/admin?success=Aula%20adicionada%20e%20arquivo%20enviado%20para%20o%20Firebase%20Storage%20com%20sucesso.');

    } catch (e) {
        console.error("Erro fatal ao processar nova aula:", e);
        res.redirect(`/admin?error=${encodeURIComponent("Falha ao salvar a aula. Verifique as permissões de Escrita do Firebase Storage e Firestore.")}`);
    }
});

// Rota 3: Excluir uma aula (Exclui do Firestore e Storage) - AGORA ASYNC
router.post('/lessons/:id/delete', async (req, res) => {
    // Os dados chegam via body (campos hidden do EJS)
    const lessonFirestoreId = req.body.firestoreId; 
    const fileName = req.body.fileName;
    
    try {
        if (lessonFirestoreId && fileName) {
            await deleteLesson(lessonFirestoreId, fileName); // 💡 Exclui do Firestore e Storage
            res.redirect('/admin?success=Aula%20eliminada%20com%20sucesso.');
        } else {
            res.redirect(`/admin?error=${encodeURIComponent("Erro: ID do Firestore ou nome do arquivo ausente na requisição.")}`);
        }
    } catch (e) {
        console.error("Erro ao excluir aula:", e);
        res.redirect(`/admin?error=${encodeURIComponent("Erro ao excluir a aula. Verifique as permissões de Storage/Firestore.")}`);
    }
});


// Rota 4: Visualização de Conteúdo (para Admin) - AGORA ASYNC
router.get('/lessons/:id', async (req, res) => {
    try {
        const lessonFirestoreId = req.params.id;
        const lessons = await getLessons(); // 💡 AGORA É ASSÍNCRONA
        
        // Busca a lição usando o ID do Firestore (que é o campo 'id' no objeto retornado)
        const lesson = lessons.find(l => l.id.toString() === lessonFirestoreId.toString());
        
        if (!lesson) {
            return res.status(404).send('Aula não encontrada.');
        }

        const rawContent = await getLessonContent(lesson.content_file); // 💡 AGORA É ASSÍNCRONA (Storage)
        const lessonHtml = parseLessonContent(rawContent);

        res.render('admin/lesson_content', {
            lesson,
            content: lessonHtml,
            title: `Conteúdo: ${lesson.title}`,
            user: req.user
        });
    } catch (e) {
        console.error("Erro ao carregar conteúdo da aula para admin:", e);
        res.status(500).send("Erro interno ao carregar o conteúdo da aula. (Verifique o Storage)");
    }
});

// --- Rotas de Gerenciamento de Usuários (Mantidas, assumindo já estão ASYNC) ---

router.get('/users', async (req, res) => {
    try {
        const users = await getUsers();
        // Filtra para mostrar apenas estudantes não aprovados e, se quiser, todos os outros
        const usersToApprove = users.filter(u => u.role === 'student' && !u.approved);
        const approvedUsers = users.filter(u => u.approved || u.role !== 'student');
        
        res.render('admin/users', {
            usersToApprove,
            approvedUsers,
            title: 'Gerenciar Usuários',
            user: req.user,
            successMessage: req.query.success || null,
            errorMessage: req.query.error || null
        });
    } catch (e) {
        res.status(500).send("Erro interno ao carregar usuários.");
    }
});

router.post('/users/:id/approve', async (req, res) => {
    try {
        await approveUser(req.params.id);
        res.redirect('/admin/users?success=Usuário%20aprovado%20com%20sucesso.');
    } catch (e) {
        res.status(500).send("Erro ao aprovar usuário.");
    }
});

router.post('/users/:id/delete', async (req, res) => {
    try {
        // Assume que o body contém o userId numérico (se usado em 'progress')
        const userId = req.body.userId; 
        await deleteUser(req.params.id, userId); 
        res.redirect('/admin/users?success=Usuário%20eliminado%20com%20sucesso.');
    } catch (e) {
        res.status(500).send("Erro ao eliminar usuário.");
    }
});

// --- Rotas de Feedback (Comentários) ---

router.get('/feedback', async (req, res) => {
    try {
        const comments = await getComments(); 
        const pendingComments = comments.filter(c => c.status !== 'responded');
        const lessons = await getLessons(); 
        
        const pendingWithLessonInfo = pendingComments.map(c => {
            const lesson = lessons.find(l => l.id.toString() === c.lessonId.toString());
            return {
                ...c,
                lessonTitle: lesson ? lesson.title : `Aula ID ${c.lessonId} (Não Encontrada)`
            };
        });

        res.render('admin/feedback', {
            pendingComments: pendingWithLessonInfo,
            lessons,
            title: 'Gerenciar Feedback',
            user: req.user,
            successMessage: req.query.success || null,
            errorMessage: req.query.error || null
        });
    } catch (e) {
        res.status(500).send("Erro interno ao carregar feedback.");
    }
});

router.post('/feedback/:id/reply', async (req, res) => {
    try {
        const { admin_response } = req.body;
        const adminName = req.user.username; 
        await saveReplyToComment(req.params.id, admin_response, adminName);
        res.redirect('/admin/feedback?success=Resposta%20salva%20com%20sucesso.');
    } catch (e) {
        res.status(500).send("Erro ao salvar resposta.");
    }
});

router.post('/feedback/:id/delete', async (req, res) => {
    try {
        await deleteComment(req.params.id);
        res.redirect('/admin/feedback?success=Comentário%20eliminado%20com%20sucesso.');
    } catch (e) {
        res.status(500).send("Erro ao eliminar comentário.");
    }
});

router.post('/feedback/delete-all', async (req, res) => {
    try {
        const count = await deleteAllComments();
        const message = `Todos os ${count} comentários foram eliminados com sucesso.`;
        res.redirect(`/admin/feedback?success=${encodeURIComponent(message)}`);
    } catch (error) {
        res.status(500).send("Erro ao excluir todos os comentários.");
    }
});

// --- Rotas de Mensagens Globais ---

router.get('/messages', async (req, res) => {
    try {
        const messages = await getMessages(); 
        res.render('admin/messages', {
            messages,
            title: 'Gerenciar Mensagens Globais',
            user: req.user,
            successMessage: req.query.success || null,
            errorMessage: req.query.error || null
        });
    } catch (e) {
        res.status(500).send("Erro interno ao carregar mensagens.");
    }
});

router.post('/messages/:id/delete', async (req, res) => {
    try {
        await deleteMessage(req.params.id);
        res.redirect('/admin/messages?success=Mensagem%20eliminada%20com%20sucesso.');
    } catch (error) {
        res.status(500).send("Erro ao excluir mensagem.");
    }
});

router.post('/messages/delete-all', async (req, res) => {
    try {
        const count = await deleteAllMessages();
        const message = `Todas as ${count} mensagens globais foram eliminadas com sucesso.`;
        res.redirect(`/admin/messages?success=${encodeURIComponent(message)}`);
    } catch (error) {
        res.status(500).send("Erro ao excluir todas as mensagens.");
    }
});


// --- Rotas de Logs de Quiz ---

router.get('/quiz-submissions', async (req, res) => { 
    try {
        const submissionLogs = await getSubmissionLogs(); 
        const lessons = await getLessons(); 

        const logsWithLessonInfo = submissionLogs.map(log => {
            // Assume que lessonId é o 'id' sequencial interno da aula
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
        res.status(500).send("Erro ao carregar logs de quiz.");
    }
});


// 🚨 EXPORTAÇÃO FINAL
module.exports = { router };

