// utils/parser.js (FINAL E CORRIGIDO - SUPORTE A TABELAS)

const getYouTubeId = (url) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
};

const getVimeoId = (url) => {
    const match = url.match(/(?:vimeo\.com\/(?:video\/|channels\/\w+\/|groups\/[^\/]+\/videos\/|album\/\d+\/video\/|embed\/|)\s*?)(\d+)/i);
    return match ? match[1] : null;
};

// Função para processar links e mídia (DEVE SER CHAMADA APENAS NO FINAL DO PARÁGRAFO)
const processMediaAndLinks = (p) => {
    return p.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        let correctedUrl = url.trim();
        let target = '';

        // --- Mídia Externa (YouTube/Vimeo) ---
        const youtubeId = getYouTubeId(correctedUrl);
        const vimeoId = getVimeoId(correctedUrl);

        const videoContainerStyle = 'margin:20px 0; position:relative; padding-bottom:56.25%; height:0; overflow:hidden; max-width:100%;';
        const iframeStyle = 'position:absolute; top:0; left:0; width:100%; height:100%; border:0;';

        if (youtubeId) {
            const embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
            return `<div class="media-container youtube-embed" style="${videoContainerStyle}"><iframe src="${embedUrl}" style="${iframeStyle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="${text}"></iframe></div>`;
        }
        if (vimeoId) {
            const embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
            return `<div class="media-container vimeo-embed" style="${videoContainerStyle}"><iframe src="${embedUrl}" style="${iframeStyle}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${text}"></iframe></div>`;
        }
        
        // --- Mídia Local e Links ---
        if (correctedUrl.startsWith('media/')) {
             correctedUrl = `/${correctedUrl}`;
        }

        const extensionMatch = correctedUrl.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
        const extension = extensionMatch ? extensionMatch[1].toLowerCase() : null;

        if (extension) {
            switch (extension) {
                case 'mp4':
                case 'webm':
                    return `<div class="media-container" style="margin:20px 0;"><video controls style="width:100%;max-height:500px;"><source src="${correctedUrl}" type="video/${extension}">Seu navegador não suporta vídeo.</video></div>`;
                case 'mp3':
                case 'wav':
                    return `<div class="media-container" style="margin:20px 0;"><audio controls src="${correctedUrl}">Seu navegador não suporta áudio.</audio></div>`;
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                    return `<div class="media-container" style="margin:20px 0;text-align:center;"><img src="${correctedUrl}" alt="${text}" style="max-width:100%;height:auto;border-radius:4px;"></div>`;
                case 'pdf':
                    return `<div class="media-container" style="margin:20px 0;"><h4 style="margin-bottom:8px;">${text}</h4><iframe src="${correctedUrl}" style="width:100%;height:400px;border:1px solid #ddd;">Seu navegador não suporta iframes.</iframe></div>`;
                default:
                    target = (correctedUrl.startsWith('http') || correctedUrl.startsWith('www')) ? ' target="_blank"' : '';
                    return `<a href="${correctedUrl}"${target}>${text}</a>`;
            }
        }

        // Link padrão
        if (correctedUrl.startsWith('http') || correctedUrl.startsWith('www')) {
            target = ' target="_blank"';
        }
        return `<a href="${correctedUrl}"${target}>${text}</a>`;
    });
};


