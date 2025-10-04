// routes/comments.js (CÓDIGO COMPLETO E CORRIGIDO)

const express = require('express');
const router = express.Router();
// 💡 REMOVIDO: const fs = require('fs');
// 💡 REMOVIDO: const path = require('path');
// 💡 CORREÇÃO: Importa as funções de acesso a dados do novo módulo centralizado
const { getComments, saveComments } = require('../database'); 
// Importa o requireAuth do auth.js (Assumindo que você manteve o auth.js no mesmo nível)
const { requireAuth } = require('./auth'); 


// 💡 REMOVIDO: Funções auxiliares getComments e saveComments (Estão em database.js)


// Rota POST para enviar um novo comentário. Usa requireAuth para proteger a rota.
router.post('/submit', requireAuth, (req, res) => {
    const { lessonId, message } = req.body;
    
    // req.user é populado pelo middleware requireAuth
    if (!lessonId || !message || !req.user) {
        return res.status(400).send('Dados inválidos ou usuário não logado.');
    }

    const comments = getComments();
    const newId = comments.length > 0 ? Math.max(...comments.map(c => c.id)) + 1 : 1;

    const newComment = {
        id: newId,
        lessonId: parseInt(lessonId),
        userId: req.user.id, // ID do usuário logado
        username: req.user.username, // Nome do usuário logado
        message: message,
        timestamp: new Date().toISOString(),
        adminResponse: null, 
        status: 'pending' 
    };

    comments.push(newComment);
    saveComments(comments);

    // Redireciona de volta para a aula, pulando para a seção de comentários
    res.redirect(`/lessons/${lessonId}#comments`);
});


module.exports = { router };

