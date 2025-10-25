// ===========================================
// database.js (CÓDIGO COMPLETO DE MIGRAÇÃO PARA FIRESTORE E STORAGE)
// ===========================================

const db = require('./utils/firebase'); 
const admin = require('firebase-admin'); 
const fs = require('fs');
const path = require('path');

// 💡 NOVO: Inicializa o Firebase Storage Bucket
// Este bucket é configurado na inicialização do Admin SDK (em utils/firebase.js)
const bucket = admin.storage().bucket(); 


// --- Funções Auxiliares Comuns ---
const mapSnapshotToData = (snapshot) => {
    return snapshot.docs.map(doc => ({ 
        id: doc.id, // ID único do Firestore
        ...doc.data() 
    }));
};

// --- Funções de Usuários (Firestore - 'users' Collection) ---
// (Estas funções permanecem inalteradas)
const getUsers = async () => {
    const snapshot = await db.collection('users').get();
    return mapSnapshotToData(snapshot);
};

const addNewUser = async (userData) => {
    delete userData.id; 
    await db.collection('users').add(userData);
};

const approveUser = async (userFirestoreId) => {
    const docRef = db.collection('users').doc(userFirestoreId);
    await docRef.update({ approved: true });
};

const deleteUser = async (userFirestoreId, userId) => {
    await db.collection('users').doc(userFirestoreId).delete();
    // 💡 Assume que existe uma coleção 'progress' indexada pelo userId numérico
    if (userId) {
       await db.collection('progress').doc(userId.toString()).delete(); 
    }
};

// --- Funções de Lições (MIGRADO PARA FIRESTORE e STORAGE) ---

// 💡 Obtém metadados de aulas do Firestore
const getLessons = async () => {
    // Usa um campo 'id' sequencial interno para ordenação se o campo existir
    const snapshot = await db.collection('lessons').orderBy('id', 'asc').get(); 
    return mapSnapshotToData(snapshot);
};

// 💡 Salva/Atualiza metadados de uma única aula no Firestore
const saveNewLesson = async (lessonData) => {
    delete lessonData.id; 
    await db.collection('lessons').add(lessonData);
};

// 💡 Remove a aula do Firestore e o arquivo do Storage
const deleteLesson = async (lessonFirestoreId, fileName) => {
    // 1. Remove metadados do Firestore
    await db.collection('lessons').doc(lessonFirestoreId).delete();
    
    // 2. Remove o arquivo do Firebase Storage
    if (fileName) {
        try {
            // O caminho deve corresponder ao que é usado em uploadLessonContent
            await bucket.file(`lessons/${fileName}.txt`).delete();
            console.log(`Arquivo ${fileName}.txt removido do Storage.`);
        } catch (e) {
            // Ignora erro 404 (arquivo já não existe)
            if (e.code !== 404) {
                 console.error(`Erro ao deletar arquivo ${fileName} do Storage:`, e);
            }
        }
    }
};


// 💡 Salva o arquivo de conteúdo (Buffer) no Firebase Storage
const uploadLessonContent = (filename, contentBuffer) => {
    return new Promise((resolve, reject) => {
        // Define o caminho no Storage (Ex: lessons/intro_kimbundu.txt)
        const file = bucket.file(`lessons/${filename}`);
        const stream = file.createWriteStream({
            metadata: {
                contentType: 'text/plain',
                // Controla se o arquivo deve ser acessível publicamente (opcional, dependendo das regras de segurança)
                cacheControl: 'public, max-age=31536000' 
            },
        });

        stream.on('error', (err) => {
            reject(err);
        });

        stream.on('finish', () => {
            // Opcional: Torna o arquivo publicamente acessível (Regras do Storage devem permitir)
            file.makePublic()
                .then(() => resolve(filename)) 
                .catch(reject);
        });
        
        // Escreve o Buffer na stream de upload
        stream.end(contentBuffer);
    });
};

// 💡 Obtém o conteúdo da aula do Firebase Storage
const getLessonContent = async (lessonFile) => {
    // Adiciona o .txt (o nome do arquivo no Storage é lessons/nome.txt)
    const filePath = `lessons/${lessonFile}.txt`; 
    try {
        const [contentBuffer] = await bucket.file(filePath).download();
        return contentBuffer.toString('utf8');
    } catch (e) {
        if (e.code === 404) {
            return 'O conteúdo desta aula não foi encontrado no Firebase Storage.';
        }
        console.error(`Erro ao baixar ${lessonFile}.txt do Storage:`, e);
        // Lança erro para ser tratado no admin.js/lessons.js
        throw new Error("Falha ao carregar conteúdo da aula."); 
    }
};


// --- Funções de Comentários, Mensagens e Progresso (Firestore) ---
// (Estas funções permanecem inalteradas)

const getComments = async (lessonId = null) => {
    let query = db.collection('comments').orderBy('timestamp', 'desc');
    if (lessonId) {
        query = query.where('lessonId', '==', parseInt(lessonId));
    }
    const snapshot = await query.get();
    return mapSnapshotToData(snapshot);
};

const saveNewComment = async (commentData) => {
    commentData.timestamp = new Date().toISOString();
    await db.collection('comments').add(commentData);
};

const saveReplyToComment = async (commentFirestoreId, adminResponse, adminName) => {
    const docRef = db.collection('comments').doc(commentFirestoreId);
    await docRef.update({
        adminResponse: adminResponse,
        adminName: adminName,
        status: 'responded', 
        respondedAt: new Date().toISOString()
    });
    return true; 
};

const deleteComment = async (commentFirestoreId) => {
    await db.collection('comments').doc(commentFirestoreId).delete();
};

const deleteAllComments = async () => {
    const commentsRef = db.collection('comments');
    const snapshot = await commentsRef.get();
    const batch = db.batch();

    if (snapshot.empty) { return 0; }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size; 
};

const getMessages = async () => {
    const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').get();
    return mapSnapshotToData(snapshot);
};

const saveNewMessage = async (text) => {
    const messageData = {
        text: text,
        createdAt: new Date().toISOString()
    };
    await db.collection('messages').add(messageData);
};

const deleteMessage = async (messageFirestoreId) => {
    await db.collection('messages').doc(messageFirestoreId).delete();
};

const deleteAllMessages = async () => {
    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef.get();
    const batch = db.batch();

    if (snapshot.empty) { return 0; }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size; 
};

const getSubmissionLogs = async () => {
    const snapshot = await db.collection('quiz_submissions').orderBy('timestamp', 'desc').get();
    return mapSnapshotToData(snapshot);
};

// ... (Funções de progresso - omitidas para brevidade, mas devem existir)

// --- EXPORTAÇÕES GLOBAIS (FINAL) ---
module.exports = {
    // Usuários
    getUsers, addNewUser, approveUser, deleteUser,
    // Lições (MIGRADO!)
    getLessons, saveNewLesson, deleteLesson, 
    uploadLessonContent, getLessonContent,
    // Comentários/Feedback
    getComments, saveNewComment, saveReplyToComment, deleteComment, deleteAllComments,
    // Mensagens Globais
    getMessages, saveNewMessage, deleteMessage, deleteAllMessages,
    // Logs
    getSubmissionLogs
    // ... outras exportações
};

