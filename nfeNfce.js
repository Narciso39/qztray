// Configuração padrão - altere conforme necessário
const config = {
    printerName: "Microsoft Print to PDF", // Nome da impressora PDF
    xmlPath: "nfe.xml", // Caminho para o arquivo XML da NFCe
    pageWidth: 80 // Largura da página em caracteres (para impressão térmica)
};

function setStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
}

async function loadXML(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Erro ao carregar XML: ${response.status}`);
        return await response.text();
    } catch (error) {
        throw error;
    }
}

function parseNFCeXML(xmlText) {
    // Esta é uma função básica de parse - você pode precisar adaptar para seu XML específico
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Extrai informações básicas da NFCe (adaptar conforme seu layout XML)
    const nfe = xmlDoc.getElementsByTagName("NFe")[0];
    const infNFe = nfe.getElementsByTagName("infNFe")[0];
    const ide = infNFe.getElementsByTagName("ide")[0];
    const emit = infNFe.getElementsByTagName("emit")[0];
    const dest = infNFe.getElementsByTagName("dest")[0];
    const total = infNFe.getElementsByTagName("total")[0];
    
    // Extrai itens (simplificado)
    const items = [];
    const detElements = infNFe.getElementsByTagName("det");
    for (let i = 0; i < detElements.length; i++) {
        const prod = detElements[i].getElementsByTagName("prod")[0];
        items.push({
            descricao: prod.getElementsByTagName("xProd")[0].textContent,
            quantidade: prod.getElementsByTagName("qCom")[0].textContent,
            valor: prod.getElementsByTagName("vUnCom")[0].textContent
        });
    }
    
    return {
        numero: ide.getElementsByTagName("nNF")[0].textContent,
        serie: ide.getElementsByTagName("serie")[0].textContent,
        dataEmissao: ide.getElementsByTagName("dhEmi")[0].textContent,
        emitente: {
            nome: emit.getElementsByTagName("xNome")[0].textContent,
            cnpj: emit.getElementsByTagName("CNPJ")[0].textContent,
            endereco: emit.getElementsByTagName("xLgr")[0].textContent + ", " + 
                     emit.getElementsByTagName("nro")[0].textContent
        },
        destinatario: dest ? {
            nome: dest.getElementsByTagName("xNome")[0].textContent,
            cpf: dest.getElementsByTagName("CPF")[0].textContent
        } : null,
        total: total.getElementsByTagName("vNF")[0].textContent,
        items: items
    };
}

function generateDANFE(nfceData) {
    // Gera o HTML do DANFE NFCe - você pode personalizar este layout
    let html = `
        <div style="width: ${config.pageWidth}mm; margin: 0 auto; font-size: 10pt; font-family: monospace;">
            <h2 style="text-align: center;">DANFE NFCe</h2>
            <hr>
            <p><strong>NFC-e:</strong> ${nfceData.numero} Série: ${nfceData.serie}</p>
            <p><strong>Data Emissão:</strong> ${nfceData.dataEmissao}</p>
            
            <h3>Emitente</h3>
            <p>${nfceData.emitente.nome}</p>
            <p>CNPJ: ${nfceData.emitente.cnpj}</p>
            <p>${nfceData.emitente.endereco}</p>
            
            ${nfceData.destinatario ? `
            <h3>Destinatário</h3>
            <p>${nfceData.destinatario.nome}</p>
            <p>CPF: ${nfceData.destinatario.cpf}</p>
            ` : ''}
            
            <h3>Itens</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #000; text-align: left;">Descrição</th>
                        <th style="border: 1px solid #000; text-align: right;">Qtd</th>
                        <th style="border: 1px solid #000; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${nfceData.items.map(item => `
                        <tr>
                            <td style="border: 1px solid #000;">${item.descricao}</td>
                            <td style="border: 1px solid #000; text-align: right;">${item.quantidade}</td>
                            <td style="border: 1px solid #000; text-align: right;">R$ ${parseFloat(item.valor).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h3 style="text-align: right;">Total: R$ ${parseFloat(nfceData.total).toFixed(2)}</h3>
            
            <hr>
            <p style="text-align: center;">Consulte em <br>http://www.nfe.fazenda.gov.br/portal</p>
        </div>
    `;
    
    return html;
}

async function listPrinters() {
    setStatus("Conectando ao QZ Tray...");
    
    try {
        await qz.websocket.connect();
        const printers = await qz.printers.find();
        setStatus(`Impressoras disponíveis:\n${printers.join("\n")}`);
    } catch (error) {
        setStatus(`Erro: ${error.message}`, true);
    } finally {
        qz.websocket.disconnect();
    }
}

async function printNFCe() {
    setStatus("Preparando impressão...");
    
    try {
        // 1. Carrega o XML
        const xmlText = await loadXML(config.xmlPath);
        
        // 2. Parseia o XML para extrair os dados
        const nfceData = parseNFCeXML(xmlText);
        
        // 3. Gera o DANFE em HTML
        const danfeHTML = generateDANFE(nfceData);
        
        // Mostra pré-visualização
        document.getElementById('danfe-preview').innerHTML = danfeHTML;
        
        // 4. Conecta ao QZ Tray e imprime
        await qz.websocket.connect();
        
        // Verifica se a impressora existe
        const printers = await qz.printers.find();
        if (!printers.includes(config.printerName)) {
            throw new Error(`Impressora '${config.printerName}' não encontrada.`);
        }
        
        const printConfig = qz.configs.create(config.printerName, {
            size: { width: `${config.pageWidth}mm` }
        });
        
        const printData = [{
            type: 'html',
            format: 'plain',
            data: danfeHTML,
            options: { 
                colorType: 'grayscale',
                orientation: 'portrait',
                scaleContent: true
            }
        }];
        
        await qz.print(printConfig, printData);
        setStatus("NFCe enviada para impressão com sucesso!");
    } catch (error) {
        setStatus(`Erro ao imprimir: ${error.message}`, true);
        console.error(error);
    } finally {
        qz.websocket.disconnect();
    }
}

// Inicialização - verifica se o QZ Tray está instalado
window.addEventListener('load', () => {
    if (!window.qz) {
        setStatus("Erro: QZ Tray não está instalado ou não foi carregado.", true);
    } else {
        setStatus("Pronto para imprimir. Clique no botão 'Imprimir NFCe'.");
    }
});