// utils/parser.js (COMPLETO: suporte a listas, inline robusto, mídia local, YouTube e Vimeo com estilos)

const getYouTubeId = (url) => {
    // Regex para extrair ID de URLs padrão, de compartilhamento, incorporadas e 'shorts'
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
};

const getVimeoId = (url) => {
    // Regex para extrair ID de URLs padrão ou incorporadas
    const match = url.match(/(?:vimeo\.com\/(?:video\/|channels\/\w+\/|groups\/[^\/]+\/videos\/|album\/\d+\/video\/|embed\/|)\s*?)(\d+)/i);
    return match ? match[1] : null;
};

const parseLessonContent = (rawContent) => {
    if (!rawContent) return '';

    let htmlContent = rawContent;

    // Processa links e mídia dentro de um parágrafo
    const processMediaAndLinks = (p) => {
        return p.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
            let correctedUrl = url.trim();
            let target = '';

            // --- NOVO: Lógica para YouTube/Vimeo ---
            const youtubeId = getYouTubeId(correctedUrl);
            const vimeoId = getVimeoId(correctedUrl);

            // Estilos para contêiner de vídeo responsivo (proporção 16:9)
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
            // --- FIM NOVO ---
            
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
                        // Mantido h4 com margin-bottom:8px, pois já está dentro de um container com margem externa
                        return `<div class="media-container" style="margin:20px 0;"><h4 style="margin-bottom:8px;">${text}</h4><iframe src="${correctedUrl}" style="width:100%;height:400px;border:1px solid #ddd;">Seu navegador não suporta iframes.</iframe></div>`;
                    default:
                        target = (correctedUrl.startsWith('http') || correctedUrl.startsWith('www')) ? ' target="_blank"' : '';
                        return `<a href="${correctedUrl}"${target}>${text}</a>`;
                }
            }

            if (correctedUrl.startsWith('http') || correctedUrl.startsWith('www')) {
                target = ' target="_blank"';
            }
            return `<a href="${correctedUrl}"${target}>${text}</a>`;
        });
    };

    // Divide em blocos por linhas em branco
    htmlContent = htmlContent.split(/\r?\n\s*\r?\n/).map(block => {
        let p = block.trim();
        if (!p) return '';

        // Títulos - COM MELHORIAS DE ESTILO
        if (p.startsWith('### ')) return `<h4 style="margin-top: 1.2em; margin-bottom: 0.6em;">${p.substring(4).trim()}</h4>`;
        if (p.startsWith('## ')) return `<h3 style="margin-top: 1.5em; margin-bottom: 0.8em;">${p.substring(3).trim()}</h3>`;
        if (p.startsWith('# ')) return `<h2 style="margin-top: 2em; margin-bottom: 1em;">${p.substring(2).trim()}</h2>`;

        // Lista não ordenada: aceita -, *, +
        if (/^(\*|\-|\+)\s+/.test(p)) {
            const listItems = p.split(/\r?\n/).map(item => {
                const m = item.match(/^(\*|\-|\+)\s+(.*)/);
                return m ? `<li>${m[2].trim()}</li>` : '';
            }).join('');
            // COM MELHORIAS DE ESTILO
            return `<ul style="margin-bottom: 1.2em; padding-left: 20px;">${listItems}</ul>`;
        }

        // Lista ordenada (1. 2. ...)
        if (/^\d+\.\s+/.test(p)) {
            const listItems = p.split(/\r?\n/).map(item => {
                const m = item.match(/^\d+\.\s+(.*)/);
                return m ? `<li>${m[1].trim()}</li>` : '';
            }).join('');
            // COM MELHORIAS DE ESTILO
            return `<ol style="margin-bottom: 1.2em; padding-left: 20px;">${listItems}</ol>`;
        }

        // Bloco de código multilinha ``` ```
        if (p.startsWith('```') && p.endsWith('```')) {
            const code = p.substring(3, p.length - 3).trim();
            // escape mínimo para código
            const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            // COM MELHORIAS DE ESTILO
            return `<pre style="white-space: pre-wrap; padding: 10px; background-color: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; overflow-x: auto; margin-bottom: 1.2em;"><code>${escaped}</code></pre>`;
        }

        // Inline: Negrito, itálico, sublinhado
        p = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // **negrito**
        p = p.replace(/__(.+?)__/g, '<u>$1</u>');               // __sublinhado__
        p = p.replace(/\*(.+?)\*/g, '<em>$1</em>');             // *itálico*
        // suporte a `code` inline
        p = p.replace(/`(.+?)`/g, (m, c) => `<code>${c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>`);

        // Links e mídia
        p = processMediaAndLinks(p);

        // Parágrafo - COM MELHORIAS DE ESTILO
        return `<p style="margin-bottom: 1.2em;">${p}</p>`;
    }).join('\n');

    return htmlContent;
};

module.exports = { parseLessonContent };