const parseLessonContent = (rawContent) => {
    if (!rawContent) return '';

    let htmlContent = rawContent;

    // --- 0. PRÉ-PROCESSAMENTO: Trata Tabelas e Listas Multi-linha (Complexo) ---
    // Faz a substituição em uma única string antes de dividir em parágrafos.
    
    // Processamento de Tabelas: Procura por 3 ou mais linhas começando e terminando com |
    htmlContent = htmlContent.replace(/^(\|.*\|\r?\n\|[-:\s]+\||\|.*\|\r?\n\|[-:\s]+\|[\s\S]*?\r?\n\|.*\|)/gm, (tableMatch) => {
        
        // Divide as linhas da tabela
        const lines = tableMatch.trim().split(/\r?\n/).filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
        
        // Se houver menos de 2 linhas, ou se a linha 2 não for o separador, ignora
        if (lines.length < 2 || !/^\|[-:\s]+\|/i.test(lines[1])) {
            return tableMatch; // Retorna o texto original
        }

        // Linha do cabeçalho
        const headerCells = lines[0].split('|').map(c => c.trim()).filter(c => c.length > 0);
        let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 1.5em 0;"><thead><tr style="background-color: #f1f1f1; border-bottom: 2px solid #ddd;">`;
        headerCells.forEach(cell => {
            tableHtml += `<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">${cell}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        // Linhas de dados (começa na linha 3)
        for (let i = 2; i < lines.length; i++) {
            const rowCells = lines[i].split('|').map(c => c.trim()).filter(c => c.length > 0);
            if (rowCells.length === 0) continue; 
            
            tableHtml += `<tr style="border-bottom: 1px solid #eee;">`;
            rowCells.forEach(cell => {
                tableHtml += `<td style="padding: 10px; border: 1px solid #ddd;">${cell}</td>`;
            });
            tableHtml += `</tr>`;
        }
        
        tableHtml += `</tbody></table>`;
        return tableHtml;
    });

    // Processamento de Listas (Ordenadas e Não Ordenadas)
    // Procura por sequências de linhas que parecem listas
    htmlContent = htmlContent.replace(/((?:^[\*\-\+]\s.*(?:\r?\n|$))+)/gm, (listMatch) => {
        // Lista não ordenada
        const listItems = listMatch.trim().split(/\r?\n/).map(item => {
            const m = item.match(/^[\*\-\+]\s+(.*)/);
            return m ? `<li>${m[1].trim()}</li>` : '';
        }).join('');
        return `<ul style="margin-bottom: 1.2em; padding-left: 20px;">${listItems}</ul>`;
    });

    htmlContent = htmlContent.replace(/((?:^\d+\.\s.*(?:\r?\n|$))+)/gm, (listMatch) => {
        // Lista ordenada
        const listItems = listMatch.trim().split(/\r?\n/).map(item => {
            const m = item.match(/^\d+\.\s+(.*)/);
            return m ? `<li>${m[1].trim()}</li>` : '';
        }).join('');
        return `<ol style="margin-bottom: 1.2em; padding-left: 20px;">${listItems}</ol>`;
    });


    // 1. Divide em blocos por linhas em branco
    // Agora o conteúdo já tem listas e tabelas processadas como HTML.
    htmlContent = htmlContent.split(/\r?\n\s*\r?\n/).map(block => {
        let p = block.trim();
        if (!p) return '';

        // Se o bloco já for HTML (tabela ou lista), retorna sem <p>
        if (p.startsWith('<table') || p.startsWith('<ul') || p.startsWith('<ol')) {
            return p;
        }

        // --- PROCESSAMENTO DE BLOCOS RESTANTES ---

        // A. Linha horizontal
        if (p === '---' || p === '***') {
            return `<hr style="border: 0; border-top: 1px solid #ccc; margin: 2em 0;">`;
        }

        // B. Títulos
        if (p.startsWith('### ')) return `<h4 style="margin-top: 1.2em; margin-bottom: 0.6em;">${p.substring(4).trim()}</h4>`;
        if (p.startsWith('## ')) return `<h3 style="margin-top: 1.5em; margin-bottom: 0.8em;">${p.substring(3).trim()}</h3>`;
        if (p.startsWith('# ')) return `<h2 style="margin-top: 2em; margin-bottom: 1em;">${p.substring(2).trim()}</h2>`;

        // C. Bloco de código multilinha ``` ```
        if (p.startsWith('```') && p.endsWith('```')) {
            const code = p.substring(3, p.length - 3).trim();
            const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre style="white-space: pre-wrap; padding: 10px; background-color: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; overflow-x: auto; margin-bottom: 1.2em;"><code>${escaped}</code></pre>`;
        }
        
        // D. Blocos de Alerta/Destaque [TYPE]
        const alertMatch = p.match(/^\[(NOTE|TIP|WARNING|INFO)\]\s*(.*)/i);
        if (alertMatch) {
            const type = alertMatch[1].toUpperCase();
            const content = alertMatch[2].trim();
            
            let backgroundColor, borderColor, icon, title;
            switch (type) {
                case 'NOTE': [backgroundColor, borderColor, icon, title] = ['#e3f2fd', '#90caf9', '💡', 'Nota']; break;
                case 'TIP': [backgroundColor, borderColor, icon, title] = ['#e8f5e9', '#a5d6a7', '✅', 'Dica']; break;
                case 'WARNING': [backgroundColor, borderColor, icon, title] = ['#fff3e0', '#ffcc80', '⚠️', 'Atenção']; break;
                case 'INFO': default: [backgroundColor, borderColor, icon, title] = ['#f3e5f5', '#ce93d8', 'ℹ️', 'Informação'];
            }
            const style = `padding: 15px; margin-bottom: 1.2em; border-left: 5px solid ${borderColor}; background-color: ${backgroundColor}; border-radius: 4px;`;
            const headerStyle = `font-weight: bold; margin-bottom: 5px; color: ${borderColor};`;

            return `<div style="${style}"><div style="${headerStyle}">${icon} ${title}</div><div>${content}</div></div>`;
        }

        // --- PROCESSAMENTO INLINE ---

        // E. Formatação Inline Básica
        p = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); 
        p = p.replace(/__(.+?)__/g, '<u>$1</u>');               
        p = p.replace(/\*(.+?)\*/g, '<em>$1</em>');             
        
        // F. Code Inline
        p = p.replace(/`(.+?)`/g, (m, c) => `<code>${c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>`);

        // G. Cores e Destaque Inline {{cor|texto}}
        p = p.replace(/\{\{(.+?)\|(.+?)\}\}/g, (match, color, text) => {
            const colorMap = {
                red: '#D32F2F', green: '#388E3C', blue: '#1976D2', yellow: '#FBC02D', highlight: 'yellow', 
            };
            
            let style = '';
            const mappedColor = colorMap[color.toLowerCase()];

            if (mappedColor) {
                if (color.toLowerCase() === 'highlight') {
                    style = `background-color: ${mappedColor}; padding: 2px 4px; border-radius: 3px;`;
                } else {
                    style = `color: ${mappedColor}; font-weight: bold;`;
                }
            } else {
                return text; 
            }
            
            return `<span style="${style}">${text}</span>`;
        });
        
        // H. Links e mídia
        p = processMediaAndLinks(p);

        // I. Parágrafo Padrão
        return `<p style="margin-bottom: 1.2em;">${p}</p>`;
    }).join('\n');

    return htmlContent;
};

module.exports = { parseLessonContent };

