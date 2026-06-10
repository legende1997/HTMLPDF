const express = require('express');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const { PDFDocument } = require('pdf-lib');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.send('Servidor HTML/ZPL para PDF funcionando!');
});

app.post('/convert', async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'Campo html é obrigatório' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="etiqueta.pdf"',
    });
    res.send(pdf);
  } catch (error) {
    if (browser) await browser.close();
    console.error(error);
    res.status(500).json({ error: 'Erro ao converter HTML para PDF', details: error.message });
  }
});

app.post('/convert-zpl', async (req, res) => {
  const { zpl } = req.body;
  if (!zpl) return res.status(400).json({ error: 'Campo zpl é obrigatório' });

  try {
    const labelaryResponse = await fetch(
      'https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: zpl,
      }
    );

    if (!labelaryResponse.ok) {
      throw new Error('Erro na API Labelary: ' + labelaryResponse.status);
    }

    const pngBuffer = await labelaryResponse.buffer();

    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(pngBuffer);

    const page = pdfDoc.addPage([4 * 72, 6 * 72]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: 4 * 72,
      height: 6 * 72,
    });

    const pdfBytes = await pdfDoc.save();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="etiqueta_zpl.pdf"',
    });
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao converter ZPL para PDF', details: error.message });
  }
});

app.post('/merge-pdfs', async (req, res) => {
  const { pdfs } = req.body;
  if (!pdfs || !Array.isArray(pdfs) || pdfs.length < 2) {
    return res.status(400).json({ error: 'Enviar array com pelo menos 2 PDFs em base64' });
  }

  try {
    const mergedPdf = await PDFDocument.create();

    for (const pdfBase64 of pdfs) {
      const pdfBytes = Buffer.from(pdfBase64, 'base64');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="etiqueta_completa.pdf"',
    });
    res.send(Buffer.from(mergedBytes));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao mesclar PDFs', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
