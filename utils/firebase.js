// ===========================================
// NOVO CÓDIGO PARA firebase.js
// ===========================================
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// VARIÁVEIS SEPARADAS ESPERADAS NO VERCEL
const projectID = process.env.FIREBASE_PROJECT_ID; 
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL; 
const privateKeyString = process.env.FIREBASE_PRIVATE_KEY; 
const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID; 

let serviceAccount;

// 1. Tenta Conectar via Variáveis de Ambiente Separadas (Produção/Vercel)
if (projectID && clientEmail && privateKeyString) {
    
    console.log("🔥 Firebase: Conectado via Variáveis de Ambiente Separadas (Produção).");
    
    // CORREÇÃO CRUCIAL: Substitui literais '\n' pela quebra de linha real.
    const correctedPrivateKey = privateKeyString.replace(/\\n/g, '\n'); 

    // Constrói o objeto de credenciais de serviço, usando os valores do seu JSON original
    serviceAccount = {
        type: "service_account",
        project_id: projectID,
        private_key: correctedPrivateKey,
        client_email: clientEmail,
        private_key_id: privateKeyId || 'daa8ca8cb8135001b991fdf74ab9b79efb592fcc', 
        client_id: process.env.FIREBASE_CLIENT_ID || '116165920126992947607',
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40kimbundu-site.iam.gserviceaccount.com',
        universe_domain: "googleapis.com"
    };

} 
// 2. Conecta via Arquivo Local (Desenvolvimento)
else {
    const keyFileName = 'firebase-key.json'; 
    const keyPath = path.resolve(__dirname, '..', keyFileName); 
    
    if (fs.existsSync(keyPath)) {
        console.log(`🔥 Firebase: Conectado lendo a chave localmente em ${keyFileName} (Desenvolvimento).`);
        try {
            serviceAccount = require(keyPath);
        } catch (e) {
            console.error("ERRO FATAL: Não foi possível carregar o arquivo firebase-key.json. Verifique a sintaxe JSON.", e);
            process.exit(1);
        }
    } else {
        console.error("ERRO FATAL: Chave de serviço não encontrada! Configure Variáveis de Ambiente OU salve o arquivo JSON na raiz do projeto como:", keyFileName);
        process.exit(1);
    }
}

// 3. Inicializa o Firebase
if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} else {
    console.error("ERRO FATAL: Falha na determinação das credenciais do Firebase.");
    process.exit(1);
}

const db = admin.firestore();

module.exports = db;

