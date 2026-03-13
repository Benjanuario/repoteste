// ==================================================
// ANEXO.JS - SISTEMA DE ANEXOS PARA PLANOVIP.HTML
// ==================================================

// =============================================
// CONFIGURAÇÕES
// =============================================
const CONFIG = {
    MAX_IMAGE_SIZE: 8 * 1024 * 1024, // 8MB
    MAX_TEXT_LENGTH: 5000,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    IA_API_KEY: 'AIzaSyDcFXBuOiwKfNX2J7qKSVdiXt8ngPxDJJ0',
    IA_MODEL: 'gemini-2.5-flash-lite',
    IA_TIMEOUT: 15000
};

// =============================================
// VARIÁVEIS GLOBAIS
// =============================================
let cropper = null;
let imagemAtual = null;
let abaAtiva = 'texto';
let streamingInterval = null;

// =============================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE ABAS
// =============================================
function mudarAba(aba) {
    // Atualizar variável
    abaAtiva = aba;
    
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === aba) {
            btn.classList.add('active');
        }
    });
    
    // Atualizar painéis
    document.getElementById('panelTexto').classList.remove('active');
    document.getElementById('panelIA').classList.remove('active');
    document.getElementById('panelFoto').classList.remove('active');
    document.getElementById(`panel${aba.charAt(0).toUpperCase() + aba.slice(1)}`).classList.add('active');
    
    // Limpar streaming se necessário
    if (aba !== 'ia' && streamingInterval) {
        clearInterval(streamingInterval);
        streamingInterval = null;
    }
}

// =============================================
// FUNÇÕES DE TEXTO
// =============================================
function sanitizarTexto(texto) {
    if (!texto) return '';
    
    // Remover scripts e tags perigosas
    let sanitizado = texto
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<\/?(iframe|object|embed|link|meta)[^>]*>/gi, '');
    
    // Limitar tamanho
    if (sanitizado.length > CONFIG.MAX_TEXT_LENGTH) {
        sanitizado = sanitizado.substring(0, CONFIG.MAX_TEXT_LENGTH);
    }
    
    return sanitizado;
}

// =============================================
// FUNÇÕES DE IA (STREAMING)
// =============================================
function gerarConteudoIA() {
    // Obter dados do formulário principal
    const form = document.forms['planoForm'];
    if (!form) {
        alert('❌ Formulário principal não encontrado!');
        return;
    }
    
    const tema = form.tema?.value?.trim() || '';
    const disciplina = form.disciplina?.value?.trim() || '';
    const classe = form.classe?.value || '';
    
    if (!tema) {
        alert('⚠️ Preencha o TEMA da aula no formulário principal primeiro!');
        return;
    }
    
    // Desabilitar botão
    const btn = event.target;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> GERANDO...';
    btn.disabled = true;
    
    // Limpar streaming anterior
    if (streamingInterval) {
        clearInterval(streamingInterval);
        streamingInterval = null;
    }
    
    // Esconder textarea e mostrar streaming
    const textarea = document.getElementById('textoIA');
    const streamingContainer = document.getElementById('streamingContainer');
    const streamingTexto = document.getElementById('streamingTexto');
    
    textarea.style.display = 'none';
    streamingContainer.classList.remove('hidden');
    streamingTexto.textContent = '';
    
    // Obter conteúdos da tabela (se existirem)
    let conteudosExistentes = '';
    const tabela = document.getElementById('tabelaPlano');
    if (tabela) {
        const linhas = tabela.querySelectorAll('tbody tr');
        if (linhas.length >= 2) {
            const celulaConteudo = linhas[1].querySelector('td:nth-child(3)');
            if (celulaConteudo) {
                conteudosExistentes = celulaConteudo.innerText || '';
            }
        }
    }
    
    // Construir prompt
    const prompt = `Como especialista em educação em Moçambique, desenvolva um texto didático detalhado sobre "${tema}" para servir como anexo/quadro mural.

Contexto:
- Disciplina: ${disciplina}
- Classe: ${classe}
- Conteúdos já abordados: ${conteudosExistentes.substring(0, 200)}

O texto deve conter:
1. CONCEITO FUNDAMENTAL: Explicação clara e objetiva do tema
2. PONTOS-CHAVE: Lista dos aspectos mais importantes
3. EXEMPLOS PRÁTICOS: 2-4 exemplos aplicáveis
4. CURIOSIDADES OU APLICAÇÕES: Informações adicionais

Formato:
- Use parágrafos curtos e linguagem acessível
- Organize com títulos em negrito
- Apenas o conteúdo, sem introduções

IMPORTANTE: Responda APENAS o conteúdo do anexo, sem texto adicional.`;

    // Chamar API Gemini
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.IA_MODEL}:generateContent?key=${CONFIG.IA_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('API falhou');
        return response.json();
    })
    .then(data => {
        const texto = data.candidates[0].content.parts[0].text;
        streamarTexto(texto, streamingContainer, streamingTexto, textarea, btn, textoOriginal);
    })
    .catch(error => {
        console.error('Erro na IA:', error);
        
        // Fallback: abrir ChatGPT
        streamingContainer.classList.add('hidden');
        textarea.style.display = 'block';
        
        const promptEncoded = encodeURIComponent(prompt);
        window.open(`https://chat.openai.com/?q=${promptEncoded}`, '_blank');
        
        alert('✅ IA temporariamente indisponível. O ChatGPT foi aberto com o prompt!');
        
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    });
}

