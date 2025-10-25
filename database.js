// ===========================================
// database.js (CÓDIGO COMPLETO E FINAL)
// ===========================================

// Importa o objeto 'db' do Firestore que inicializamos
const db = require('./utils/firebase'); 
const admin = require('firebase-admin'); // Necessário para FieldValue
const fs = require('fs');
const path = require('path');

// --- Caminhos e Arquivos Locais (Preservados) ---

const contentPath = path.join(__dirname, 'content');
const lessonsPath = path.join(__dirname, 'lessons.json');

// --- Funções Auxiliares Comuns ---

const mapSnapshotToData = (snapshot) => {
    return snapshot.docs.map(doc => ({ 
        id: doc.id, // ID do Firestore
        ...doc.data() 
    }));
};

// --- Funções Específicas para Usuários ('users' Collection) ---

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
    await docRef.update({
        approved: true
    });
};

const updateUser = async (userFirestoreId, data) => {
    const docRef = db.collection('users').doc(userFirestoreId);
    await docRef.update(data);
};

const deleteUser = async (userFirestoreId) => {
    // Apagar o usuário
    await db.collection('users').doc(userFirestoreId).delete();
    // Apagar o progresso do usuário (coleção 'progress' onde o ID é o userFirestoreId)
    await db.collection('progress').doc(userFirestoreId).delete();
};


// --- Funções Síncronas para Lições (JSON local) ---

// Síncrona: Lê o lessons.json
const getLessons = () => {
    if (fs.existsSync(lessonsPath)) {
        const data = fs.readFileSync(lessonsPath, 'utf8');
        return JSON.parse(data);
    }
    return [];
};

// Síncrona: Escreve no lessons.json
const saveLessons = (lessons) => {
    fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2), 'utf8');
};

// Síncrona: Lê o conteúdo .txt
const getLessonContent = (lessonFile) => {
    const filePath = path.join(contentPath, `${lessonFile}.txt`);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    return 'Conteúdo da aula não encontrado.';
};


// --- Funções de Progresso ('progress' Collection) ---

const getUserProgress = async (userFirestoreId) => {
    const doc = await db.collection('progress').doc(userFirestoreId).get();
    return doc.exists ? doc.data() : { completedLessons: [] };
};

const markLessonComplete = async (userFirestoreId, lessonId) => {
    const docRef = db.collection('progress').doc(userFirestoreId);
    await docRef.set({
        completedLessons: admin.firestore.FieldValue.arrayUnion(lessonId)
    }, { merge: true });
};


// --- Funções de Comentários/Feedback ('comments' Collection) ---

const getComments = async () => {
    const snapshot = await db.collection('comments').orderBy('createdAt', 'desc').get();
    return mapSnapshotToData(snapshot);
};

const saveNewComment = async (commentData) => {
    await db.collection('comments').add({
        ...commentData,
        createdAt: new Date().toISOString(),
        status: 'pending' // Novo comentário é sempre 'pending'
    });
};

const saveReplyToComment = async (commentFirestoreId, adminResponse, adminUsername) => {
    const docRef = db.collection('comments').doc(commentFirestoreId);
    await docRef.update({
        adminResponse: adminResponse,
        respondedAt: new Date().toISOString(),
        respondedBy: adminUsername,
        status: 'responded'
    });
};

// 💡 NOVA FUNÇÃO: Apagar um único Comentário/Feedback
const deleteComment = async (commentFirestoreId) => {
    await db.collection('comments').doc(commentFirestoreId).delete();
};

// 💡 NOVA FUNÇÃO: Apagar todos os Comentários/Feedback
const deleteAllComments = async () => {
    const commentsRef = db.collection('comments');
    const snapshot = await commentsRef.get();
    const batch = db.batch();

    if (snapshot.empty) {
        return 0;
    }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
};


// --- Funções de Mensagens Globais ('messages' Collection) ---

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

// 💡 NOVA FUNÇÃO: Apagar todas as Mensagens Globais
const deleteAllMessages = async () => {
    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef.get();
    const batch = db.batch();

    if (snapshot.empty) {
        return 0;
    }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size; 
};


// --- Funções de Logs de Quiz ---

const getSubmissionLogs = async () => {
    const snapshot = await db.collection('quiz_submissions').orderBy('timestamp', 'desc').get();
    return mapSnapshotToData(snapshot);
};

const logQuizSubmission = async (userId, username, lessonId, score, totalQuestions, passed) => {
    const submissionData = {
        userId: userId,
        username: username,
        lessonId: parseInt(lessonId),
        score: score,
        totalQuestions: totalQuestions,
        passed: passed,
        timestamp: new Date().toISOString()
    };
    await db.collection('quiz_submissions').add(submissionData);
};

// --- EXPORTAÇÕES GLOBAIS (FINAL) ---
module.exports = {
    // Usuários
    getUsers, addNewUser, approveUser, 
    updateUser, deleteUser, 
    // Lições
    getLessons, saveLessons, getLessonContent,
    // Comentários/Feedback
    getComments, saveNewComment, saveReplyToComment,
    deleteComment, deleteAllComments, // 💡 NOVAS EXPORTAÇÕES
    // Mensagens Globais
    getMessages, saveNewMessage, deleteMessage,
    deleteAllMessages, // 💡 NOVA EXPORTAÇÃO
    // Progresso
    getUserProgress, markLessonComplete, getSubmissionLogs, logQuizSubmission 
};