function streamarTexto(textoCompleto, container, elemento, textarea, btn, textoOriginal) {
    let index = 0;
    const textoLimpo = textoCompleto.replace(/\*\*/g, '').trim();
    
    streamingInterval = setInterval(() => {
        if (index < textoLimpo.length) {
            elemento.textContent += textoLimpo.charAt(index);
            index++;
        } else {
            clearInterval(streamingInterval);
            streamingInterval = null;
            
            setTimeout(() => {
                textarea.value = textoLimpo;
                textarea.style.display = 'block';
                container.classList.add('hidden');
                
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                
                alert('✅ Conteúdo gerado com sucesso!');
            }, 500);
        }
    }, 20);
}

// =============================================
// FUNÇÕES DE FOTO
// =============================================
function abrirCamera() {
    document.getElementById('inputCamera').click();
}

function abrirGaleria() {
    document.getElementById('inputGaleria').click();
}

function carregarFoto(input) {
    const file = input.files?.[0];
    if (!file) return;
    
    // Validar tipo
    if (!CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert('⚠️ Formato não suportado! Use JPG, PNG ou WebP.');
        return;
    }
    
    // Validar tamanho
    if (file.size > CONFIG.MAX_IMAGE_SIZE) {
        alert(`⚠️ Imagem muito grande! Máximo ${CONFIG.MAX_IMAGE_SIZE / (1024*1024)}MB.`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('previewFoto');
        preview.innerHTML = `<img src="${e.target.result}" id="imgCrop" style="max-width:100%; max-height:300px;">`;
        
        const img = document.getElementById('imgCrop');
        imagemAtual = e.target.result;
        
        // Mostrar controles do cropper
        document.getElementById('cropperControls').classList.remove('hidden');
        
        // Inicializar cropper
        setTimeout(() => {
            if (cropper) cropper.destroy();
            
            cropper = new Cropper(img, {
                viewMode: 1,
                dragMode: 'crop',
                aspectRatio: NaN,
                autoCropArea: 0.8,
                restore: true,
                guides: true,
                center: true,
                cropBoxMovable: true,
                cropBoxResizable: true
            });
        }, 100);
    };
    reader.readAsDataURL(file);
}

function rotacionarEsquerda() {
    if (cropper) cropper.rotate(-90);
}

function rotacionarDireita() {
    if (cropper) cropper.rotate(90);
}

function zoomMais() {
    if (cropper) cropper.zoom(0.1);
}

function zoomMenos() {
    if (cropper) cropper.zoom(-0.1);
}

function resetarCropper() {
    if (cropper) cropper.reset();
}

function aplicarCorte() {
    if (!cropper) {
        alert('⚠️ Nenhuma imagem carregada!');
        return;
    }
    
    const canvas = cropper.getCroppedCanvas({
        maxWidth: 800,
        maxHeight: 800,
        fillColor: '#fff'
    });
    
    if (!canvas) return;
    
    imagemAtual = canvas.toDataURL('image/jpeg', 0.9);
    
    const preview = document.getElementById('previewFoto');
    preview.innerHTML = `<img src="${imagemAtual}" style="max-width:100%; max-height:300px; border-radius:8px;">`;
    
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    
    document.getElementById('cropperControls').classList.add('hidden');
}

// =============================================
// FUNÇÕES PRINCIPAIS (INTEGRAÇÃO COM PLANOVIP)
// =============================================
function salvarAnexo() {
    // Obter preview do plano
    const preview = document.getElementById('anexoPreview');
    if (!preview) {
        alert('❌ Preview do plano não encontrado!');
        return;
    }
    
    let tipo = '';
    let dados = '';
    let conteudoHTML = '';
    
    switch(abaAtiva) {
        case 'texto':
            const textoManual = document.getElementById('textoManual').value.trim();
            if (!textoManual) {
                alert('⚠️ Digite o texto do anexo!');
                return;
            }
            tipo = 'texto';
            dados = sanitizarTexto(textoManual);
            conteudoHTML = `
                <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 16px; color: white;">
                    ${dados.replace(/\n/g, '<br>')}
                </div>
            `;
            break;
            
        case 'ia':
            const textoIA = document.getElementById('textoIA').value.trim();
            if (!textoIA) {
                alert('⚠️ Gere o conteúdo primeiro!');
                return;
            }
            tipo = 'texto';
            dados = sanitizarTexto(textoIA);
            conteudoHTML = `
                <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 16px; color: white;">
                    ${dados.replace(/\n/g, '<br>')}
                </div>
            `;
            break;
            
        case 'foto':
            if (!imagemAtual) {
                alert('⚠️ Selecione e recorte uma imagem!');
                return;
            }
            tipo = 'imagem';
            dados = imagemAtual;
            conteudoHTML = `
                <div style="text-align: center;">
                    <img src="${dados}" style="max-width:100%; max-height:300px; border-radius:8px;">
                </div>
            `;
            break;
    }
    
    // Atualizar preview
    preview.innerHTML = `
        <div style="background: rgba(15,23,42,0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; margin-top: 20px;">
            <h4 style="color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-paperclip" style="color: var(--accent);"></i>
                ANEXO ADICIONADO
            </h4>
            <div style="margin-bottom: 15px;">${conteudoHTML}</div>
            <button onclick="removerAnexo()" style="background: #dc2626; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer;">
                <i class="fas fa-trash"></i> REMOVER ANEXO
            </button>
        </div>
    `;
    preview.style.display = 'block';
    
    // Salvar no sessionStorage
    salvarNoSessionStorage(tipo, dados);
    
    // Fechar painel
    fecharAnexo();
    
    alert('✅ Anexo salvo com sucesso!');
}

function salvarNoSessionStorage(tipo, dados) {
    try {
        const planoData = JSON.parse(sessionStorage.getItem('planoData') || '{}');
        planoData.anexoTipo = tipo;
        if (tipo === 'imagem') {
            planoData.anexoImagem = dados;
            planoData.anexoTexto = null;
        } else {
            planoData.anexoTexto = dados;
            planoData.anexoImagem = null;
        }
        sessionStorage.setItem('planoData', JSON.stringify(planoData));
    } catch (e) {
        console.warn('Erro ao salvar no sessionStorage:', e);
    }
}

function removerAnexo() {
    const preview = document.getElementById('anexoPreview');
    if (preview) {
        preview.style.display = 'none';
        preview.innerHTML = '';
    }
    
    try {
        const planoData = JSON.parse(sessionStorage.getItem('planoData') || '{}');
        delete planoData.anexoTipo;
        delete planoData.anexoImagem;
        delete planoData.anexoTexto;
        sessionStorage.setItem('planoData', JSON.stringify(planoData));
    } catch (e) {}
    
    const btnAdd = document.getElementById('btnAdicionarAnexo');
    if (btnAdd) btnAdd.style.display = 'inline-block';
}

function fecharAnexo() {
    const container = document.getElementById('anexoContainerContent');
    if (container) {
        container.style.display = 'none';
    }
    
    // Limpar campos
    document.getElementById('textoManual').value = '';
    document.getElementById('textoIA').value = '';
    document.getElementById('previewFoto').innerHTML = `
        <div style="color: var(--gray);">
            <i class="fas fa-cloud-upload-alt" style="font-size: 40px;"></i>
            <p>Nenhuma imagem selecionada</p>
        </div>
    `;
    document.getElementById('cropperControls').classList.add('hidden');
    
    imagemAtual = null;
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    
    // Mostrar botão adicionar se não houver anexo salvo
    const preview = document.getElementById('anexoPreview');
    if (!preview || preview.style.display !== 'block') {
        const btnAdd = document.getElementById('btnAdicionarAnexo');
        if (btnAdd) btnAdd.style.display = 'inline-block';
    }
}

// =============================================
// CARREGAR ANEXO SALVO
// =============================================
function carregarAnexoSalvo() {
    try {
        const planoData = JSON.parse(sessionStorage.getItem('planoData') || '{}');
        
        if (!planoData.anexoTipo) return;
        
        const preview = document.getElementById('anexoPreview');
        if (!preview) return;
        
        let conteudoHTML = '';
        
        if (planoData.anexoTipo === 'imagem' && planoData.anexoImagem) {
            conteudoHTML = `
                <div style="text-align: center;">
                    <img src="${planoData.anexoImagem}" style="max-width:100%; max-height:300px; border-radius:8px;">
                </div>
            `;
        } else if (planoData.anexoTexto) {
            conteudoHTML = `
                <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 16px; color: white;">
                    ${planoData.anexoTexto.replace(/\n/g, '<br>')}
                </div>
            `;
        }
        
        if (conteudoHTML) {
            preview.innerHTML = `
                <div style="background: rgba(15,23,42,0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; margin-top: 20px;">
                    <h4 style="color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-paperclip" style="color: var(--accent);"></i>
                        ANEXO ADICIONADO
                    </h4>
                    <div style="margin-bottom: 15px;">${conteudoHTML}</div>
                    <button onclick="removerAnexo()" style="background: #dc2626; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer;">
                        <i class="fas fa-trash"></i> REMOVER ANEXO
                    </button>
                </div>
            `;
            preview.style.display = 'block';
        }
    } catch (e) {
        console.warn('Erro ao carregar anexo salvo:', e);
    }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function inicializar() {
    console.log('🚀 Inicializando sistema de anexos...');
    
    // Configurar textareas para sanitização
    document.getElementById('textoManual').addEventListener('input', function() {
        this.value = sanitizarTexto(this.value);
    });
    
    document.getElementById('textoIA').addEventListener('input', function() {
        this.value = sanitizarTexto(this.value);
    });
    
    // Carregar anexo salvo
    carregarAnexoSalvo();
    
    console.log('✅ Sistema de anexos pronto!');
}

// Executar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    inicializar();
}

// =============================================
// EXPORTAR FUNÇÕES PARA O ESCOPO GLOBAL
// =============================================
window.mudarAba = mudarAba;
window.gerarConteudoIA = gerarConteudoIA;
window.abrirCamera = abrirCamera;
window.abrirGaleria = abrirGaleria;
window.carregarFoto = carregarFoto;
window.rotacionarEsquerda = rotacionarEsquerda;
window.rotacionarDireita = rotacionarDireita;
window.zoomMais = zoomMais;
window.zoomMenos = zoomMenos;
window.resetarCropper = resetarCropper;
window.aplicarCorte = aplicarCorte;
window.salvarAnexo = salvarAnexo;
window.removerAnexo = removerAnexo;
window.fecharAnexo = fecharAnexo;
window.carregarAnexoSalvo = carregarAnexoSalvo;